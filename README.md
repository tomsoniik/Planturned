# Planturned

Planturned to planer baz do gry **Unturned**: rzut 2D ze snapowaniem i scena 3D z oryginalnymi modelami struktur, postawiona na terenie wybranej mapy z gry.

**Demo:** [base-planner-unturned.vercel.app](https://base-planner-unturned.vercel.app)

## Funkcje

- **Rzut 2D** ze snapowaniem fundamentów, ścian, podłóg i dachów do siatki gry.
- **Podgląd 3D** z modelami struktur wyciągniętymi z plików gry (kolory, wytrzymałość, receptury).
- **Teren map** (Russia, Washington, PEI, Germany, Yukon i inne): wysokości, satelita, budynki i drzewa 1:1.
- **Limity budowania**: maksymalna wysokość, granica tlenu i strefy zakazu budowy dla każdej mapy ([docs/sky-limits.md](docs/sky-limits.md)).
- **Projekty** zapisywane w przeglądarce (localStorage), eksport i import pliku `.baseplan.json`.

## Technologie

[Next.js 16](https://nextjs.org) (App Router) · React 19 · TypeScript · [three.js](https://threejs.org) + React Three Fiber / Drei · Zustand · Framer Motion · Phosphor Icons. Hosting: [Vercel](https://vercel.com).

## Uruchomienie

```bash
npm install
npm run export:game   # jednorazowo: dane z lokalnej instalacji gry
npm run dev           # http://localhost:3000
```

## Dane z gry

`npm run export:game` uruchamia `scripts/export_game_data.py`. Skrypt sam znajduje Unturned w bibliotekach Steam.
Ścieżkę można też podać ręcznie: `python scripts/export_game_data.py "D:\Steam\steamapps\common\Unturned"`.

Wymagania: Python 3.10+ oraz `pip install UnityPy numpy pillow`.

Co powstaje (pliki gry, tylko do użytku lokalnego, są w `.gitignore`):

| Ścieżka | Źródło w grze |
| --- | --- |
| `public/game/structures.json` | modele 3D, kolory, wytrzymałość i receptury struktur (`Bundles/core.masterbundle`, `Bundles/Items/Structures/*.dat`) |
| `public/unturned/items/<id>.png` | ikony z [SilKsPlugins/UnturnedImages](https://github.com/SilksPlugins/UnturnedImages) (folder vanilla); brakujące są generowane z ikon tego samego kształtu |
| `public/maps/<Mapa>/height.bin` | wysokości terenu (`Maps/<Mapa>/Landscape/Heightmaps`, co 4 m) |
| `public/maps/<Mapa>/tiles/*.jpg` | satelita z gry (`Maps/<Mapa>/Map.png`) |
| `public/maps/<Mapa>/meta.json` | rozmiar mapy (`Level.dat`), poziom wody (`Environment/Lighting.dat`), limity wysokości i strefy zakazu budowy (`Level.hierarchy`), patrz [docs/sky-limits.md](docs/sky-limits.md) |
| `public/maps/<Mapa>/scene.json` | budynki, obiekty i drzewa 1:1 (`Level/Objects.dat`, `Terrain/Trees.dat`) |
| `public/game/scenery/<guid>.json` | modele obiektów i drzew (LOD0, kolory palety) |

Bez eksportu aplikacja działa dalej: struktury są wtedy proste bryły, a zakładka Teren pokazuje instrukcję.

## Wymiary

Zgodne z modelami gry: podłoga 6 × 6 m, poziom 4,5 m, ściana 5,6 × 4,25 m. W planie 1 m = 10 jednostek.

## Struktura

```
src/app/          strony (landing, lista projektów, edytor /builder/[id])
src/components/   edytor 3D, picker map, scena terenu i obiektów
src/lib/          logika budowania, teren, modele z gry, projekty
src/store/        stan aplikacji (Zustand)
scripts/          eksport danych z instalacji gry
docs/             notatki o mechanice gry
```

## Autor

tomson ([debskitomal@gmail.com](mailto:debskitomal@gmail.com))

Unturned to znak towarowy Smartly Dressed Games. Projekt fanowski, niezwiązany z twórcami gry. Dane z gry nie są częścią repozytorium; wyjątek to dwa tła w `public/art` (ekrany ładowania z gry: Washington Landscape autorstwa Phobia, Campsite autorstwa IamHonk) i znak zombie.
