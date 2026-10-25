"""
Eksport danych z lokalnej instalacji Unturned do Base Plannera.

Wymaga: Python 3.10+, `pip install UnityPy numpy pillow`
Uruchomienie: npm run export:game   (albo: python scripts/export_game_data.py [ścieżka do Unturned])

Tworzy (pliki z gry, tylko do użytku lokalnego, są w .gitignore):
  public/game/structures.json      modele 3D, kolory, metadane i receptury struktur
  public/unturned/items/<id>.png   ikony (UnturnedImages, brakujące generowane)
  public/maps/index.json           lista map
  public/maps/<Map>/meta.json      rozmiar, zasięg, poziom wody, zakres wysokości
  public/maps/<Map>/height.bin     siatka wysokości (uint16 LE, co 4 m)
  public/maps/<Map>/overview.jpg   podgląd mapy 1024 px
  public/maps/<Map>/tiles/x_y.jpg  satelita z gry w kaflach 512 px
  public/maps/<Map>/scene.json     obiekty mapy (budynki, skały...) i drzewa: typ, pozycja, obrót, skala
  public/game/scenery/<guid>.json  modele obiektów i drzew (LOD0, kolory palety, liście z teksturą alfa)
  public/game/scenery/tex/*.png    tekstury liści i siatek wycinanych alfą
  public/maps/<Map>/splat_N.png    wagi materiałów terenu (RGBA = 4 warstwy), siatka co 4 m
  public/game/terrain/<nazwa>.png  tekstury warstw terenu (64 px, powtarzane co 16 m)
  public/maps/<Map>/roads.json     drogi (krzywe, materiały) + public/maps/<Map>/roads/*.png tekstury

Same tekstury terenu (bez modeli): python scripts/export_game_data.py --terrain
Same modele obiektów i drzew map:  python scripts/export_game_data.py --scenery
Samo oświetlenie i spawny map:     python scripts/export_game_data.py --lighting
Same rekwizyty (barykady):         python scripts/export_game_data.py --props
  (public/game/props.json + public/game/props/<id>.json, ikony w public/unturned/items)
Same przepisy i surowce:           python scripts/export_game_data.py --recipes
  (recipe w public/game/props.json, public/game/resources.json)
Same ikony (sprawdzenie, kopia):   python scripts/export_game_data.py --icons [--icons-dir=<folder z PNG z gry>]
  (kończy się błędem, gdy jakiś przedmiot nie ma ikony z gry; docs/icons.md)
Same dźwięki (drzwi, klapy):       python scripts/export_game_data.py --sounds
  (public/game/sounds/<klip>.wav i public/game/sounds.json: klip, głośność, zasięg, czas animacji na ID)

Formaty plików mapy według kodu gry (U3-SDK: LevelObjects.cs, LevelGround.cs, River.cs, Level.cs).
"""

import io
import json
import math
import os
import re
import struct
import sys
import urllib.request
import uuid

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
ICON_CDN = "https://cdn.jsdelivr.net/gh/SilKsPlugins/UnturnedImages@images/vanilla/items/{}.png"


# ---------------------------------------------------------------- instalacja

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
FLAGS = {a for a in sys.argv[1:] if a.startswith("--")}


def find_unturned():
    if ARGS:
        return ARGS[0]
    if os.environ.get("UNTURNED_PATH"):
        return os.environ["UNTURNED_PATH"]
    candidates = [r"C:\Program Files (x86)\Steam", r"C:\Program Files\Steam"]
    for steam in list(candidates):
        vdf = os.path.join(steam, "steamapps", "libraryfolders.vdf")
        if os.path.exists(vdf):
            candidates += [p.replace("\\\\", "\\") for p in re.findall(r'"path"\s+"([^"]+)"', open(vdf, encoding="utf-8").read())]
    for lib in candidates:
        p = os.path.join(lib, "steamapps", "common", "Unturned")
        if os.path.exists(os.path.join(p, "Bundles", "core.masterbundle")):
            return p
    sys.exit("Nie znaleziono Unturned. Podaj ścieżkę: python scripts/export_game_data.py <folder Unturned>")


def read_text(path):
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        return f.read()


# ---------------------------------------------------------------- metadane .dat

def scan_assets(bundles):
    """GUID -> nazwa oraz lista struktur i klap (barykady Build Hatch)."""
    guid_item = {}
    found = []
    for root, _, files in os.walk(os.path.join(bundles, "Items")):
        for fn in files:
            if not fn.endswith(".dat") or fn == "English.dat":
                continue
            text = read_text(os.path.join(root, fn))
            eng = os.path.join(root, "English.dat")
            name = None
            if os.path.exists(eng):
                m = re.search(r"^Name\s+(.+)$", read_text(eng), re.M)
                name = m.group(1).strip() if m else None
            g = re.search(r"^GUID\s+(\w+)", text, re.M)
            item_id = re.search(r"^ID\s+(\d+)", text, re.M)
            if g and item_id:
                guid_item[g.group(1).lower()] = {"id": int(item_id.group(1)), "name": name}
            is_structure = re.search(r"^Type\s+Structure", text, re.M)
            is_hatch = re.search(r"^Build\s+Hatch", text, re.M)
            if is_structure or is_hatch:
                found.append((root, text, name))

    out = []
    for root, text, name in found:
        item_id = int(re.search(r"^ID\s+(\d+)", text, re.M).group(1))
        construct = re.search(r"^Construct\s+(\w+)", text, re.M)
        health = re.search(r"^Health\s+(\d+)", text, re.M)
        out.append({
            "id": item_id,
            "name": name,
            "folder": os.path.basename(root).lower(),
            "kind": "structure" if construct else "barricade",
            "construct": construct.group(1) if construct else "Hatch",
            "health": int(health.group(1)) if health else None,
            "recipe": parse_recipe(text, guid_item),
            # Armor_Tier z pliku (High/Low); brak = gra wybiera po nazwie (kalkulator raidu, src/lib/raid.ts)
            "armor": armor.group(1).lower() if armor else None,
        })
    return sorted(out, key=lambda s: s["id"]), guid_item


def parse_inputs(body):
    """
    Blok InputItems blueprintu: pojedynczy napis "guid x N", lista napisów albo obiekty { ID, Amount, Delete }.
    Narzędzia (Delete false, np. palnik) nie zużywają się, więc nie są kosztem.
    """
    at = body.find("InputItems")
    if at < 0:
        return []
    rest = body[at + len("InputItems"):].lstrip(" \t")
    if rest.startswith('"') or rest[:1].isdigit():
        # jeden składnik w tej samej linii: "guid x N" albo stara składnia z numerem: 68 x 2
        block = rest.split("\n", 1)[0]
    else:
        start = rest.find("[")
        if start < 0:
            return []
        depth, end = 0, len(rest)
        for i in range(start, len(rest)):
            if rest[i] == "[":
                depth += 1
            elif rest[i] == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        block = rest[start + 1:end]
    out = []
    # obiekty { ID "guid" Amount N Delete false }
    for obj in re.findall(r"\{(.*?)\}", block, re.S):
        g = re.search(r'ID\s+"([0-9a-f]{32})"', obj)
        if not g or re.search(r"Delete\s+false", obj):
            continue
        n = re.search(r"Amount\s+(\d+)", obj)
        out.append((g.group(1), int(n.group(1)) if n else 1))
    # napisy "guid" albo "guid x N" poza obiektami
    plain = re.sub(r"\{.*?\}", "", block, flags=re.S)
    for g, n in re.findall(r'"([0-9a-f]{32})(?:\s*x\s*(\d+))?"', plain):
        out.append((g, int(n or 1)))
    # stara składnia z numerem przedmiotu zamiast GUID-a (np. szyby: InputItems 68 x 2)
    for i, n in re.findall(r"(?:^|\s)(\d+)(?:\s*x\s*(\d+))?(?=\s|$)", re.sub(r'"[^"]*"', " ", plain)):
        out.append((i, int(n or 1)))
    return out


def parse_recipe(text, guid_item):
    """
    Pierwszy blueprint, który robi ten przedmiot (OutputItems this): składniki [{id, name, amount}] i liczba sztuk.
    Nowy format (InputItems z GUID-ami) albo stary (Blueprint_0_Supply_N_ID / _Amount).
    """
    m = re.search(r"Blueprints\s*\[\s*\{(.*?)\n\t\}", text, re.S)
    if m:
        body = m.group(1)
        inputs = []
        by_id = {v["id"]: v for v in guid_item.values()}
        for g, n in parse_inputs(body):
            item = by_id.get(int(g), {"id": int(g), "name": None}) if g.isdigit() else guid_item.get(g.lower(), {"id": None, "name": g})
            inputs.append({"id": item["id"], "name": item["name"], "amount": n})
        out = re.search(r'OutputItems\s+"this x (\d+)"', body)
        return {"inputs": inputs, "yields": int(out.group(1)) if out else 1}
    supplies = re.findall(r"^Blueprint_0_Supply_(\d+)_ID\s+(\d+)", text, re.M)
    if not supplies:
        return None
    by_id = {v["id"]: v for v in guid_item.values()}
    inputs = []
    for n, item_id in supplies:
        amount = re.search(rf"^Blueprint_0_Supply_{n}_Amount\s+(\d+)", text, re.M)
        item = by_id.get(int(item_id), {"id": int(item_id), "name": None})
        inputs.append({"id": item["id"], "name": item["name"], "amount": int(amount.group(1)) if amount else 1})
    product = re.search(r"^Blueprint_0_Products\s+(\d+)", text, re.M)
    return {"inputs": inputs, "yields": int(product.group(1)) if product else 1}


# ---------------------------------------------------------------- modele 3D

def quat_to_matrix(q):
    x, y, z, w = q.x, q.y, q.z, q.w
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def components(go):
    """(typ, obiekt, path_id) wszystkich komponentów GameObjectu."""
    out = []
    for comp in go.m_Components:
        ptr = comp.component if hasattr(comp, "component") else comp
        try:
            obj = ptr.read()
        except Exception:
            continue
        out.append((obj.object_reader.type.name, obj, ptr.path_id))
    return out


