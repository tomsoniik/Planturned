/*
  Jedno źródło układu przedmiotów dla okna klocków w Plannerze 2D i ekwipunku w Sandboxie 3D:
  kategorie klocków i ich kolejność, siatka "wiersz = część, kolumna = materiał" (puste miejsce, gdy
  wariantu nie ma w grze), wyszukiwanie w obu językach i kolejność rekwizytów.
*/
import { BED, MATERIALS, findDef, type BuildItem, type MaterialId, type PartId } from './builder';
import { DICTS, itemLabel, type Dict } from './i18n';

export type CategoryId = 'floors' | 'walls' | 'roofs' | 'pillars' | 'stairs' | 'hatches' | 'bed';

/** Kategorie klocków w kolejności z okna 2D. */
export const BLOCK_CATEGORIES: { id: CategoryId; parts: PartId[] }[] = [
  { id: 'floors', parts: ['floor', 'tri_floor'] },
  { id: 'walls', parts: ['wall', 'doorway', 'window', 'garage', 'rampart', 'ramp_wall'] },
  { id: 'roofs', parts: ['roof', 'tri_roof', 'hole', 'tri_hole'] },
  { id: 'pillars', parts: ['pillar', 'post'] },
  { id: 'stairs', parts: ['stairs', 'ramp'] },
  { id: 'hatches', parts: ['hatch'] },
  { id: 'bed', parts: [] },
];

const variant = (part: PartId, m: MaterialId) => findDef(`${m}_${part}`);
const LANGS: Dict[] = [DICTS.pl, DICTS.en];

/** Czy tekst pasuje do części lub materiału w którymkolwiek języku ("metal", "wall", "ściana"). */
function matchesPart(q: string, part: PartId, m: MaterialId) {
  return LANGS.some((d) => d.parts[part].toLowerCase().includes(q) || d.materials[m].toLowerCase().includes(q));
}

export interface BlockRow {
  part: PartId;
  /** Kolumny materiałów: element, null = wariantu nie ma w grze (puste miejsce), undefined = odfiltrowany. */
  cells: (BuildItem | null | undefined)[];
}

export interface BlockSection {
  id: CategoryId;
  rows: BlockRow[];
  bed: boolean;
}

/** Sekcje okna klocków dla filtra kategorii, materiału i tekstu (ten sam wynik w 2D i 3D). */
export function blockSections(category: CategoryId | null, material: MaterialId | null, query: string) {
  const q = query.trim().toLowerCase();
  const mats = material ? MATERIALS.filter((m) => m.id === material) : MATERIALS;
  const bedMatches = !q || LANGS.some((d) => itemLabel(BED, d).toLowerCase().includes(q));
  const sections: BlockSection[] = BLOCK_CATEGORIES.filter((c) => !category || c.id === category)
    .map((c) => {
      if (c.id === 'bed') return { id: c.id, rows: [], bed: !material && bedMatches };
      const rows = c.parts
        .map((part) => ({ part, cells: mats.map((m) => (!q || matchesPart(q, part, m.id) ? variant(part, m.id) ?? null : undefined)) }))
        .filter((r) => r.cells.some((x) => x));
      return { id: c.id, rows, bed: false };
    })
    .filter((s) => s.rows.length > 0 || s.bed);
  const count = sections.reduce((n, s) => n + (s.bed ? 1 : 0) + s.rows.reduce((k, r) => k + r.cells.filter(Boolean).length, 0), 0);
  return { sections, count, columns: material ? 1 : MATERIALS.length };
}

// --- Rekwizyty ---

/** Grupy rekwizytów w ekwipunku: najpierw to, co osadza się w otworach, potem wnętrze bazy. */
export const PROP_GROUP_ORDER = ['doors', 'gates', 'shutters', 'glass', 'ladders', 'storage', 'beds', 'sentries'] as const;

/** Materiał rekwizytu z angielskiej nazwy z gry (Maple Door, Metal Gate...); 99 = bez materiału. */
const PROP_MATERIALS: [RegExp, number][] = [[/\bmaple\b/i, 0], [/\bbirch\b/i, 1], [/\bpine\b/i, 2], [/\bmetal\b/i, 3], [/\bbrick\b/i, 4]];
function propMaterialRank(def: BuildItem) {
  return PROP_MATERIALS.find(([re]) => re.test(def.name))?.[1] ?? 99;
}
const PROP_MATERIAL_IDS: MaterialId[] = ['maple', 'birch', 'pine', 'metal', 'brick'];

/** Szukanie rekwizytu: nazwa polska i angielska oraz materiał w obu językach. */
export function matchesProp(def: BuildItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((def.namePl ?? '').toLowerCase().includes(q) || def.name.toLowerCase().includes(q)) return true;
  const rank = propMaterialRank(def);
  const m = PROP_MATERIAL_IDS[rank];
  return !!m && LANGS.some((d) => d.materials[m].toLowerCase().includes(q));
}