def component(go, type_name):
    for t, obj, _ in components(go):
        if t == type_name:
            return obj
    return None


def mesh_arrays(mesh):
    """
    Wierzchołki, UV, trójkąty i numer submesha każdego trójkąta z eksportu OBJ.
    UnityPy odbija X i odwraca kolejność trójkątów; wracamy do układu Unity.
    """
    verts, uvs, faces, groups = [], [], [], []
    sub = 0
    for line in mesh.export().splitlines():
        if line.startswith("v "):
            verts.append([float(v) for v in line.split()[1:4]])
        elif line.startswith("vt "):
            uvs.append([float(v) for v in line.split()[1:3]])
        elif line.startswith("g "):
            tail = line.split("_")[-1]
            sub = int(tail) if tail.isdigit() and line.count("_") >= 2 else sub
        elif line.startswith("f "):
            idx = [int(p.split("/")[0]) - 1 for p in line.split()[1:]]
            for k in range(1, len(idx) - 1):
                faces.append([idx[0], idx[k], idx[k + 1]])
                groups.append(sub)
    v = np.array(verts) * np.array([-1, 1, 1])
    f = np.array(faces)[:, ::-1] if faces else np.zeros((0, 3), int)
    uv = np.array(uvs) if len(uvs) == len(verts) else None
    return v, uv, f, groups


def material_palettes(renderer):
    """Tekstura główna (z tintem _Color) każdego materiału renderera jako tablica RGB."""
    out = []
    if renderer is None:
        return out
    for ptr in renderer.m_Materials:
        try:
            mat = ptr.read()
        except Exception:
            out.append(None)
            continue
        tint = dict(mat.m_SavedProperties.m_Colors).get("_Color")
        tint = np.array([tint.r, tint.g, tint.b]) if tint is not None else np.ones(3)
        img = None
        for key, env in mat.m_SavedProperties.m_TexEnvs:
            if key == "_MainTex" and env.m_Texture.path_id:
                img = np.array(env.m_Texture.read().image.convert("RGB"), float)
        out.append((img, tint))
    return out


def vertex_colors(v, uv, f, groups, palettes):
    """
    Kolor każdego wierzchołka: piksel palety materiału wskazany przez UV (filtr najbliższy),
    dokładnie tak, jak gra rysuje struktury (tekstury 2x2 z paletą kolorów).
    """
    colors = np.full((len(v), 3), 160.0)
    for tri, g in zip(f, groups):
        pal = palettes[g] if g < len(palettes) else (palettes[0] if palettes else None)
        if not pal:
            continue
        img, tint = pal
        for vi in tri:
            if img is None or uv is None:
                colors[vi] = 255 * tint
                continue
            h, w = img.shape[:2]
            x = min(w - 1, max(0, int(uv[vi][0] % 1.0 * w)))
            y = min(h - 1, max(0, int((1 - uv[vi][1] % 1.0) * h)))
            colors[vi] = img[y, x] * tint
    return np.clip(colors, 0, 255)


SHADER_NAMES = {}


def cutout_textures(renderer):
    """
    Dla każdego materiału renderera: (tekstura, próg alfy) gdy materiał jest wycinany alfą
    (liście drzew, krzaki, siatki płotów), inaczej None. Takich materiałów nie da się oddać
    kolorem wierzchołka: kształt liści siedzi w przezroczystości tekstury.
    """
    out = []
    for ptr in renderer.m_Materials if renderer is not None else []:
        try:
            mat = ptr.read()
        except Exception:
            out.append(None)
            continue
        sid = mat.m_Shader.path_id
        if sid not in SHADER_NAMES:
            try:
                SHADER_NAMES[sid] = mat.m_Shader.read().m_ParsedForm.m_Name
            except Exception:
                SHADER_NAMES[sid] = ""
        floats = dict(mat.m_SavedProperties.m_Floats)
        foliage = "Foliage" in SHADER_NAMES[sid] or "Leaves" in SHADER_NAMES[sid]
        tex = next((env.m_Texture for key, env in mat.m_SavedProperties.m_TexEnvs
                    if key == "_MainTex" and env.m_Texture.path_id), None)
        if tex is None or not (foliage or floats.get("_Mode") == 1.0):
            out.append(None)
            continue
        out.append((tex, float(floats.get("_Cutoff", 0.5))))
    return out


def compact(v, f, *extra):
    """Zostawia tylko wierzchołki użyte przez trójkąty f (z przenumerowaniem)."""
    used, inv = np.unique(f, return_inverse=True)
    return (v[used], inv.reshape(f.shape)) + tuple(e[used] for e in extra)


def lod0_renderers(go):
    """path_id rendererów z pierwszego poziomu LOD (pozostałe poziomy pomijamy)."""
    lod = component(go, "LODGroup")
    if lod is None or not lod.m_LODs:
        return None
    return {r.renderer.path_id for r in lod.m_LODs[0].renderers}


def collect_meshes(go, parent=np.eye(4), is_root=True, allowed=None, root_rotation=True, cutouts=None):
    """
    Siatki LOD0 pod prefabem w układzie korzenia (bez pozycji korzenia), z kolorami wierzchołków.
    root_rotation=False: obrót i skala korzenia są pomijane (gra nadpisuje je przy stawianiu obiektu na mapie).
    cutouts: lista, do której trafiają części z materiałem wycinanym alfą (v, f, uv, tekstura, próg)
    zamiast do zwykłych siatek z kolorami.
    """
    tr = component(go, "Transform")
    m = np.eye(4)
    if tr is not None and (root_rotation or not is_root):
        r = quat_to_matrix(tr.m_LocalRotation)
        s = np.diag([tr.m_LocalScale.x, tr.m_LocalScale.y, tr.m_LocalScale.z])
        m[:3, :3] = r @ s
        if not is_root:
            m[:3, 3] = [tr.m_LocalPosition.x, tr.m_LocalPosition.y, tr.m_LocalPosition.z]
    world = parent @ m
    allowed = lod0_renderers(go) or allowed
    comps = components(go)
    mesh_ptr, renderer, renderer_id = None, None, None
    for t, obj, pid in comps:
        if t == "MeshFilter" and obj.m_Mesh.path_id:
            mesh_ptr = obj.m_Mesh
        elif t == "MeshRenderer":
            renderer, renderer_id = obj, pid
        elif t == "SkinnedMeshRenderer" and obj.m_Mesh.path_id:
            mesh_ptr, renderer, renderer_id = obj.m_Mesh, obj, pid
    parts = []
    if mesh_ptr is not None and (allowed is None or renderer_id in allowed):
        v, uv, f, groups = mesh_arrays(mesh_ptr.read())
        colors = vertex_colors(v, uv, f, groups, material_palettes(renderer))
        v = (world[:3, :3] @ v.T).T + world[:3, 3]
        groups = np.array(groups, int)
        solid = np.ones(len(f), bool)
        if cutouts is not None and uv is not None and len(f):
            for g, cut in enumerate(cutout_textures(renderer)):
                # jak w vertex_colors: submesh bez własnego materiału bierze pierwszy
                mask = (groups == g) | ((g == 0) & (groups >= len(renderer.m_Materials)))
                if cut is None or not mask.any():
                    continue
                cv, cf, cuv = compact(v, f[mask], uv)
                cutouts.append((cv, cf, cuv, cut[0], cut[1]))
                solid &= ~mask
        if solid.all():
            parts.append((v, f, colors))
        elif solid.any():
            parts.append(compact(v, f[solid], colors))
    if tr is not None:
        for child in tr.m_Children:
            parts += collect_meshes(child.read().m_GameObject.read(), world, False, allowed, root_rotation, cutouts)
    return parts


def to_three(v):
    """Unity (lewoskrętny, Y w górę) -> three.js (prawoskrętny): odbicie Z."""
    return v * np.array([1, 1, -1])


def normalize_piece(meta, v):
    """
    Ustawia model w konwencji Base Plannera:
      płyty kwadratowe: środek w (0,0); trójkąty: środek ciężkości w (0,0), wierzchołek w stronę -Z;
      ściany: wzdłuż osi X, środek krawędzi w (0,0). Wysokość zostaje jak w grze (pivot).
    """
    c = meta["construct"]
    xs, zs = v[:, 0], v[:, 2]
    if c in ("Wall", "Rampart"):
        if (zs.max() - zs.min()) > (xs.max() - xs.min()):  # obrót o 90°, żeby ściana szła wzdłuż X
            v = v[:, [2, 1, 0]] * np.array([-1, 1, 1])
        v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
        v[:, 2] -= (v[:, 2].max() + v[:, 2].min()) / 2
    elif c in ("Floor_Poly", "Roof_Poly"):
        # Trójkąt: wierzchołek po stronie, gdzie szerokość X jest najmniejsza.
        top = v[v[:, 1] > v[:, 1].max() - 0.3]
        zmin, zmax = top[:, 2].min(), top[:, 2].max()
        near_min = top[top[:, 2] < zmin + 0.5][:, 0]
        near_max = top[top[:, 2] > zmax - 0.5][:, 0]
        if np.ptp(near_max) < np.ptp(near_min):  # wierzchołek po stronie +Z: obrót o 180°
            v = v * np.array([-1, 1, -1])
            zmin, zmax = -zmax, -zmin
        h = zmax - zmin
        v[:, 2] -= zmax - h / 3  # środek ciężkości: 1/3 wysokości od podstawy (+Z)
        v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
    elif c in ("Pillar", "Post"):
        v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
        v[:, 2] -= (v[:, 2].max() + v[:, 2].min()) / 2
    elif c == "Hatch":
        # Model klapy jest w pozie szkieletu (pionowo): kładziemy go płasko, spód na y = 0.
        if np.ptp(v[:, 1]) > np.ptp(v[:, 2]):
            v = np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1)
        v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
        v[:, 2] -= (v[:, 2].max() + v[:, 2].min()) / 2
        v[:, 1] -= v[:, 1].min()
    else:  # Floor, Roof: środek prostokąta górnej powierzchni
        v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
        v[:, 2] -= (v[:, 2].max() + v[:, 2].min()) / 2
    return v


def export_structures(unturned, metas):
    import UnityPy

    print("Wczytywanie core.masterbundle (to chwilę trwa)...")
    env = UnityPy.load(os.path.join(unturned, "Bundles", "core.masterbundle"))
    container = env.container
    result = []
    for meta in metas:
        group = "structures" if meta["kind"] == "structure" else "barricades"
        prefab = "structure" if meta["kind"] == "structure" else "barricade"
        key = f"assets/coremasterbundle/items/{group}/{meta['folder']}/{prefab}.prefab"
        entry = dict(meta)
        if key in container:
            parts = collect_meshes(container[key].read())
            if parts:
                verts, faces, cols, offset = [], [], [], 0
                for v, f, c in parts:
                    verts.append(v)
                    faces.append(f + offset)
                    cols.append(c)
                    offset += len(v)
                v = to_three(np.vstack(verts))
                f = np.vstack(faces)[:, ::-1]  # odbicie Z zmienia skrętność trójkątów
                c = np.vstack(cols)
                v = normalize_piece(meta, v)
                # Kolor dominujący (do UI i malowania): najczęstszy kolor wierzchołków.
                keys, counts = np.unique(np.round(c).astype(int), axis=0, return_counts=True)
                entry["color"] = "#%02x%02x%02x" % tuple(keys[counts.argmax()])
                entry["mesh"] = {
                    "p": [round(float(x), 4) for x in v.ravel()],
                    "i": [int(x) for x in f.ravel()],
                    "c": [int(round(x)) for x in c.ravel()],
                }
                entry["bounds"] = [[round(float(a), 3) for a in v.min(0)], [round(float(a), 3) for a in v.max(0)]]
        result.append(entry)
        status = "model" if "mesh" in entry else "BRAK MODELU"
        print(f"  {meta['id']:5d} {meta['name']:<28} {meta['construct']:<11} {status}")
    os.makedirs(os.path.join(PUBLIC, "game"), exist_ok=True)
    with open(os.path.join(PUBLIC, "game", "structures.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    return result


# ---------------------------------------------------------------- ikony

# Te same ikony z repozytorium na GitHubie: CDN potrafi chwilowo zwrócić błąd, wtedy drugie źródło
ICON_RAW = "https://raw.githubusercontent.com/SilKsPlugins/UnturnedImages/images/vanilla/items/{}.png"


def fetch_icon(item_id):
    """Ikona z gry (UnturnedImages: render ItemTool z gry). 404 = brak w zbiorze, inne błędy: ponowna próba."""
    for url in (ICON_CDN, ICON_RAW):
        for _ in range(3):
            try:
                with urllib.request.urlopen(url.format(item_id), timeout=20) as r:
                    return Image.open(io.BytesIO(r.read())).convert("RGBA")
            except urllib.error.HTTPError as e:
                if e.code in (403, 404):
                    break
            except Exception:
                pass
    return None


# Ikony materiałów w przyborniku: kłody, blacha, cegły (ID przedmiotów z Bundles/Items/Supplies)
MATERIAL_ICONS = {"maple": 39, "birch": 37, "pine": 41, "metal": 68, "brick": 74}


def export_material_icons():
    out_dir = os.path.join(PUBLIC, "unturned", "items")
    os.makedirs(out_dir, exist_ok=True)
    for item_id in MATERIAL_ICONS.values():
        path = os.path.join(out_dir, f"{item_id}.png")
        if not os.path.exists(path):
            img = fetch_icon(item_id)
            if img is not None:
                img.save(path)


def export_icons(structures):
    export_material_icons()
    out_dir = os.path.join(PUBLIC, "unturned", "items")
    os.makedirs(out_dir, exist_ok=True)
    by_folder = {s["folder"]: s for s in structures}
    for s in structures:
        path = os.path.join(out_dir, f"{s['id']}.png")
        if os.path.exists(path):
            continue
        img = fetch_icon(s["id"])
        if img is None:
            # bez ikon robionych przez nas: brak zgłasza check_icons na końcu eksportu
            continue
        img.thumbnail((256, 256), Image.LANCZOS)
        img.save(path, optimize=True)


# ---------------------------------------------------------------- obiekty mapy i drzewa

class Reader:
    """Odczyt binarnych plików gry (odpowiednik River.cs, little-endian)."""

    def __init__(self, data):
        self.b, self.o = data, 0

    def take(self, fmt):
        v = struct.unpack_from("<" + fmt, self.b, self.o)
        self.o += struct.calcsize("<" + fmt)
        return v

    def guid(self):
        n = self.take("H")[0]
        raw = self.b[self.o:self.o + n]
        self.o += n
        return uuid.UUID(bytes_le=raw).hex if n == 16 else None


def read_objects_dat(path):
    """Level/Objects.dat (LevelObjects.load): lista (guid, pozycja, obrót Euler, skala)."""
    r = Reader(open(path, "rb").read())
    version = r.take("B")[0]
    if 1 < version < 3:
        r.take("Q")
    if version > 8:
        r.take("I")
    out = []
    for _ in range(64 * 64):
        for _ in range(r.take("H")[0]):
            pos, rot = r.take("3f"), r.take("3f")
            scale = r.take("3f") if version > 3 else (1.0, 1.0, 1.0)
            r.take("H")  # stare ID
            if 5 < version < 10:
                r.o += r.take("B")[0]
            guid = r.guid() if version > 7 else None
            if version > 6:
                r.take("B")
            if version > 8:
                r.take("I")
            if version >= 11:
                r.guid()
                r.take("i")
            if version >= 12:
                r.take("B")
            if guid:
                out.append((guid, pos, rot, scale))
    return out


def read_trees_dat(path):
    """Terrain/Trees.dat (LevelGround.load, wersja >= 7): lista (guid, pozycja, obrót Euler, skala)."""
    r = Reader(open(path, "rb").read())
    version = r.take("B")[0]
    if version < 7:
        return []
    out = []
    for _ in range(r.take("i")[0]):
        guid = r.guid()
        pos = r.take("3f")
        if version >= 8:
            rot, scale = r.take("3f"), r.take("3f")
        else:
            rot, scale = (0.0, 0.0, 0.0), (1.0, 1.0, 1.0)
        r.take("B")
        if guid:
            out.append((guid, pos, rot, scale))
    return out


def scan_scenery(bundles):
    """GUID -> (rodzaj, klucz prefabu w core.masterbundle, nazwa) dla obiektów i drzew."""
    out = {}
    for group, kind, prefab in (("Objects", "object", "object.prefab"), ("Trees", "tree", "resource.prefab")):
        for root, _, files in os.walk(os.path.join(bundles, group)):
            for fn in files:
                if not fn.endswith(".dat") or fn == "English.dat":
                    continue
                text = read_text(os.path.join(root, fn))
                g = re.search(r"^GUID\s+(\w+)", text, re.M)
                t = re.search(r"^Type\s+(\w+)", text, re.M)
                if not g or (t and t.group(1).lower() in ("decal", "npc")):
                    continue
                rel = os.path.relpath(root, bundles).replace("\\", "/").lower()
                out[g.group(1).lower()] = (kind, f"assets/coremasterbundle/{rel}/{prefab}", os.path.basename(root))
    return out


def export_cutout_texture(tex_ptr):
    """Tekstura części wycinanej alfą w public/game/scenery/tex (wspólna dla modeli). Zwraca ścieżkę względną."""
    name = f"tex/{tex_ptr.path_id & 0xFFFFFFFFFFFFFFFF:x}.png"
    path = os.path.join(PUBLIC, "game", "scenery", name)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tex_ptr.read().image.convert("RGBA").save(path, optimize=True)
    return name


def export_scenery_model(env, key, out_path):
    """
    Model obiektu/drzewa w układzie three.js, bez obrotu korzenia (nadaje go instancja).
    "cut": części z teksturą wycinaną alfą (liście), po jednej na teksturę: t (plik), a (próg alfy), p, uv, i.
    """
    if key not in env.container:
        return False
    cutouts = []
    parts = collect_meshes(env.container[key].read(), root_rotation=False, cutouts=cutouts)
    if not parts and not cutouts:
        return False
    out = {"p": [], "i": [], "c": []}
    if parts:
        verts, faces, cols, offset = [], [], [], 0
        for v, f, c in parts:
            verts.append(v)
            faces.append(f + offset)
            cols.append(c)
            offset += len(v)
        out["p"] = [round(float(x), 3) for x in to_three(np.vstack(verts)).ravel()]
        out["i"] = [int(x) for x in np.vstack(faces)[:, ::-1].ravel()]
        out["c"] = [int(round(x)) for x in np.vstack(cols).ravel()]
    by_tex = {}
    for v, f, uv, tex, cutoff in cutouts:
        by_tex.setdefault(tex.path_id, (tex, cutoff, []))[2].append((v, f, uv))
    cut = []
    for tex, cutoff, items in by_tex.values():
        verts, faces, uvs, offset = [], [], [], 0
        for v, f, uv in items:
            verts.append(v)
            faces.append(f + offset)
            uvs.append(uv)
            offset += len(v)
        cut.append({
            "t": export_cutout_texture(tex),
            "a": round(cutoff, 3),
            "p": [round(float(x), 3) for x in to_three(np.vstack(verts)).ravel()],
            "uv": [round(float(x), 4) for x in np.vstack(uvs).ravel()],
            "i": [int(x) for x in np.vstack(faces)[:, ::-1].ravel()],
        })
    if cut:
        out["cut"] = cut
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    return True


def export_scenery_models(unturned):
    """Ponowny eksport modeli wszystkich typów obiektów i drzew z wyeksportowanych map (nadpisuje pliki)."""
    import UnityPy

    scenery = scan_scenery(os.path.join(unturned, "Bundles"))
    env = UnityPy.load(os.path.join(unturned, "Bundles", "core.masterbundle"))
    guids = set()
    for name in os.listdir(os.path.join(PUBLIC, "maps")):
        path = os.path.join(PUBLIC, "maps", name, "scene.json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                guids |= {t["guid"] for t in json.load(fh)["types"]}
    model_dir = os.path.join(PUBLIC, "game", "scenery")
    done = 0
    for guid in sorted(guids):
        if guid in scenery and export_scenery_model(env, scenery[guid][1], os.path.join(model_dir, f"{guid}.json")):
            done += 1
    print(f"  modele obiektów i drzew: {done}/{len(guids)}")


def export_map_scene(env, map_dir, name, scenery):
    """scene.json mapy + modele typów, których jeszcze nie ma w public/game/scenery."""
    instances = []
    objects_dat = os.path.join(map_dir, "Level", "Objects.dat")
    trees_dat = os.path.join(map_dir, "Terrain", "Trees.dat")
    if os.path.exists(objects_dat):
        instances += read_objects_dat(objects_dat)
    if os.path.exists(trees_dat):
        instances += read_trees_dat(trees_dat)

    model_dir = os.path.join(PUBLIC, "game", "scenery")
    os.makedirs(model_dir, exist_ok=True)
    types, type_index, inst, missing = [], {}, [], 0
    for guid, pos, rot, scale in instances:
        if guid not in type_index:
            entry = scenery.get(guid)
            ok = False
            if entry:
                path = os.path.join(model_dir, f"{guid}.json")
                ok = os.path.exists(path) or export_scenery_model(env, entry[1], path)
            type_index[guid] = len(types) if ok else -1
            if ok:
                types.append({"guid": guid, "kind": entry[0], "name": entry[2]})
        t = type_index[guid]
        if t < 0:
            missing += 1
            continue
        inst.append([t] + [round(x, 2) for x in pos] + [round(x, 1) for x in rot] + [round(x, 3) for x in scale])
    with open(os.path.join(PUBLIC, "maps", name, "scene.json"), "w", encoding="utf-8") as fh:
        json.dump({"types": types, "inst": inst}, fh, separators=(",", ":"))
    print(f"  scena {name}: {len(inst)} instancji, {len(types)} typów, pominięte {missing}")


def read_clip_volumes(map_dir):
    """PlayerClipVolume z Level.hierarchy: strefy, w których gra blokuje budowanie."""
    path = os.path.join(map_dir, "Level.hierarchy")
    if not os.path.exists(path):
        return []
    text = read_text(path)
    out = []
    for block in text.split('"Type" "')[1:]:
        if not block.startswith("SDG.Framework.Devkit.PlayerClipVolume"):
            continue
        def vec(label, keys):
            m = re.search('"%s"\\s*\\{(.*?)\\}' % label, block, re.S)
            vals = dict(re.findall(r'"(\w)"\s*"([-\d.eE]+)"', m.group(1))) if m else {}
            return [float(vals.get(k, 0)) for k in keys]
        out.append({
            "p": vec("Position", "XYZ"),
            "r": vec("Rotation", "XYZW"),
            "s": vec("Scale", "XYZ"),
        })
    return out


# ---------------------------------------------------------------- mapy

SIZES = {0: 512, 1: 1024, 2: 2048, 3: 4096, 4: 8192}


def export_map(map_dir, name):
    land = os.path.join(map_dir, "Landscape", "Heightmaps")
    level_dat = os.path.join(map_dir, "Level.dat")
    map_png = os.path.join(map_dir, "Map.png")
    if not (os.path.isdir(land) and os.path.exists(level_dat) and os.path.exists(map_png)):
        return None

    raw = open(level_dat, "rb").read()
    size = SIZES.get(raw[-2] if raw[0] >= 2 else raw[-1])
    if not size:
        return None
    # Map.png obejmuje poziom bez ramki 64 m z każdej strony (sprawdzone na Russia i Germany).
    extent = size - 128 if size >= 1024 else size - 32

    tiles = {}
    for fn in os.listdir(land):
        m = re.match(r"Tile_(-?\d+)_(-?\d+)_Source\.heightmap", fn)
        if m:
            tiles[(int(m.group(1)), int(m.group(2)))] = os.path.join(land, fn)

    # Siatka wysokości co 4 m (natywna rozdzielczość kafla 1024 m / 256).
    n = extent // 4 + 1
    half = extent / 2
    grid = np.zeros((n, n), np.float32)  # [wiersz = północ->południe, kolumna = zachód->wschód]
    cache = {}
    for r in range(n):
        wz = half - r * 4
        # Wiersz kafla rośnie z południa na północ (sprawdzone z Map.png).
        tz = math.floor(wz / 1024)
        local_z = int(round((wz - tz * 1024) / 4))
        for c in range(n):
            wx = -half + c * 4
            tx = math.floor(wx / 1024)
            local_x = int(round((wx - tx * 1024) / 4))
            key = (tx, tz)
            if key not in cache:
                if key not in tiles:
                    cache[key] = None
                else:
                    cache[key] = np.fromfile(tiles[key], dtype=">u2").reshape(257, 257).astype(np.float32) / 65535.0 * 2048 - 1024
            t = cache[key]
            grid[r, c] = t[local_z, local_x] if t is not None else 0

    lo, hi = float(grid.min()), float(grid.max())
    q = np.round((grid - lo) / max(hi - lo, 1e-6) * 65535).astype("<u2")

    sea = None
    lighting = os.path.join(map_dir, "Environment", "Lighting.dat")
    if os.path.exists(lighting):
        b = open(lighting, "rb").read()
        if len(b) > 22:
            v = struct.unpack_from("<f", b, 18)[0]
            if 0 < v < 0.99:
                sea = round(v * 256, 3)  # poziom morza w metrach (Level.TERRAIN = 256)

    out = os.path.join(PUBLIC, "maps", name)
    os.makedirs(os.path.join(out, "tiles"), exist_ok=True)
    q.tofile(os.path.join(out, "height.bin"))

    img = Image.open(map_png).convert("RGB")
    tile_px = 512
    full = 4096 if size >= 4096 else 2048
    img = img.resize((full, full), Image.LANCZOS)
    count = full // tile_px
    for ty in range(count):
        for tx in range(count):
            img.crop((tx * tile_px, ty * tile_px, (tx + 1) * tile_px, (ty + 1) * tile_px)).save(
                os.path.join(out, "tiles", f"{tx}_{ty}.jpg"), quality=85, optimize=True)
    img.resize((1024, 1024), Image.LANCZOS).save(os.path.join(out, "overview.jpg"), quality=85, optimize=True)

    config_path = os.path.join(map_dir, "Config.json")
    config = read_text(config_path) if os.path.exists(config_path) else ""
    # LevelInfo.cs: Use_Legacy_Oxygen_Height domyślnie true; Germany ma false.
    oxygen = re.search(r'"Use_Legacy_Oxygen_Height"\s*:\s*false', config) is None

    meta = {
        "id": name,
        "name": name.replace("_", " "),
        "size": size,
        "extent": extent,
        "grid": n,
        "cell": 4,
        "heightMin": round(lo, 3),
        "heightMax": round(hi, 3),
        "seaLevel": sea,
        "tiles": count,
        # Level.isPointWithinValidHeight: budowanie dozwolone dla -1024 <= y <= 1024 (świat gry)
        "heightLimit": 1024,
        # PlayerLife.SimulateOxygenFrame: tlen spada powyżej połowy drogi od wody do 1024 m
        "oxygen": oxygen,
        "oxygenLine": round((sea or 0) + (1024 - (sea or 0)) / 2, 1) if oxygen else None,
        "clipVolumes": read_clip_volumes(map_dir),
    }
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(f"  mapa {name}: {size} m, zasięg {extent} m, siatka {n}x{n}, woda {sea}")
    return meta


# ---------------------------------------------------------------- tekstury terenu (splatmapy)
#
# Według kodu gry (LandscapeTile.cs, LandscapeMaterialAsset.cs, Landscape.cs):
#  - kafel 1024 m; splatmapa 256 x 256 punktów (co 4 m), 8 warstw, bajty w kolejności [z][x][warstwa]
#  - lista 8 materiałów kafla jest w Level.hierarchy (Tiles -> Materials -> GUID)
#  - materiał (LandscapeMaterialAsset .asset) wskazuje teksturę w paczce; powtarza się co szerokość_px * 0.25 m

SPLAT_RES = 256
SPLAT_LAYERS = 8


def scan_landscape_materials(bundles):
    """GUID materiału terenu -> ścieżka tekstury w core.masterbundle."""
    out = {}
    for root, _, files in os.walk(bundles):
        for fn in files:
            if not fn.endswith(".asset"):
                continue
            text = read_text(os.path.join(root, fn))
            if "LandscapeMaterialAsset" not in text:
                continue
            guid = re.search(r"GUID\s+([0-9a-fA-F]{32})", text)
            tex = re.search(r"Texture\s*\{[^}]*?Name\s+([^\r\n]+)[^}]*?Path\s+([^\r\n]+)", text, re.S)
            if guid and tex and tex.group(1).strip() == "core.masterbundle":
                out[guid.group(1).lower()] = tex.group(2).strip()
    return out


def read_landscape_tiles(map_dir):
    """(x, y) kafla -> lista 8 GUID materiałów z Level.hierarchy."""
    text = read_text(os.path.join(map_dir, "Level.hierarchy"))
    tiles = {}
    for m in re.finditer(r'"Coord"\s*\{\s*"X"\s*"(-?\d+)"\s*"Y"\s*"(-?\d+)"\s*\}\s*"Materials"\s*\[(.*?)\]', text, re.S):
        guids = re.findall(r'"GUID"\s*"([0-9a-fA-F]*)"', m.group(3))
        tiles[(int(m.group(1)), int(m.group(2)))] = [g.lower() for g in guids]
    return tiles


def export_terrain(env, map_dir, name, extent, materials):
    """Wagi materiałów na siatce wysokości (co 4 m) jako PNG RGBA (4 warstwy na plik) + tekstury warstw."""
    splat_dir = os.path.join(map_dir, "Landscape", "Splatmaps")
    if not os.path.isdir(splat_dir):
        return None
    tiles = read_landscape_tiles(map_dir)

    # Warstwy mapy: unia materiałów ze wszystkich kafli, w kolejności wystąpienia
    layers = []
    for key in sorted(tiles):
        for g in tiles[key]:
            if g in materials and g not in layers:
                layers.append(g)
    if not layers:
        return None

    n = extent // 4 + 1
    half = extent / 2
    weights = np.zeros((n, n, len(layers)), np.float32)
    cache = {}
    for r in range(n):
        wz = half - r * 4
        tz = math.floor(wz / 1024)
        lz = min(SPLAT_RES - 1, int((wz - tz * 1024) / 4))
        for c in range(n):
            wx = -half + c * 4
            tx = math.floor(wx / 1024)
            lx = min(SPLAT_RES - 1, int((wx - tx * 1024) / 4))
            key = (tx, tz)
            if key not in cache:
                path = os.path.join(splat_dir, f"Tile_{tx}_{tz}_Source.splatmap")
                if not os.path.exists(path) or key not in tiles:
                    cache[key] = None
                else:
                    raw = np.fromfile(path, dtype=np.uint8).reshape(SPLAT_RES, SPLAT_RES, SPLAT_LAYERS)
                    # kanał kafla -> indeks warstwy mapy (albo -1, gdy materiał bez tekstury)
                    slots = [layers.index(g) if g in layers else -1 for g in tiles[key]]
                    cache[key] = (raw, slots)
            entry = cache[key]
            if entry is None:
                continue
            raw, slots = entry
            for k, li in enumerate(slots[:SPLAT_LAYERS]):
                if li >= 0:
                    weights[r, c, li] += raw[lz, lx, k] / 255.0

    out = os.path.join(PUBLIC, "maps", name)
    count = (len(layers) + 3) // 4
    for i in range(count):
        chunk = np.zeros((n, n, 4), np.uint8)
        part = weights[:, :, i * 4:(i + 1) * 4]
        chunk[:, :, :part.shape[2]] = np.clip(np.round(part * 255), 0, 255).astype(np.uint8)
        Image.fromarray(chunk, "RGBA").save(os.path.join(out, f"splat_{i}.png"), optimize=True)

    tex_dir = os.path.join(PUBLIC, "game", "terrain")
    os.makedirs(tex_dir, exist_ok=True)
    info = []
    for g in layers:
        path = materials[g]
        key = "assets/coremasterbundle/" + path.lower()
        tex_name = path.lower().replace("terrain/materials/", "").rsplit(".", 1)[0].replace("/", "_")
        size = 16.0
        if key in env.container:
            img = env.container[key].read().image.convert("RGBA")
            size = img.width * 0.25  # LandscapeMaterialAsset.getOrCreateLayer
            img.save(os.path.join(tex_dir, f"{tex_name}.png"))
        info.append({"tex": tex_name, "size": size})
    print(f"  teren {name}: {len(layers)} warstw, {count} plików wag")
    return {"layers": info, "splats": count}


# ---------------------------------------------------------------- drogi
#
# Według kodu gry (LevelRoads.cs, Road.cs, RoadMaterial.cs, RoadAsset.cs):
#  - Environment/Roads.dat: parametry materiałów (pół szerokości, wysokość tekstury, pół wysokości, przesunięcie, beton)
#  - Environment/Roads.unity3d: tekstury materiałów; numer materiału = kolejność loadAll, czyli po ścieżce w paczce
#  - Environment/Paths.dat: drogi (punkty z dwiema stycznymi, tryb, przesunięcie, "ignoruj teren")
#  - nowsze drogi wskazują RoadAsset (GUID) z własną szerokością i teksturą w core.masterbundle
# Siatkę drogi buduje przeglądarka (te same wysokości terenu co scena), tu tylko dane.

def scan_road_assets(bundles):
    """GUID RoadAsset -> parametry (Width, Depth, OffsetAlongNormal, RepeatDistanceScale, TexturePath)."""
    out = {}
    for root, _, files in os.walk(bundles):
        for fn in files:
            if not fn.endswith(".asset"):
                continue
            text = read_text(os.path.join(root, fn))
            if not re.search(r"^\s*Type\s+Road\s*$", text, re.M):
                continue
            g = re.search(r"GUID\s+([0-9a-fA-F]{32})", text)
            num = lambda k, d=0.0: float(m.group(1)) if (m := re.search(rf"^\s*{k}\s+([-\d.eE]+)", text, re.M)) else d
            tex = re.search(r"^\s*TexturePath\s+(\S+)", text, re.M)
            if g and tex:
                out[g.group(1).lower()] = {
                    "width": num("Width"), "depth": num("Depth"), "offset": num("OffsetAlongNormal"),
                    "repeat": num("RepeatDistanceScale", 1.0), "texture": tex.group(1),
                }
    return out


def export_roads(env, map_dir, name, road_assets):
    """public/maps/<Mapa>/roads.json + tekstury dróg."""
    env_dir = os.path.join(map_dir, "Environment")
    paths_dat = os.path.join(env_dir, "Paths.dat")
    if not os.path.exists(paths_dat):
        return False
    import UnityPy

    out_dir = os.path.join(PUBLIC, "maps", name)
    tex_dir = os.path.join(out_dir, "roads")
    os.makedirs(tex_dir, exist_ok=True)

    # Tekstury starych materiałów: kolejność jak AssetBundle.LoadAllAssets (kontener posortowany po ścieżce)
    legacy_tex = []
    bundle = os.path.join(env_dir, "Roads.unity3d")
    if os.path.exists(bundle):
        renv = UnityPy.load(bundle)
        for key in sorted(renv.container):
            obj = renv.container[key]
            if obj.type.name == "Texture2D":
                legacy_tex.append(obj.read().image.convert("RGBA"))

    materials = []
    roads_dat = os.path.join(env_dir, "Roads.dat")
    params = []
    if os.path.exists(roads_dat):
        r = Reader(open(roads_dat, "rb").read())
        ver = r.take("B")[0]
        if ver > 0:
            for _ in range(r.take("B")[0]):
                w, h, d = r.take("3f")
                off = r.take("f")[0] if ver > 1 else 0.0
                r.take("?")
                params.append((w, h, d, off))
    for i, img in enumerate(legacy_tex):
        # RoadMaterial: domyślnie width 4, height 1, depth 0.5, offset 0
        w, h, d, off = params[i] if i < len(params) else (4.0, 1.0, 0.5, 0.0)
        img.save(os.path.join(tex_dir, f"{i}.png"))
        # Road.buildMesh: V rośnie o height / wysokość_tekstury na metr (gdy height == 0: 1 / wysokość_tekstury)
        v_per_m = (h / img.height) if h != 0 else 1.0 / img.height
        materials.append({"tex": f"roads/{i}.png", "halfWidth": w, "halfVert": d, "edge": d * 2, "offset": off, "vPerM": v_per_m})

    p = Reader(open(paths_dat, "rb").read())
    pv = p.take("B")[0]
    roads, assets = [], {}
    if pv > 1:
        for _ in range(p.take("H")[0]):
            n = p.take("H")[0]
            mat = p.take("B")[0]
            loop = p.take("?")[0] if pv > 2 else False
            guid = p.guid() if pv >= 6 else None
            joints = []
            for _ in range(n):
                v = p.take("3f")
                t0, t1 = (p.take("3f"), p.take("3f")) if pv > 2 else ((0, 0, 0), (0, 0, 0))
                if pv > 2:
                    p.take("B")  # tryb stycznych (tylko edytor)
                off = p.take("f")[0] if pv > 4 else 0.0
                ign = p.take("?")[0] if pv > 3 else False
                joints.append([round(x, 3) for x in (*v, *t0, *t1, off)] + [1 if ign else 0])
            if pv < 3 and n > 1:
                # LevelRoads.load: stare drogi bez stycznych dostają styczne 2.5 m wzdłuż sąsiednich punktów
                def unit(a, b):
                    d = [b[k] - a[k] for k in range(3)]
                    l = math.sqrt(sum(x * x for x in d)) or 1
                    return [x / l * 2.5 for x in d]
                for k, j in enumerate(joints):
                    prev = joints[k - 1] if k > 0 else None
                    nxt = joints[k + 1] if k < n - 1 else None
                    j[3:6] = unit(j, nxt) if prev is None else unit(j, prev)
                    j[6:9] = unit(j, prev) if nxt is None else unit(j, nxt)
                    if prev is None:
                        j[3:6] = [-x for x in j[6:9]]
                    if nxt is None:
                        j[6:9] = [-x for x in j[3:6]]
            road = {"m": mat, "loop": loop, "j": joints}
            if guid and guid != "0" * 32 and guid in road_assets:
                road["a"] = guid
                if guid not in assets:
                    ra = road_assets[guid]
                    key = "assets/coremasterbundle/" + ra["texture"].lower()
                    if key in env.container:
                        img = env.container[key].read().image.convert("RGBA")
                        img.save(os.path.join(tex_dir, f"{guid}.png"))
                        # RoadAsset: V = dystans / (Width * wys/szer tekstury * RepeatDistanceScale)
                        v_per_m = 1.0 / max(1e-6, ra["width"] * (img.height / img.width) * ra["repeat"])
                        assets[guid] = {"tex": f"roads/{guid}.png", "halfWidth": ra["width"] / 2, "halfVert": ra["depth"] / 2,
                                        "edge": ra["depth"], "offset": ra["offset"], "vPerM": v_per_m}
                if guid not in assets:
                    del road["a"]
            roads.append(road)

    with open(os.path.join(out_dir, "roads.json"), "w", encoding="utf-8") as f:
        json.dump({"materials": materials, "assets": assets, "roads": roads}, f, separators=(",", ":"))
    print(f"  drogi {name}: {len(roads)} dróg, {len(materials)} materiałów, {len(assets)} typów RoadAsset")
    return True


# ---------------------------------------------------------------- strefy bez budowania
#
# UseableHousingUtils.IsPendingPositionValid:
#  - SafezoneVolume z No_Buildables (Level.hierarchy; kula: skala = średnica, prostopadłościan: skala = rozmiar)
#  - stare węzły SAFEZONE z Environment/Nodes.dat (wersja < 8 jest konwertowana na wolumeny przy wczytaniu)
#  - LevelPlayers.checkCanBuild: odległość od spawnu graczy < Prevent_Building_Near_Spawnpoint_Radius (domyślnie 16 m)

def read_safezones(map_dir):
    out = []
    path = os.path.join(map_dir, "Level.hierarchy")
    if os.path.exists(path):
        text = read_text(path)
        for block in text.split('"Type" "')[1:]:
            if not block.startswith("SDG.Unturned.SafezoneVolume"):
                continue
            if re.search(r'"No_Buildables"\s*"false"', block):
                continue
            def vec(label, keys):
                m = re.search('"%s"\\s*\\{(.*?)\\}' % label, block, re.S)
                vals = dict(re.findall(r'"(\w)"\s*"([-\d.eE]+)"', m.group(1))) if m else {}
                return [float(vals.get(k, 0)) for k in keys]
            shape = re.search(r'"Shape"\s*"(\w+)"', block)
            out.append({"shape": (shape.group(1).lower() if shape else "box"), "p": vec("Position", "XYZ"),
                        "r": vec("Rotation", "XYZW"), "s": vec("Scale", "XYZ")})
    nodes = os.path.join(map_dir, "Environment", "Nodes.dat")
    if os.path.exists(nodes):
        r = Reader(open(nodes, "rb").read())
        ver = r.take("B")[0]
        if 0 < ver < 8:
            try:
                for _ in range(r.take("B")[0]):
                    p = r.take("3f")
                    kind = r.take("B")[0]
                    if kind == 0:  # LOCATION (nazwa: bajt długości + UTF-8)
                        length = r.take("B")[0]
                        r.o += length
                    elif kind == 1:  # SAFEZONE
                        radius = r.take("f")[0]
                        height = r.take("?")[0] if ver > 1 else False
                        r.take("?") if ver > 4 else None
                        no_build = r.take("?")[0] if ver > 4 else True
                        if no_build:
                            # SafezoneNode: promień = lerp(32, 1024, znormalizowany) / 2
                            real = (32 + (1024 - 32) * radius) / 2
                            out.append({"shape": "cylinder" if height else "sphere", "p": list(p), "r": [0, 0, 0, 1], "s": [real * 2] * 3})
                    elif kind == 2:  # PURCHASE
                        r.take("f"); r.take("H"); r.take("I")
                    elif kind in (3, 4):  # ARENA, DEADZONE
                        r.take("f")
                        if kind == 4 and ver > 6:
                            r.take("B")
                    elif kind == 5:  # AIRDROP
                        r.take("H")
                    elif kind == 6:  # EFFECT
                        if ver > 2:
                            r.take("B")
                        r.take("f")
                        if ver > 2:
                            r.take("3f")
                        r.take("H"); r.take("?")
                        if ver > 3:
                            r.take("?")
            except struct.error:
                pass
    return out


def read_spawns(map_dir):
    path = os.path.join(map_dir, "Spawns", "Players.dat")
    if not os.path.exists(path):
        return []
    r = Reader(open(path, "rb").read())
    ver = r.take("B")[0]
    if 1 < ver < 3:
        r.take("Q")
    out = []
    for _ in range(r.take("B")[0]):
        p = r.take("3f")
        r.take("B")
        if ver > 3:
            r.take("?")
        out.append([round(v, 2) for v in p])
    return out


def no_build_info(map_dir):
    config_path = os.path.join(map_dir, "Config.json")
    config = read_text(config_path) if os.path.exists(config_path) else ""
    m = re.search(r'"Prevent_Building_Near_Spawnpoint_Radius"\s*:\s*([-\d.]+)', config)
    under = re.search(r'"Use_Underground_Whitelist"\s*:\s*true', config) is not None
    return {
        "safezones": read_safezones(map_dir),
        "spawns": read_spawns(map_dir),
        "spawnRadius": float(m.group(1)) if m else 16.0,
        "undergroundBlocked": under,
    }


def read_lighting(map_dir):
    """
    Environment/Lighting.dat (LevelLighting.load, wersja >= 5): położenie słońca i kolory dla pór dnia
    (świt, południe, zmierzch, północ). Kolory sRGB 0-255 w kolejności ELightingColor, liczby w kolejności ELightingSingle.
    """
    path = os.path.join(map_dir, "Environment", "Lighting.dat")
    if not os.path.exists(path):
        return None
    r = Reader(open(path, "rb").read())
    b = r.take("B")[0]
    azimuth, bias, fade, _time = r.take("4f")
    r.take("B")  # księżyc
    if b < 5:
        return None
    r.take("2f")  # poziom morza, śniegu
    if b > 6:
        r.take("B")
    if b > 10:
        r.take("B")
    if b >= 8:
        r.take("2f")
    if b >= 11:
        r.take("2f")
    times = []
    for _ in range(4):
        if b > 8:
            cols = [list(r.take("3B")) for _ in range(12 if b > 9 else 11)]
            if b <= 9:
                cols.append(cols[3])
            singles = list(r.take("5f"))
        else:
            cols = [list(r.take("3B")) for _ in range(10 if b >= 6 else 9)]
            if b < 6:
                cols.append(cols[2])
            cols += [cols[0], cols[3]]
            singles = list(r.take("4f")) + [0.25]
        if b < 12:
            singles[1] = min(singles[1], 0.33)
        names = ["sun", "sea", "fog", "skySky", "skyEquator", "skyGround", "ambientSky", "ambientEquator", "ambientGround", "clouds", "rays", "particles"]
        times.append({
            "colors": dict(zip(names, cols)),
            "intensity": round(singles[0], 4),
            "fog": round(singles[1], 4),
            "clouds": round(singles[2], 4),
            "shadows": round(singles[3], 4),
            "rays": round(singles[4], 4),
        })
    return {"azimuth": round(azimuth, 3), "bias": round(bias, 4), "fade": round(fade, 4), "times": times}


def export_maps_lighting(unturned):
    """Tylko oświetlenie i strefy: dopisuje "lighting" i "noBuild" do istniejących meta.json."""
    maps_dir = os.path.join(unturned, "Maps")
    for name in sorted(os.listdir(maps_dir)):
        meta_path = os.path.join(PUBLIC, "maps", name, "meta.json")
        if not os.path.exists(meta_path):
            continue
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
        meta["lighting"] = read_lighting(os.path.join(maps_dir, name))
        meta["noBuild"] = no_build_info(os.path.join(maps_dir, name))
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=1)
        print(f"  {name}: oświetlenie {'tak' if meta['lighting'] else 'brak'}, spawny {len(meta['noBuild']['spawns'])}")


def export_maps_terrain(unturned):
    """Tylko tekstury terenu: dopisuje "terrain" do istniejących meta.json (bez eksportu modeli i obiektów)."""
    import UnityPy

    materials = scan_landscape_materials(os.path.join(unturned, "Bundles"))
    road_assets = scan_road_assets(os.path.join(unturned, "Bundles"))
    print(f"  materiały terenu w grze: {len(materials)}, typy dróg: {len(road_assets)}")
    env = UnityPy.load(os.path.join(unturned, "Bundles", "core.masterbundle"))
    maps_dir = os.path.join(unturned, "Maps")
    for name in sorted(os.listdir(maps_dir)):
        meta_path = os.path.join(PUBLIC, "maps", name, "meta.json")
        if not os.path.exists(meta_path):
            continue
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
        meta["terrain"] = export_terrain(env, os.path.join(maps_dir, name), name, meta["extent"], materials)
        meta["roads"] = export_roads(env, os.path.join(maps_dir, name), name, road_assets)
        meta["noBuild"] = no_build_info(os.path.join(maps_dir, name))
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=1)


def export_maps(unturned):
    import UnityPy

    maps_dir = os.path.join(unturned, "Maps")
    scenery = scan_scenery(os.path.join(unturned, "Bundles"))
    print(f"  typy obiektów i drzew w grze: {len(scenery)}")
    env = UnityPy.load(os.path.join(unturned, "Bundles", "core.masterbundle"))
    materials = scan_landscape_materials(os.path.join(unturned, "Bundles"))
    road_assets = scan_road_assets(os.path.join(unturned, "Bundles"))
    index = []
    for name in sorted(os.listdir(maps_dir)):
        try:
            meta = export_map(os.path.join(maps_dir, name), name)
            if meta:
                export_map_scene(env, os.path.join(maps_dir, name), name, scenery)
                meta["terrain"] = export_terrain(env, os.path.join(maps_dir, name), name, meta["extent"], materials)
                meta["roads"] = export_roads(env, os.path.join(maps_dir, name), name, road_assets)
                meta["noBuild"] = no_build_info(os.path.join(maps_dir, name))
                meta["lighting"] = read_lighting(os.path.join(maps_dir, name))
                with open(os.path.join(PUBLIC, "maps", name, "meta.json"), "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=1)
        except Exception as e:  # mapa w innym formacie: pomijamy
            print(f"  mapa {name}: pominięta ({e})")
            continue
        if meta:
            index.append({k: meta[k] for k in ("id", "name", "size", "extent")})
    with open(os.path.join(PUBLIC, "maps", "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1)


# ---------------------------------------------------------------- rekwizyty (barykady)

# Kategorie menu 3D: najpierw po nazwie (Barricade i Freeform mieszają ściany, meble i dekoracje), potem po typie Build.
PROP_NAME_RULES = [
    ("walls", r"Barricade$|Doorframe|Garageframe|Sandbag|Tanktrap|Plate|Frame|Siding|Pipe|Glass|Netting"),
    ("furniture", r"Couch|Table|Chair|Umbrella|Christmas|Ice Castle|Stacked|Dye Vat|Spinning Wheel|Loom"),
    ("farming", r"Planter|^Plot$"),
]
PROP_BUILD_CATEGORY = {
    "Door": "doors", "Gate": "doors", "Shutter": "doors", "Ladder": "doors",
    "Storage": "storage", "Storage_Wall": "storage", "Library": "storage",
    "Fortification": "walls", "Glass": "walls",
    "Sign": "furniture", "Sign_Wall": "furniture", "Note": "furniture", "Clock": "furniture", "Stereo": "furniture",
    "Mannequin": "furniture", "Cage": "furniture",
    "Torch": "light", "Spot": "light", "Campfire": "light", "Oven": "light", "Generator": "light",
    "Farm": "farming", "Barrel_Rain": "farming", "Oil": "farming", "Tank": "farming", "Oxygenator": "farming",
    "Spike": "defense", "Wire": "defense", "Sentry": "defense", "Charge": "defense", "Beacon": "defense",
    "Claim": "defense", "Safezone": "defense",
    "Bed": "beds",
    "Vehicle": "vehicles",
}


STANDING_BUILDS = {"Door", "Gate", "Shutter", "Claim", "Mannequin"}


def keep_props():
    """ID rekwizytów z katalogu planera (src/lib/propCatalog.ts): tylko te trafiają do eksportu."""
    path = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "propCatalog.ts")
    return {int(i) for i in re.findall(r"\[(\d+), '", read_text(path))}


def prop_category(name, build):
    for cat, pattern in PROP_NAME_RULES:
        if name and re.search(pattern, name):
            return cat
    return PROP_BUILD_CATEGORY.get(build, "furniture")


def scan_props(bundles):
    """
    Wszystkie przedmioty stawiane jak barykady (Useable Barricade) poza klapami, które są już strukturami.
    Każdy da się zdobyć w grze: ma przepis albo trafia się w łupach / u handlarzy NPC (sprawdzone na plikach gry).
    """
    guid_item = {}
    found = []
    for root, _, files in os.walk(os.path.join(bundles, "Items")):
        for fn in files:
            if not fn.endswith(".dat") or fn == "English.dat":
                continue
            text = read_text(os.path.join(root, fn))
            g = re.search(r"^GUID\s+(\w+)", text, re.M)
            name = None
            eng = os.path.join(root, "English.dat")
            if os.path.exists(eng):
                m = re.search(r"^Name\s+(.+)$", read_text(eng), re.M)
                name = m.group(1).strip() if m else None
            item_id = re.search(r"^ID\s+(\d+)", text, re.M)
            if g and item_id:
                guid_item[g.group(1).lower()] = {"id": int(item_id.group(1)), "name": name}
            if re.search(r"^Useable\s+Barricade", text, re.M) and not re.search(r"^Build\s+Hatch", text, re.M):
                found.append((root, text, name))
    out = []
    for root, text, name in found:
        build = re.search(r"^Build\s+(\w+)", text, re.M)
        health = re.search(r"^Health\s+(\d+)", text, re.M)
        armor = re.search(r"^Armor_Tier\s+(\w+)", text, re.M)
        build = build.group(1) if build else "Barricade"
        out.append({
            "id": int(re.search(r"^ID\s+(\d+)", text, re.M).group(1)),
            "name": name,
            "folder": os.path.basename(root).lower(),
            "build": build,
            "category": prop_category(name, build),
            "health": int(health.group(1)) if health else None,
            "recipe": parse_recipe(text, guid_item),
            # Armor_Tier z pliku (High/Low); brak = gra wybiera po nazwie (kalkulator raidu, src/lib/raid.ts)
            "armor": armor.group(1).lower() if armor else None,
        })
    return sorted(out, key=lambda s: s["id"]), guid_item


def export_props(unturned):
    """
    public/game/props.json: lista rekwizytów (bez siatek), public/game/props/<id>.json: siatka jednego rekwizytu.
    Siatki osobno, bo jest ich ok. 300: przeglądarka wczytuje tylko te, które są na mapie albo w ręku.
    Konwencja: środek podstawy w (0, 0, 0), spód na y = 0 (stawiane na powierzchni pod celownikiem).
    """
    import UnityPy

    metas, _ = scan_props(os.path.join(unturned, "Bundles"))
    keep = keep_props()
    metas = [m for m in metas if m["id"] in keep]
    print(f"Rekwizyty: {len(metas)}. Wczytywanie core.masterbundle...")
    env = UnityPy.load(os.path.join(unturned, "Bundles", "core.masterbundle"))
    container = env.container
    out_dir = os.path.join(PUBLIC, "game", "props")
    os.makedirs(out_dir, exist_ok=True)
    index = []
    for meta in metas:
        key = f"assets/coremasterbundle/items/barricades/{meta['folder']}/barricade.prefab"
        entry = {k: meta[k] for k in ("id", "name", "build", "category", "health", "recipe", "armor")}
        parts = collect_meshes(container[key].read()) if key in container else []
        if parts:
            verts, faces, cols, offset = [], [], [], 0
            for v, f, c in parts:
                verts.append(v)
                faces.append(f + offset)
                cols.append(c)
                offset += len(v)
            v = to_three(np.vstack(verts))
            f = np.vstack(faces)[:, ::-1]
            c = np.vstack(cols)
            # Drzwi, bramy, okiennice, flaga claimu i manekiny są w prefabie w pozie szkieletu (leżą, "góra" to -Z):
            # stawiamy je obrotem o 90° wokół X. Kierunek sprawdzony na geometrii: płat flagi i ramiona manekina są po -Z.
            if meta["build"] in STANDING_BUILDS and np.ptp(v[:, 1]) < np.ptp(v[:, 2]):
                v = np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1)
            # Drzwi, bramy, okiennice: gra stawia pivot prefabu w slocie otworu (Door, Gate, Slot), więc zapisujemy,
            # jak wysoko nad spodem modelu był pivot (np. drzwi 1,4 m, drzwi podwójne 1,85 m)
            if meta["build"] in ("Door", "Gate", "Shutter", "Glass"):
                entry["pivot"] = round(float(-v[:, 1].min()), 3)
            v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
            v[:, 2] -= (v[:, 2].max() + v[:, 2].min()) / 2
            v[:, 1] -= v[:, 1].min()
            keys, counts = np.unique(np.round(c).astype(int), axis=0, return_counts=True)
            entry["color"] = "#%02x%02x%02x" % tuple(keys[counts.argmax()])
            entry["bounds"] = [[round(float(a), 3) for a in v.min(0)], [round(float(a), 3) for a in v.max(0)]]
            with open(os.path.join(out_dir, f"{meta['id']}.json"), "w", encoding="utf-8") as fh:
                json.dump({
                    "p": [round(float(x), 3) for x in v.ravel()],
                    "i": [int(x) for x in f.ravel()],
                    "c": [int(round(x)) for x in c.ravel()],
                }, fh, separators=(",", ":"))
        index.append(entry)
        status = "model" if "bounds" in entry else "BRAK MODELU"
        print(f"  {meta['id']:5d} {str(meta['name']):<34} {meta['build']:<13} {meta['category']:<10} {status}")
    with open(os.path.join(PUBLIC, "game", "props.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    icons = os.path.join(PUBLIC, "unturned", "items")
    os.makedirs(icons, exist_ok=True)
    missing = 0
    for entry in index:
        path = os.path.join(icons, f"{entry['id']}.png")
        if os.path.exists(path):
            continue
        img = fetch_icon(entry["id"])
        if img is None:
            missing += 1
            continue
        img.save(path)
    print(f"Rekwizyty z modelem: {sum('bounds' in e for e in index)}/{len(index)}, bez ikony: {missing}")


# Ładunki do kalkulatora raidu (src/lib/raid.ts): Structure_Damage i Barricade_Damage z plików .dat.
# 519 to wyrzutnia rakiet: obrażenia jednej rakiety są zapisane na broni.
EXPLOSIVES = [1393, 1241, 519, 1100, 254]


def export_explosives(bundles):
    found = {}
    for root, _, files in os.walk(os.path.join(bundles, "Items")):
        for fn in files:
            if not fn.endswith(".dat") or fn == "English.dat":
                continue
            text = read_text(os.path.join(root, fn))
            item_id = re.search(r"^ID\s+(\d+)", text, re.M)
            if not item_id or int(item_id.group(1)) not in EXPLOSIVES:
                continue
            sd = re.search(r"^Structure_Damage\s+([\d.]+)", text, re.M)
            bd = re.search(r"^Barricade_Damage\s+([\d.]+)", text, re.M)
            found[int(item_id.group(1))] = {
                "structure": float(sd.group(1)) if sd else 0,
                "barricade": float(bd.group(1)) if bd else 0,
            }
    out = [{"id": i, **found[i]} for i in EXPLOSIVES if i in found]
    with open(os.path.join(PUBLIC, "game", "explosives.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"Ładunki: {len(out)}/{len(EXPLOSIVES)}")


# Surowce do budowy (okno Materiały): ID przedmiotów z przepisów struktur w src/lib/builder.ts.
STRUCTURE_RESOURCES = [39, 37, 41, 61, 62, 63, 67, 68, 74]


def export_recipes(unturned):
    """
    Same przepisy, bez modeli (szybko): uzupełnia recipe w public/game/props.json i zapisuje
    public/game/resources.json {id: nazwa} dla wszystkich składników, z ikonami w public/unturned/items.
    """
    metas, guid_item = scan_props(os.path.join(unturned, "Bundles"))
    path = os.path.join(PUBLIC, "game", "props.json")
    index = json.load(open(path, encoding="utf-8"))
    recipes = {m["id"]: m["recipe"] for m in metas}
    armor = {m["id"]: m["armor"] for m in metas}
    for entry in index:
        entry["recipe"] = recipes.get(entry["id"])
        entry["armor"] = armor.get(entry["id"])
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    names = {v["id"]: v["name"] for v in guid_item.values()}
    used = set(STRUCTURE_RESOURCES)
    for r in recipes.values():
        for i in (r or {}).get("inputs", []):
            if i["id"] is not None:
                used.add(i["id"])
    resources = {str(i): names.get(i) for i in sorted(used)}
    with open(os.path.join(PUBLIC, "game", "resources.json"), "w", encoding="utf-8") as fh:
        json.dump(resources, fh, ensure_ascii=False, separators=(",", ":"))
    icons = os.path.join(PUBLIC, "unturned", "items")
    os.makedirs(icons, exist_ok=True)
    missing = []
    for i in sorted(used):
        p = os.path.join(icons, f"{i}.png")
        if os.path.exists(p):
            continue
        img = fetch_icon(i)
        if img is None:
            missing.append(i)
            continue
        img.save(p)
    print(f"Przepisy: {sum(1 for r in recipes.values() if r)}/{len(recipes)}, surowce: {len(used)}, bez ikony: {missing}")
    export_explosives(os.path.join(unturned, "Bundles"))
    for i in EXPLOSIVES:
        p = os.path.join(icons, f"{i}.png")
        if not os.path.exists(p):
            img = fetch_icon(i)
            if img is not None:
                img.save(p)


# Ikony: każdy przedmiot musi mieć ikonę z gry (render ItemTool.getIcon), bez wyjątków i bez własnych.
# Źródła: zbiór UnturnedImages (fetch_icon), a dla nowszych przedmiotów folder z PNG wygenerowanymi w grze
# (<id>.png), podany zmienną UNTURNED_ICONS albo opcją --icons-dir=<folder>. Instrukcja: docs/icons.md.
STRUCTURE_EXTRA_ICONS = [288, 276]  # łóżko (Black Bedroll) i narzędzie wyburzania w przyborniku


def all_item_ids():
    ids = {}
    for path, label in (("structures.json", "struktura"), ("props.json", "rekwizyt")):
        full = os.path.join(PUBLIC, "game", path)
        if os.path.exists(full):
            for e in json.load(open(full, encoding="utf-8")):
                if label == "struktura" or (e.get("bounds") and e.get("name")):
                    ids[e["id"]] = f"{label}: {e.get('name')}"
    res = os.path.join(PUBLIC, "game", "resources.json")
    if os.path.exists(res):
        for k, v in json.load(open(res, encoding="utf-8")).items():
            ids.setdefault(int(k), f"surowiec: {v}")
    for i in EXPLOSIVES + STRUCTURE_EXTRA_ICONS + list(MATERIAL_ICONS.values()):
        ids.setdefault(i, "przybornik")
    return ids


def check_icons():
    """Kopiuje ikony z folderu wygenerowanego w grze, dociąga brakujące z UnturnedImages i kończy błędem, gdy czegoś brak."""
    import shutil

    out_dir = os.path.join(PUBLIC, "unturned", "items")
    os.makedirs(out_dir, exist_ok=True)
    src = os.environ.get("UNTURNED_ICONS") or next((f.split("=", 1)[1] for f in FLAGS if f.startswith("--icons-dir=")), None)
    ids = all_item_ids()
    copied = 0
    if src and os.path.isdir(src):
        for i in ids:
            path = os.path.join(src, f"{i}.png")
            if os.path.exists(path):
                shutil.copyfile(path, os.path.join(out_dir, f"{i}.png"))
                copied += 1
    missing = []
    for i, label in sorted(ids.items()):
        path = os.path.join(out_dir, f"{i}.png")
        if os.path.exists(path):
            continue
        img = fetch_icon(i)
        if img is None:
            missing.append((i, label))
            continue
        img.thumbnail((256, 256), Image.LANCZOS)
        img.save(path, optimize=True)
    print(f"Ikony: {len(ids)} przedmiotów, z folderu gry: {copied}, brak: {len(missing)}")
    if missing:
        for i, label in missing:
            print(f"  BRAK IKONY {i:5d} {label}")
        sys.exit("Nie wszystkie przedmioty mają ikonę z gry (docs/icons.md).")


# Dźwięki drzwi, bram, okiennic i klap jak w grze (InteractableDoor: GetComponent<AudioSource>().Play()
# na modelu tej barykady, ten sam klip przy otwieraniu i zamykaniu). Dla każdego ID: klip z AudioSource
# w barricade.prefab, jego ustawienia (głośność, ton, zasięg) i długość animacji Open/Close.
# Pliki: public/game/sounds/<klip>.wav (wspólny klip zapisany raz) i public/game/sounds.json.
OPENABLE_BUILDS = {"Door", "Gate", "Shutter", "Hatch"}


def scan_openables(bundles):
    out = []
    for root, _, files in os.walk(os.path.join(bundles, "Items", "Barricades")):
        for fn in files:
            if not fn.endswith(".dat") or fn == "English.dat":
                continue
            text = read_text(os.path.join(root, fn))
            build = re.search(r"^Build\s+(\w+)", text, re.M)
            item_id = re.search(r"^ID\s+(\d+)", text, re.M)
            if build and item_id and build.group(1) in OPENABLE_BUILDS:
                name = None
                eng = os.path.join(root, "English.dat")
                if os.path.exists(eng):
                    m = re.search(r"^Name\s+(.+)$", read_text(eng), re.M)
                    name = m.group(1).strip() if m else None
                out.append({"id": int(item_id.group(1)), "name": name, "folder": os.path.basename(root).lower()})
    return sorted(out, key=lambda x: x["id"])


def clip_length(clip):
    """Długość klipu animacji (Legacy Animation): ostatnia klatka kluczowa z krzywych."""
    tt = clip.object_reader.read_typetree()
    times = [kf["time"] for curves in ("m_RotationCurves", "m_PositionCurves", "m_EulerCurves", "m_FloatCurves")
             for cv in tt.get(curves, []) for kf in cv["curve"]["m_Curve"]]
    return round(max(times), 3) if times else None


def export_sounds(unturned):
    import UnityPy

    items = scan_openables(os.path.join(unturned, "Bundles"))
    env = UnityPy.load(os.path.join(unturned, "Bundles", "core.masterbundle"))
    out_dir = os.path.join(PUBLIC, "game", "sounds")
    os.makedirs(out_dir, exist_ok=True)
    data, written, silent = {}, set(), []
    for it in items:
        key = f"assets/coremasterbundle/items/barricades/{it['folder']}/barricade.prefab"
        if key not in env.container:
            silent.append((it["id"], it["name"], "brak prefabu"))
            continue
        entry = {}

        def walk(go):
            for c in go.m_Components:
                comp = c.read() if hasattr(c, "read") else c.component.read()
                kind = comp.object_reader.type.name
                if kind == "AudioSource" and comp.m_audioClip.path_id and "clip" not in entry:
                    tt = comp.object_reader.read_typetree()
                    clip = comp.m_audioClip.read()
                    file = re.sub(r"[^a-z0-9_]+", "_", clip.m_Name.lower())
                    if file not in written:
                        wav = next(iter(clip.samples.values()))
                        with open(os.path.join(out_dir, f"{file}.wav"), "wb") as fh:
                            fh.write(wav)
                        written.add(file)
                    entry.update({
                        "clip": file,
                        "volume": round(float(tt.get("m_Volume", 1)), 3),
                        "pitch": round(float(tt.get("m_Pitch", 1)), 3),
                        "min": round(float(tt.get("MinDistance", 1)), 2),
                        "max": round(float(tt.get("MaxDistance", 500)), 2),
                        # Unity AudioRolloffMode: 0 logarytmiczny, 1 liniowy, 2 własna krzywa
                        "rolloff": int(tt.get("rolloffMode", 0)),
                    })
                if kind == "Animation":
                    for a in comp.m_Animations:
                        if a.path_id:
                            clip = a.read()
                            if clip.m_Name in ("Open", "Close"):
                                entry[clip.m_Name.lower()] = clip_length(clip)
            for ch in go.m_Transform.read().m_Children:
                walk(ch.read().m_GameObject.read())

        walk(env.container[key].read())
        if "clip" not in entry:
            # w grze bez AudioSource przedmiot jest cichy: tu też, bez podstawiania dźwięku innych drzwi
            silent.append((it["id"], it["name"], "bez AudioSource"))
        data[it["id"]] = entry
        print(f"  {it['id']:5d} {str(it['name']):<26} {entry.get('clip', '-'):<16} otw. {entry.get('open')} s")
    with open(os.path.join(PUBLIC, "game", "sounds.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print(f"Dźwięki: {len(written)} plików dla {len(data)} przedmiotów, ciche: {silent}")


# ----------------------------------------------------------------

def main():
    unturned = find_unturned()
    print(f"Unturned: {unturned}")
    if "--lighting" in FLAGS:
        print("Tylko oświetlenie map...")
        export_maps_lighting(unturned)
        print("Gotowe.")
        return
    if "--scenery" in FLAGS:
        print("Tylko modele obiektów i drzew...")
        export_scenery_models(unturned)
        print("Gotowe.")
        return
    if "--terrain" in FLAGS:
        print("Tylko tekstury terenu...")
        export_maps_terrain(unturned)
        print("Gotowe.")
        return
    if "--props" in FLAGS:
        print("Tylko rekwizyty (barykady)...")
        export_props(unturned)
        print("Gotowe.")
        return
    if "--recipes" in FLAGS:
        print("Tylko przepisy i surowce...")
        export_recipes(unturned)
        print("Gotowe.")
        return
    if "--icons" in FLAGS:
        print("Tylko ikony...")
        check_icons()
        print("Gotowe.")
        return
    if "--sounds" in FLAGS:
        print("Tylko dźwięki...")
        export_sounds(unturned)
        print("Gotowe.")
        return
    metas = scan_assets(os.path.join(unturned, "Bundles"))
    print(f"Struktury i klapy: {len(metas)}")
    structures = export_structures(unturned, metas)
    print("Ikony...")
    export_icons(structures)
    print("Rekwizyty...")
    export_props(unturned)
    export_recipes(unturned)
    export_sounds(unturned)
    print("Mapy...")
    export_maps(unturned)
    check_icons()
    print("Gotowe.")


if __name__ == "__main__":
    main()
