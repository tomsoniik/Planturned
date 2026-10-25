/*
  Model klocków Untmatica.

  Struktury, ID, kolory, receptury i wymiary pochodzą z plików gry Unturned
  (Bundles/Items/Structures/*.dat i modele z core.masterbundle, patrz scripts/export_game_data.py).
  Ikony: SilKsPlugins/UnturnedImages (folder vanilla), zapisane w public/unturned/items/<id>.png.

  Układ planu: 1 pole podłogi = 60 jednostek = 6 m (10 jednostek na metr). Poziom (floor): wysokość / 4,5 m
  względem punktu odniesienia projektu. W 2D to pełne piętra 0..N, w 3D (sandbox) poziom bierze się z terenu
  albo wysokości, na której stawiasz, więc bywa ułamkowy; poziomy porównujemy z tolerancją. Warstwy:
    - płyty: podłogi (poziom L) oraz dachy, otwory, schody i rampy (Construct Roof, fizycznie na L+1)
    - ściany i ich warianty stoją na krawędziach płyt
    - filary i słupki stoją w narożnikach płyt
*/

export type Shape = 'square' | 'triangle' | 'wall' | 'pillar' | 'hatch' | 'bed' | 'prop' | 'remover';

export type MaterialId = 'maple' | 'birch' | 'pine' | 'metal' | 'brick';

export type PartId =
  | 'floor' | 'tri_floor' | 'roof' | 'tri_roof' | 'hole' | 'tri_hole' | 'stairs' | 'ramp'
  | 'wall' | 'doorway' | 'window' | 'garage' | 'rampart' | 'ramp_wall'
  | 'pillar' | 'post' | 'hatch';

export interface BuildItem {
  id: string;
  name: string;
  shape: Shape;
  part?: PartId;
  material?: MaterialId;
  /** ID przedmiotu w Unturned (ikona, model). */
  gameId?: number;
  icon: string;
  color: string;
  /** Koszt jednego craftu (z pliku .dat). */
  /** Składniki jednego craftu: ID przedmiotu z gry -> ilość. */
  costs: Record<string, number>;
  /** Ile sztuk daje jeden craft (domyślnie 1). */
  craftYield?: number;
  /** Rekwizyt bez przepisu (tylko z łupów albo od handlarza): w Materiałach liczony osobno. */
  noRecipe?: boolean;
  /** Drzwi, bramy, okiennice: wysokość pivotu prefabu nad spodem modelu (stawiany w slocie otworu). */
  pivot?: number;
  /** Armor_Tier z pliku gry (kalkulator raidu); brak = według nazwy, jak w grze. */
  armor?: 'low' | 'high';
  /** Wytrzymałość w grze (Health z pliku .dat). */
  health?: number;
  /** Rekwizyt (barykada z gry): kategoria w ekwipunku 3D. */
  category?: string;
  /** Nazwa po polsku (rekwizyty, propCatalog); bez niej obie wersje pokazują `name`. */
  namePl?: string;
  /** Rekwizyt: wymiary modelu w metrach [szerokość X, wysokość, głębokość Z]. */
  size?: [number, number, number];
  /** Wyznacza obszar claimu jak łóżko (łóżka i flaga claimu z gry). */
  claim?: boolean;
  /** Rekwizyt: typ Build z pliku .dat gry (Door, Gate, Shutter, Storage...). */
  build?: string;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  rotation: number; // stopnie
  customColor?: string;
  floor?: number;
  /** Drzwi, brama, okiennica albo klapa otwarta (klawisz interakcji w 3D). */
  open?: boolean;
}

export const SIDE = 60;
export const TRI_R = (SIDE * Math.sqrt(3)) / 6;
export const TRI_H = (SIDE * Math.sqrt(3)) / 2;
export const BED_CLAIM_RADIUS = 270;
export const FLOORS = [0, 1, 2, 3];
/** Jednostki planu na metr. */
export const UNITS_PER_METER = 10;
/** Wysokość poziomu w grze (od podłogi do dachu), w metrach. */
export const LEVEL_HEIGHT = 4.5;

export const iconUrl = (gameId: number) => `/unturned/items/${gameId}.png`;

export interface MaterialInfo {
  id: MaterialId;
  name: string;
  /** Kolor z tekstury modelu w grze. */
  color: string;
}

export const MATERIALS: MaterialInfo[] = [
  { id: 'maple', name: 'Klon', color: '#917f6d' },
  { id: 'birch', name: 'Brzoza', color: '#aaa596' },
  { id: 'pine', name: 'Sosna', color: '#604d3b' },
  { id: 'metal', name: 'Metal', color: '#919191' },
  { id: 'brick', name: 'Cegła', color: '#933c3a' },
];

export const materialInfo = (id?: MaterialId) => MATERIALS.find((m) => m.id === id);

interface PartInfo {
  id: PartId;
  name: string;
  shape: Shape;
}

/** Kolejność = kolejność w przyborniku i pod klawiszami 1-9. */
export const PARTS: PartInfo[] = [
  { id: 'floor', name: 'Podłoga', shape: 'square' },
  { id: 'wall', name: 'Ściana', shape: 'wall' },
  { id: 'pillar', name: 'Filar', shape: 'pillar' },
  { id: 'roof', name: 'Dach', shape: 'square' },
  { id: 'doorway', name: 'Ściana z drzwiami', shape: 'wall' },
  { id: 'window', name: 'Ściana z oknem', shape: 'wall' },
  { id: 'garage', name: 'Ściana garażowa', shape: 'wall' },
  { id: 'rampart', name: 'Murek', shape: 'wall' },
  { id: 'post', name: 'Słupek', shape: 'pillar' },
  { id: 'tri_floor', name: 'Podłoga trójkątna', shape: 'triangle' },
  { id: 'tri_roof', name: 'Dach trójkątny', shape: 'triangle' },
  { id: 'hole', name: 'Dach z otworem', shape: 'square' },
  { id: 'tri_hole', name: 'Dach trójkątny z otworem', shape: 'triangle' },
  { id: 'hatch', name: 'Klapa', shape: 'hatch' },
  { id: 'stairs', name: 'Schody', shape: 'square' },
  { id: 'ramp', name: 'Rampa', shape: 'square' },
  { id: 'ramp_wall', name: 'Ściana rampy', shape: 'wall' },
];

export const partInfo = (id?: PartId) => PARTS.find((p) => p.id === id);

// ID przedmiotów z gry (Bundles/Items/Structures, klapy z Barricades).
const GAME_IDS: Record<MaterialId, Partial<Record<PartId, number>>> = {
  maple: { floor: 31, doorway: 32, wall: 33, window: 34, roof: 35, pillar: 36, stairs: 316, hole: 319, ramp: 322, rampart: 442, post: 443, garage: 450, tri_floor: 1262, tri_roof: 1266, ramp_wall: 1414, hatch: 1329, tri_hole: 1988 },
  birch: { doorway: 49, floor: 51, pillar: 53, roof: 55, wall: 57, window: 59, stairs: 318, hole: 321, ramp: 323, rampart: 444, post: 447, garage: 452, tri_floor: 1263, tri_roof: 1267, ramp_wall: 1415, hatch: 1330, tri_hole: 1987 },
  pine: { doorway: 50, floor: 52, pillar: 54, roof: 56, wall: 58, window: 60, stairs: 317, hole: 320, ramp: 324, rampart: 445, post: 448, garage: 453, tri_floor: 1264, tri_roof: 1268, ramp_wall: 1416, hatch: 1331, tri_hole: 1989 },
  metal: { floor: 369, doorway: 370, wall: 371, window: 372, roof: 373, pillar: 374, stairs: 375, hole: 376, ramp: 377, rampart: 446, post: 449, garage: 454, tri_floor: 1265, tri_roof: 1269, ramp_wall: 1417, hatch: 1332, tri_hole: 1990 },
  brick: {
    doorway: 1210, garage: 1211, pillar: 1212, post: 1213, rampart: 1214, wall: 1215, window: 1216, ramp_wall: 1418,
    floor: 1979, tri_floor: 1980, hole: 1981, tri_hole: 1982, ramp: 1983, roof: 1984, tri_roof: 1985, stairs: 1986,
  },
};

// Receptury z plików .dat gry (pierwszy blueprint, wynik 1 sztuka).
const WOOD_LOGS: Record<PartId, number> = {
  floor: 3, tri_floor: 2, roof: 3, tri_roof: 2, hole: 3, tri_hole: 2, stairs: 3, ramp: 3,
  wall: 3, doorway: 3, window: 3, garage: 3, rampart: 3, ramp_wall: 3,
  pillar: 2, post: 1, hatch: 0,
};
const METAL_SHEETS: Record<PartId, number> = {
  floor: 5, tri_floor: 3, roof: 5, tri_roof: 3, hole: 5, tri_hole: 3, stairs: 5, ramp: 5,
  wall: 5, doorway: 5, window: 5, garage: 5, rampart: 5, ramp_wall: 5,
  pillar: 3, post: 3, hatch: 1,
};
const BRICKS: Record<PartId, number> = {
  floor: 3, tri_floor: 2, roof: 3, tri_roof: 3, hole: 3, tri_hole: 3, stairs: 3, ramp: 3,
  wall: 3, doorway: 3, window: 3, garage: 3, rampart: 3, ramp_wall: 3,
  pillar: 2, post: 1, hatch: 0,
};

// ID surowców z gry (klucze BuildItem.costs, okno Materiały)
const LOG: Record<'maple' | 'birch' | 'pine', string> = { maple: '39', birch: '37', pine: '41' };
const PLANK: Record<'maple' | 'birch' | 'pine', string> = { maple: '61', birch: '62', pine: '63' };
const METAL_SCRAP = '67', METAL_SHEET = '68', BRICKS_ID = '74';

function recipe(material: MaterialId, part: PartId): Record<string, number> {
  if (material === 'metal') {
    if (part === 'hatch') return { [METAL_SHEET]: 1, [METAL_SCRAP]: 2 };
    return { [METAL_SHEET]: METAL_SHEETS[part] };
  }
  if (material === 'brick') return { [BRICKS_ID]: BRICKS[part] };
  if (part === 'hatch') return { [PLANK[material]]: 4, [METAL_SCRAP]: 1 };
  return { [LOG[material]]: WOOD_LOGS[part] };
}

// Wytrzymałość z plików .dat: [płyty, ściany/filary/słupki].
const HEALTH: Record<MaterialId, [number, number]> = {
  maple: [500, 400],
  birch: [450, 350],
  pine: [550, 450],
  metal: [1300, 1100],
  brick: [1850, 1650],
};
const HATCH_HEALTH: Partial<Record<MaterialId, number>> = { maple: 350, birch: 300, pine: 400, metal: 900 };

export const REMOVER: BuildItem = {
  id: 'remover_tool',
  name: 'Wyburzanie',
  shape: 'remover',
  gameId: 276,
  icon: iconUrl(276),
  color: '#e5484d',
  costs: {},
};

export const BED: BuildItem = {
  id: 'bed',
  name: 'Łóżko (claim)',
  shape: 'bed',
  gameId: 288,
  icon: iconUrl(288),
  color: '#c8473f',
  costs: {},
  // czarny śpiwór nie ma przepisu w grze (łupy)
  noRecipe: true,
};

const STRUCTURES: BuildItem[] = MATERIALS.flatMap((m) =>
  PARTS.filter((p) => GAME_IDS[m.id][p.id] !== undefined).map((p) => {
    const gameId = GAME_IDS[m.id][p.id]!;
    const slab = p.shape === 'square' || p.shape === 'triangle';
    return {
      id: `${m.id}_${p.id}`,
      name: `${p.name} (${m.name.toLowerCase()})`,
      shape: p.shape,
      part: p.id,
      material: m.id,
      gameId,
      icon: iconUrl(gameId),
      color: m.color,
      costs: recipe(m.id, p.id),
      health: p.id === 'hatch' ? HATCH_HEALTH[m.id] : HEALTH[m.id][slab ? 0 : 1],
    };
  }),
);

export const BUILD_ITEMS: BuildItem[] = [REMOVER, BED, ...STRUCTURES];

export const itemsForMaterial = (material: MaterialId) => STRUCTURES.filter((s) => s.material === material);

/** Pasek szybkiego wyboru: 9 slotów, w każdym id elementu albo null (pusty). */
export const HOTBAR_SIZE = 9;
export type Hotbar = (string | null)[];

/** Domyślny pasek nowego projektu: pierwsze elementy klonu, jak dawne klawisze 1-9. */
export const defaultHotbar = (): Hotbar => itemsForMaterial('maple').slice(0, HOTBAR_SIZE).map((i) => i.id);

/** Pasek z zapisu: zawsze 9 slotów, nieznane id jako puste. */
export const normalizeHotbar = (saved: unknown): Hotbar => {
  if (!Array.isArray(saved)) return defaultHotbar();
  return Array.from({ length: HOTBAR_SIZE }, (_, i) => {
    const v = saved[i];
    // rekwizyty wczytują się z eksportu gry później niż pasek: ich id zostają
    return typeof v === 'string' && (findDef(v) || isPropId(v)) ? normalizeItemId(v) : null;
  });
};

/** Stare identyfikatory z pierwszej wersji buildera. */
const LEGACY_IDS: Record<string, string> = {
  f_square: 'metal_floor',
  c_roof: 'metal_roof',
  c_roof_tri: 'metal_tri_roof',
  c_wall: 'metal_wall',
  c_pillar: 'metal_pillar',
  f_bed: 'bed',
};

export const normalizeItemId = (itemId: string) => LEGACY_IDS[itemId] ?? itemId;

const DEF_MAP = new Map(BUILD_ITEMS.map((d) => [d.id, d]));
export const findDef = (itemId: string) => DEF_MAP.get(normalizeItemId(itemId));

/** Rekwizyty (barykady z gry) mają id prop_<ID w grze>; ich definicje dochodzą po wczytaniu public/game/props.json. */
export const isPropId = (itemId: string) => itemId.startsWith('prop_');
export const propItemId = (gameId: number) => `prop_${gameId}`;

/** Dopisuje definicje wczytane w trakcie działania (rekwizyty), żeby findDef je znało. */
export function registerBuildItems(defs: BuildItem[]) {
  defs.forEach((d) => DEF_MAP.set(d.id, d));
}

/** Łóżka i flaga claimu: pokazują obszar, w którym nikt spoza grupy nie zbuduje. */
export const isClaim = (def?: BuildItem) => def?.shape === 'bed' || !!def?.claim;

/** Jak w grze: drzwi tylko w ścianie z drzwiami, bramy w garażowej, okiennice i szyby w ścianie z oknem. */
const DOOR_FRAMES: Record<string, PartId> = { Door: 'doorway', Gate: 'garage', Shutter: 'window', Glass: 'window' };
/** Element osadzany w otworze ściany (drzwi, brama, okiennica, szyba). */
export const isDoorLike = (def?: BuildItem) => def?.shape === 'prop' && !!def.build && def.build in DOOR_FRAMES;
/** Da się otworzyć i zamknąć klawiszem interakcji (szyba stoi na stałe). */
export const isOpenable = (def?: BuildItem) => def?.shape === 'hatch' || (isDoorLike(def) && def!.build !== 'Glass');
export const isGlass = (def?: BuildItem) => def?.shape === 'prop' && def.build === 'Glass';
export const isLadder = (def?: BuildItem) => def?.shape === 'prop' && def.build === 'Ladder';

/**
 * Animacja otwierania jak w grze (klamka na modelu wskazuje zawias):
 * - door: drzwi obracają się o 90° na lewej krawędzi (klamka po prawej),
 * - gate: brama do ściany garażowej unosi się na górnej krawędzi jak brama garażowa (klamka na dole, pośrodku),
 * - double: okiennica i drzwi podwójne to dwa skrzydła na zewnętrznych krawędziach (klamki przy środku),
 * - hatch: klapa w dachu podnosi się na krawędzi.
 */
export type OpenStyle = 'door' | 'gate' | 'double' | 'hatch';
export function openStyle(def?: BuildItem): OpenStyle | null {
  if (!isOpenable(def)) return null;
  if (def!.shape === 'hatch') return 'hatch';
  if (def!.build === 'Shutter' || /doubledoor/i.test(def!.name)) return 'double';
  if (def!.build === 'Gate') return 'gate';
  return 'door';
}

// --- Otwory w dachu: klapy i drabiny ---

export const isHole = (def?: BuildItem) => def?.part === 'hole' || def?.part === 'tri_hole';
/** Otwór w modelach z gry: kwadrat 1,6 m; w trójkątnym dachu przesunięty o 0,267 m od środka ku podstawie (lokalne +Z). */
const HOLE_HALF = 0.8;
const TRI_HOLE_SHIFT = 0.267;
/** Drabina z gry: 4,25 m wysokości, 0,19 m grubości. */
const LADDER_HEIGHT = 4.25;
const LADDER_HALF_DEPTH = 0.094;

/** Punkt lokalnego układu elementu (m, oś Z jak w modelu 3D) w układzie planu. */
function localToPlan(item: PlacedItem, lx: number, lz: number): Point {
  const r = (item.rotation * Math.PI) / 180;
  return {
    x: item.x + (lx * Math.cos(r) - lz * Math.sin(r)) * UNITS_PER_METER,
    y: item.y + (lx * Math.sin(r) + lz * Math.cos(r)) * UNITS_PER_METER,
  };
}

/** Środek otworu dachu w planie. */
export function holeOpening(hole: PlacedItem, def: BuildItem): Point {
  return localToPlan(hole, 0, def.part === 'tri_hole' ? TRI_HOLE_SHIFT : 0);
}

/**
 * Drabina w otworze dachu (kwadratowym albo trójkątnym): stoi przy krawędzi otworu, plecami do niej, od podłogi
 * poziomu niżej do spodu klapy, więc wchodzi się nią prosto przez otwór. Otwór najbliżej celownika (do 8 m,
 * ok. 25° od osi, jak sloty ścian). Domyślnie przy krawędzi naprzeciw gracza, R przekłada na kolejną.
 */
export function findLadderSlot(def: BuildItem, items: PlacedItem[], ray: AimRay, turn: number) {
  let best: { hole: PlacedItem; at: Point } | null = null;
  let bestScore = SLOT_RANGE * SLOT_RANGE;
  const m = 1 / UNITS_PER_METER;
  for (const item of items) {
    const d = findDef(item.itemId);
    if (!isHole(d)) continue;
    const at = holeOpening(item, d!);
    const dx = at.x * m - ray.origin.x;
    const dy = ((item.floor || 0) + 1) * LEVEL_HEIGHT - ray.origin.y;
    const dz = at.y * m - ray.origin.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > SLOT_RANGE * SLOT_RANGE) continue;
    const cos = (dx * ray.dir.x + dy * ray.dir.y + dz * ray.dir.z) / Math.sqrt(d2);
    if (cos < SLOT_COSINE) continue;
    const score = (1 - cos) * d2;
    if (score < bestScore) {
      best = { hole: item, at };
      bestScore = score;
    }
  }
  if (!best) return null;
  const { hole, at } = best;
  // krawędź naprzeciw gracza: kierunek drabiny (lokalne +Z) najbliżej kierunku patrzenia
  let edge = 0, dot = -Infinity;
  for (let k = 0; k < 4; k++) {
    const r = ((hole.rotation + k * 90) * Math.PI) / 180;
    const v = -Math.sin(r) * ray.dir.x + Math.cos(r) * ray.dir.z;
    if (v > dot) {
      dot = v;
      edge = k;
    }
  }
  const rotation = normalizeAngle(hole.rotation + ((edge + turn) % 4) * 90);
  const r = (rotation * Math.PI) / 180;
  const inset = HOLE_HALF - LADDER_HALF_DEPTH - 0.02;
  const preview: PlacedItem = {
    id: 'preview',
    itemId: def.id,
    x: Math.round((at.x - Math.sin(r) * inset * UNITS_PER_METER) * 100) / 100,
    y: Math.round((at.y + Math.cos(r) * inset * UNITS_PER_METER) * 100) / 100,
    rotation,
    // góra drabiny 0,1 m pod otworem (zamknięta klapa leży nad nią)
    floor: roundLevel((hole.floor || 0) + (LEVEL_HEIGHT - 0.1 - LADDER_HEIGHT) / LEVEL_HEIGHT),
  };
  const taken = items.some(
    (o) => isLadder(findDef(o.itemId)) && Math.hypot(o.x - preview.x, o.y - preview.y) < 3 && Math.abs((o.floor || 0) - preview.floor!) < 0.1,
  );
  return { preview, valid: !taken };
}

// Ściany z gry (structures.json): spód 0,125 m nad poziomem, wysokość 4,25 m, środek 2,13 m nad spodem.
const WALL_BOTTOM = 0.125;
const WALL_HALF = 2.13;
// Slot w prefabie ściany (obiekt Door, Gate albo Slot), w którym gra stawia pivot drzwi, bramy albo okiennicy:
// wysokość nad spodem ściany, taka sama dla wszystkich materiałów. Pivot drzwi jest w połowie ich wysokości,
// więc drzwi 2,8 m stoją 6 cm nad progiem i chowają górę we framudze (otwór ma 2,84 m), jak w grze.
const SLOT_HEIGHT: Partial<Record<PartId, number>> = { doorway: 1.463, garage: 1.965, window: 2.14 };

/**
 * Miejsce dla drzwi, bramy albo okiennicy: otwór pasującej ściany najbliżej celownika (do 8 m, ok. 25° od osi,
 * jak sloty ścian), więc działa także gdy promień leci przez pusty otwór. Pivot elementu trafia w slot otworu,
 * jak w grze. turn (R) odwraca element o 180°, czyli na drugą stronę ściany. Zajęty otwór = nie pasuje.
 */
export function findDoorSlot(def: BuildItem, items: PlacedItem[], ray: AimRay, turn: number) {
  const part = def.build ? DOOR_FRAMES[def.build] : undefined;
  if (!part) return null;
  const m = 1 / UNITS_PER_METER;
  let best: PlacedItem | null = null;
  let bestScore = SLOT_RANGE * SLOT_RANGE;
  for (const item of items) {
    if (findDef(item.itemId)?.part !== part) continue;
    const dx = item.x * m - ray.origin.x;
    const dy = (item.floor || 0) * LEVEL_HEIGHT + WALL_BOTTOM + WALL_HALF - ray.origin.y;
    const dz = item.y * m - ray.origin.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > SLOT_RANGE * SLOT_RANGE) continue;
    const cos = (dx * ray.dir.x + dy * ray.dir.y + dz * ray.dir.z) / Math.sqrt(d2);
    if (cos < SLOT_COSINE) continue;
    const score = (1 - cos) * d2;
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best) return null;
  const height = def.size?.[1] ?? 2.8;
  const bottom = WALL_BOTTOM + (SLOT_HEIGHT[part] ?? WALL_HALF) - (def.pivot ?? height / 2);
  const floor = roundLevel((best.floor || 0) + bottom / LEVEL_HEIGHT);
  const preview: PlacedItem = {
    id: 'preview',
    itemId: def.id,
    x: best.x,
    y: best.y,
    rotation: normalizeAngle(best.rotation + (turn % 2) * 180),
    floor,
  };
  const taken = items.some(
    (o) => isDoorLike(findDef(o.itemId)) && Math.hypot(o.x - best!.x, o.y - best!.y) < 3 && Math.abs((o.floor || 0) - floor) < 0.1,
  );
  return { preview, valid: !taken };
}

/** W grze dachy, otwory, schody i rampy to Construct Roof: stoją na wysokości dachu danego poziomu. */
export const isRoofLayer = (def?: BuildItem) =>
  def?.part === 'roof' || def?.part === 'tri_roof' || def?.part === 'hole' || def?.part === 'tri_hole' ||
  def?.part === 'stairs' || def?.part === 'ramp';
export const isSlab = (def?: BuildItem) => def?.shape === 'square' || def?.shape === 'triangle';
export const isFloorPart = (def?: BuildItem) => def?.part === 'floor' || def?.part === 'tri_floor';

/** Ten sam poziom (tolerancja ok. 9 cm: poziomy z terenu są ułamkowe). */
export const sameLevel = (a: number, b: number) => Math.abs(a - b) < 0.02;
/** Poziom zaokrąglony do 1/1000 (4,5 mm), żeby zapis był krótki i stały. */
export const roundLevel = (v: number) => Math.round(v * 1000) / 1000;
/** Piętro w planie 2D: najbliższy pełny poziom. */
export const planFloor = (item: PlacedItem) => Math.round(item.floor || 0);
/** Fizyczny poziom płyty: dach z poziomu L leży tam, gdzie podłoga z L+1. */
export const slabLevel = (item: PlacedItem, def: BuildItem) => (item.floor || 0) + (isRoofLayer(def) ? 1 : 0);

// --- Geometria ---

export function normalizeAngle(a: number) {
  let res = a % 360;
  if (res < 0) res += 360;
  return res;
}

function rotator(cx: number, cy: number, rotation: number) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return (x: number, y: number) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos });
}

type SlabShape = 'square' | 'triangle';

export function getEdges(shape: SlabShape, cx: number, cy: number, rotation: number) {
  const rotatePoint = rotator(cx, cy, rotation);
  if (shape === 'square') {
    return [
      { ...rotatePoint(0, -30), angle: normalizeAngle(rotation - 90) },
      { ...rotatePoint(30, 0), angle: normalizeAngle(rotation) },
      { ...rotatePoint(0, 30), angle: normalizeAngle(rotation + 90) },
      { ...rotatePoint(-30, 0), angle: normalizeAngle(rotation + 180) },
    ];
  }
  return [
    { ...rotatePoint(0, TRI_R), angle: normalizeAngle(rotation + 90) },
    { ...rotatePoint(15, -TRI_R / 2), angle: normalizeAngle(rotation - 30) },
    { ...rotatePoint(-15, -TRI_R / 2), angle: normalizeAngle(rotation - 150) },
  ];
}

export function getBaseEdges(shape: SlabShape) {
  if (shape === 'square') {
    return [
      { x: 0, y: -30, angle: 270 },
      { x: 30, y: 0, angle: 0 },
      { x: 0, y: 30, angle: 90 },
      { x: -30, y: 0, angle: 180 },
    ];
  }
  return [
    { x: 0, y: TRI_R, angle: 90 },
    { x: 15, y: -TRI_R / 2, angle: 330 },
    { x: -15, y: -TRI_R / 2, angle: 210 },
  ];
}

export function getPolygonVertices(shape: Shape, cx: number, cy: number, rotation: number) {
  const rotatePoint = rotator(cx, cy, rotation);
  switch (shape) {
    case 'square':
      return [rotatePoint(-30, -30), rotatePoint(30, -30), rotatePoint(30, 30), rotatePoint(-30, 30)];
    case 'triangle':
      return [rotatePoint(-30, TRI_R), rotatePoint(30, TRI_R), rotatePoint(0, -TRI_H + TRI_R)];
    case 'wall':
      return [rotatePoint(-28, -1), rotatePoint(28, -1), rotatePoint(28, 1), rotatePoint(-28, 1)];
    case 'pillar':
      return [rotatePoint(-4, -4), rotatePoint(4, -4), rotatePoint(4, 4), rotatePoint(-4, 4)];
    case 'hatch':
      return [rotatePoint(-9, -9), rotatePoint(9, -9), rotatePoint(9, 9), rotatePoint(-9, 9)];
    default:
      return [];
  }
}

type Point = { x: number; y: number };

export function polygonsIntersect(poly1: Point[], poly2: Point[]) {
  for (const polygon of [poly1, poly2]) {
    for (let i1 = 0; i1 < polygon.length; i1++) {
      const p1 = polygon[i1];
      const p2 = polygon[(i1 + 1) % polygon.length];
      const normal = { x: p2.y - p1.y, y: p1.x - p2.x };

      let minA = Infinity, maxA = -Infinity;
      for (const p of poly1) {
        const projected = normal.x * p.x + normal.y * p.y;
        minA = Math.min(minA, projected);
        maxA = Math.max(maxA, projected);
      }
      let minB = Infinity, maxB = -Infinity;
      for (const p of poly2) {
        const projected = normal.x * p.x + normal.y * p.y;
        minB = Math.min(minB, projected);
        maxB = Math.max(maxB, projected);
      }
      // tolerancja 0.1, żeby stykające się krawędzie nie kolidowały
      if (maxA <= minB + 0.1 || maxB <= minA + 0.1) return false;
    }
  }
  return true;
}

// --- Snapowanie (wspólne dla 2D i 3D) ---

export interface PlacementInput {
  def: BuildItem;
  items: PlacedItem[];
  cursor: Point;
  floor: number;
  /** Licznik wciśnięć R. */
  turn: number;
  /**
   * 3D (sandbox): poziomy dokładne, podłoga na dowolnej wysokości (grunt sprawdza widok 3D).
   * 2D: poziomy porównywane po zaokrągleniu do pięter, podłogi tylko na parterze.
   */
  free?: boolean;
}

export interface PlacementResult {
  preview: PlacedItem | null;
  valid: boolean;
  snapPoint: Point | null;
}

const SNAP_DIST = 30;

export function computePlacement({ def, items, cursor, floor, turn, free = false }: PlacementInput): PlacementResult {
  if (def.shape === 'remover') return { preview: null, valid: false, snapPoint: null };

  let base = { id: 'preview', itemId: def.id, floor };
  // Element przyczepiony do płyty bierze jej dokładny poziom (w 2D płyta mogła powstać w 3D na terenie).
  const at = (level: number) => (base = { ...base, floor: level });
  const same = free ? sameLevel : (a: number, b: number) => Math.round(a) === Math.round(b);
  // W 2D podłogi stawia się tylko na parterze; wyższe kondygnacje to dachy poziomu niżej. W 3D decyduje grunt.
  const groundOnly = !free && isFloorPart(def) && floor > 0;
  const freeRotation = def.shape === 'triangle' ? (turn * 60) % 360 : def.shape === 'wall' ? (turn * 90) % 360 : (turn * 90) % 360;

  // Płyty, na których stoją ściany/filary na tym poziomie, oraz sąsiednie płyty tej samej warstwy.
  const anchors = items
    .map((item) => ({ item, def: findDef(item.itemId) }))
    .filter((a): a is { item: PlacedItem; def: BuildItem } => isSlab(a.def));

  let preview: PlacedItem | null = null;
  let snapPoint: Point | null = null;

  if (def.shape === 'bed') {
    preview = { ...base, x: Math.round(cursor.x), y: Math.round(cursor.y), rotation: (turn * 90) % 360 };
  } else if (def.shape === 'hatch') {
    // Klapa tylko w otworze dachu (kwadratowego albo trójkątnego) z tego samego poziomu.
    let best: { x: number; y: number; hole: PlacedItem } | null = null;
    let bestDist = SNAP_DIST;
    anchors.forEach(({ item, def: d }) => {
      if (!isHole(d) || !same(item.floor || 0, floor)) return;
      const o = holeOpening(item, d);
      const dist = Math.hypot(o.x - cursor.x, o.y - cursor.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { ...o, hole: item };
      }
    });
    const spot = best as { x: number; y: number; hole: PlacedItem } | null;
    if (!spot) {
      return { preview: { ...base, x: cursor.x, y: cursor.y, rotation: 0 }, valid: false, snapPoint: null };
    }
    at(spot.hole.floor || 0);
    preview = { ...base, x: spot.x, y: spot.y, rotation: spot.hole.rotation };
  } else if (def.shape === 'wall' || def.shape === 'pillar') {
    // Krawędzie / narożniki płyt, na których element stoi (fizyczny poziom == floor).
    let best: { x: number; y: number; angle: number; level: number } | null = null;
    let bestDist = SNAP_DIST;
    anchors.forEach(({ item, def: d }) => {
      const level = slabLevel(item, d);
      if (!same(level, floor)) return;
      const shape = d.shape as SlabShape;
      const vertices = getPolygonVertices(shape, item.x, item.y, item.rotation);
      if (def.shape === 'pillar') {
        vertices.forEach((v) => {
          const dist = Math.hypot(v.x - cursor.x, v.y - cursor.y);
          if (dist < bestDist) {
            bestDist = dist;
            best = { ...v, angle: 0, level };
          }
        });
        return;
      }
      getEdges(shape, item.x, item.y, item.rotation).forEach((edge, i) => {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        const dist = distToSegment(cursor, p1, p2);
        if (dist < bestDist) {
          bestDist = dist;
          best = { ...edge, level };
        }
      });
    });
    const target = best as { x: number; y: number; angle: number; level: number } | null;
    if (target) {
      at(target.level);
      snapPoint = target;
      preview = def.shape === 'pillar'
        ? { ...base, x: target.x, y: target.y, rotation: 0 }
        : { ...base, x: target.x, y: target.y, rotation: normalizeAngle(target.angle + 90 + (turn % 2) * 180) };
    } else {
      preview = { ...base, x: Math.round(cursor.x / 30) * 30, y: Math.round(cursor.y / 30) * 30, rotation: freeRotation };
    }
  } else {
    // Płyty: podłogi, dachy, schody, rampy, trójkąty.
    const shape = def.shape as SlabShape;
    const roofOffset = isRoofLayer(def) ? 1 : 0;
    const ownSlab = floor + roofOffset;
    const edges: { e: { x: number; y: number; angle: number }; dist: number; level: number }[] = [];
    let center: PlacedItem | null = null;
    let centerDist = 20;

    anchors.forEach(({ item, def: d }) => {
      const s = slabLevel(item, d);
      // Dach nad pomieszczeniem: środek nad podłogą z tego samego poziomu.
      if (isRoofLayer(def) && same(s, floor) && d.shape === def.shape) {
        const dist = Math.hypot(item.x - cursor.x, item.y - cursor.y);
        if (dist < centerDist) {
          centerDist = dist;
          center = item;
        }
      }
      if (!same(s, ownSlab)) return;
      const dShape = d.shape as SlabShape;
      const vertices = getPolygonVertices(dShape, item.x, item.y, item.rotation);
      // Kursor na istniejącej płycie: każda jej krawędź jest kandydatem (wybierzemy najbliższą wolną).
      const onTop = pointInPolygon(cursor, vertices);
      getEdges(dShape, item.x, item.y, item.rotation).forEach((e, i) => {
        const dist = distToSegment(cursor, vertices[i], vertices[(i + 1) % vertices.length]);
        if (dist < SNAP_DIST || onTop) edges.push({ e, dist, level: s - roofOffset });
      });
    });

    const c = center as PlacedItem | null;
    if (c) at(c.floor || 0);
    const besideEdge = (e: { x: number; y: number; angle: number }): PlacedItem => ({ ...base, ...slabBesideEdge(shape, e, turn) });
    if (c && isValid(def, { ...base, x: c.x, y: c.y, rotation: c.rotation }, items)) {
      preview = { ...base, x: c.x, y: c.y, rotation: c.rotation };
    } else if (edges.length > 0) {
      // Najbliższa krawędź z wolnym miejscem obok (zajęte, np. wewnętrzne, pomijamy jak gra).
      edges.sort((a, b) => a.dist - b.dist);
      const open = edges.find(({ e, level }) => {
        at(level);
        return isValid(def, besideEdge(e), items);
      }) ?? edges[0];
      at(open.level);
      preview = besideEdge(open.e);
      snapPoint = open.e;
    } else if (c) {
      preview = { ...base, x: c.x, y: c.y, rotation: c.rotation };
    } else {
      preview = { ...base, x: Math.round(cursor.x / 30) * 30, y: Math.round(cursor.y / 30) * 30, rotation: freeRotation };
    }
  }

  return { preview, valid: !groundOnly && isPlacementValid(def, preview, items), snapPoint };
}

/**
 * Płyta przyłożona krawędzią do krawędzi `e` (kąt = kierunek na zewnątrz, czyli tam, gdzie leży nowa płyta);
 * R wybiera, którą swoją krawędzią płyta przylega (jak obrót w grze).
 */
function slabBesideEdge(shape: SlabShape, e: { x: number; y: number; angle: number }, turn: number) {
  const baseEdges = getBaseEdges(shape);
  const chosen = baseEdges[turn % baseEdges.length];
  const R = normalizeAngle(normalizeAngle(e.angle + 180) - chosen.angle);
  const rad = (R * Math.PI) / 180;
  const bx = chosen.x * Math.cos(rad) - chosen.y * Math.sin(rad);
  const by = chosen.x * Math.sin(rad) + chosen.y * Math.cos(rad);
  return { x: round3(e.x - bx), y: round3(e.y - by), rotation: R };
}

/**
 * HousingEdge.CanAttachRoof: dach (także otwór, schody, rampa) musi przylegać choć jedną krawędzią do krawędzi,
 * przy której coś jest: płyta (podłoga albo dach) na tej samej wysokości, góra pełnej ściany (murek się nie liczy)
 * albo ściana stojąca na tej krawędzi. Same filary krawędzi nie tworzą.
 */
export function roofSupported(def: BuildItem, preview: PlacedItem, items: PlacedItem[]) {
  if (!isRoofLayer(def)) return true;
  const level = slabLevel(preview, def);
  const edges = getEdges(def.shape as SlabShape, preview.x, preview.y, preview.rotation);
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) < 1.5;
  return items.some((item) => {
    if (item.id === preview.id) return false;
    const d = findDef(item.itemId);
    if (!d || Math.hypot(item.x - preview.x, item.y - preview.y) > 80) return false;
    if (isSlab(d)) {
      if (!sameLevel(slabLevel(item, d), level)) return false;
      const other = getEdges(d.shape as SlabShape, item.x, item.y, item.rotation);
      return edges.some((e) => other.some((o) => near(e, o)));
    }
    if (d.shape === 'wall') {
      const f = item.floor || 0;
      const onTop = d.part !== 'rampart' && sameLevel(f + 1, level);
      return (onTop || sameLevel(f, level)) && edges.some((e) => near(e, item));
    }
    return false;
  });
}

export function pointInPolygon(p: Point, poly: Point[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Point, a: Point, b: Point) {
  const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

/** Końce ściany, czyli wierzchołki krawędzi płyty (krawędź ma 60 j.). */
function wallEnds(w: PlacedItem) {
  const r = (w.rotation * Math.PI) / 180;
  const dx = Math.cos(r) * (SIDE / 2), dy = Math.sin(r) * (SIDE / 2);
  return [{ x: w.x - dx, y: w.y - dy }, { x: w.x + dx, y: w.y + dy }];
}

/**
 * Kolizja dwóch ścian jak w grze (HousingConnections.ValidateWallPlacement):
 * zajęta krawędź blokuje, ściany ze wspólnym wierzchołkiem są ignorowane (np. styk trójkątów pod kątem 30°),
 * pozostałe blokują tylko wtedy, gdy faktycznie się nachodzą.
 */
function wallsClash(a: PlacedItem, b: PlacedItem) {
  if (Math.hypot(a.x - b.x, a.y - b.y) < 2) return true;
  const ea = wallEnds(a), eb = wallEnds(b);
  if (ea.some((p) => eb.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1))) return false;
  return polygonsIntersect(
    getPolygonVertices('wall', a.x, a.y, a.rotation),
    getPolygonVertices('wall', b.x, b.y, b.rotation),
  );
}

/** Kolizje: elementy tej samej warstwy na tym samym fizycznym poziomie nie mogą się nachodzić. */
function isValid(def: BuildItem, preview: PlacedItem, items: PlacedItem[]) {
  const level = slabLevel(preview, def);
  return !items.some((item) => {
    const d = findDef(item.itemId);
    if (!d) return false;
    const dist = Math.hypot(item.x - preview.x, item.y - preview.y);
    if (dist > 80) return false;

    const sameFloor = sameLevel(item.floor || 0, preview.floor || 0);
    if (def.shape === 'bed' || d.shape === 'bed') {
      return def.shape === 'bed' && d.shape === 'bed' && sameFloor && dist < 15;
    }
    if (def.shape === 'hatch' || d.shape === 'hatch') {
      return def.shape === 'hatch' && d.shape === 'hatch' && sameFloor && dist < 5;
    }
    if (def.shape === 'wall' && d.shape === 'wall' && sameFloor) {
      return wallsClash(preview, item);
    }
    const sameGroup =
      (isSlab(def) && isSlab(d) && sameLevel(slabLevel(item, d), level)) ||
      (def.shape === d.shape && (def.shape === 'wall' || def.shape === 'pillar') && sameFloor);
    if (!sameGroup) return false;
    return polygonsIntersect(
      getPolygonVertices(def.shape, preview.x, preview.y, preview.rotation),
      getPolygonVertices(d.shape, item.x, item.y, item.rotation),
    );
  });
}

/**
 * HousingConnections.ValidateWallPlacement (Requires_Pillars domyślnie włączone): ściana potrzebuje filarów na obu końcach,
 * pełnej wysokości (filar, nie słupek); murek wystarczy słupek albo filar. Inaczej gra zgłasza "brak filaru".
 */
export function wallMissingPillars(def: BuildItem, preview: PlacedItem, items: PlacedItem[]) {
  if (def.shape !== 'wall') return false;
  const full = def.part !== 'rampart';
  const floor = preview.floor || 0;
  const r = (preview.rotation * Math.PI) / 180;
  const ends = [-30, 30].map((o) => ({ x: preview.x + o * Math.cos(r), y: preview.y + o * Math.sin(r) }));
  return !ends.every((e) =>
    items.some((it) => {
      const d = findDef(it.itemId);
      return !!d && d.shape === 'pillar' && sameLevel(it.floor || 0, floor) && (!full || d.part === 'pillar') && Math.hypot(it.x - e.x, it.y - e.y) < 2;
    }),
  );
}

export const isPlacementValid = (def: BuildItem, preview: PlacedItem, items: PlacedItem[]) =>
  isValid(def, preview, items) && !wallMissingPillars(def, preview, items) && roofSupported(def, preview, items);

// --- Celowanie w 3D jak w grze (HousingConnections.FindEmptyWallSlot / FindEmptyPillarSlot) ---

const SLOT_RANGE = 8; // m, MAX_FIND_EMPTY_SLOT_DISTANCE
const SLOT_COSINE = 0.9; // MIN_FIND_EMPTY_SLOT_COSINE (~25° od celownika)
const SLOT_TOP = 0.25; // wierzch płyty nad poziomem (m)
const HALF_WALL_HEIGHT = 2.125;

/** Promień celownika w metrach: x/z jak plan (j. / 10), y to wysokość nad poziomem 0. */
export interface AimRay {
  origin: { x: number; y: number; z: number };
  dir: { x: number; y: number; z: number };
}

/**
 * Wolny slot ściany albo filara najbliżej promienia celownika, bez względu na to, w co promień trafia.
 * Sloty to krawędzie (ściany) i wierzchołki (filary) płyt oraz góra i dół istniejących ścian;
 * ściana może stać na krawędzi albo wisieć pod nią (np. pod dachem skybase).
 */
export function findSlotByRay(def: BuildItem, items: PlacedItem[], ray: AimRay, turn: number): PlacedItem | null {
  if (def.shape !== 'wall' && def.shape !== 'pillar') return null;
  const isWall = def.shape === 'wall';
  const m = 1 / UNITS_PER_METER;
  // ground: krawędź podłogi stojącej na terenie, pod nią nic nie wisi (jak dawny poziom 0)
  const spots = new Map<string, { x: number; y: number; level: number; rotation: number; ground: boolean }>();
  const add = (x: number, y: number, level: number, rotation: number, ground = false) => {
    const key = `${Math.round(x)},${Math.round(y)},${level.toFixed(2)}`;
    if (!spots.has(key)) spots.set(key, { x, y, level, rotation, ground });
  };
  const reach = SLOT_RANGE + SIDE * m;

  items.forEach((item) => {
    const d = findDef(item.itemId);
    if (!d || Math.hypot(item.x * m - ray.origin.x, item.y * m - ray.origin.z) > reach) return;
    if (isSlab(d)) {
      const level = slabLevel(item, d);
      const shape = d.shape as SlabShape;
      const ground = isFloorPart(d);
      if (isWall) getEdges(shape, item.x, item.y, item.rotation).forEach((e) => add(e.x, e.y, level, normalizeAngle(e.angle + 90), ground));
      else getPolygonVertices(shape, item.x, item.y, item.rotation).forEach((v) => add(v.x, v.y, level, 0, ground));
    } else if (d.shape === 'wall') {
      // Ściana tworzy krawędź u dołu i u góry (na niej można postawić kolejną).
      const f = item.floor || 0;
      if (isWall) {
        add(item.x, item.y, f, item.rotation);
        add(item.x, item.y, f + 1, item.rotation);
      } else {
        wallEnds(item).forEach((p) => {
          add(p.x, p.y, f, 0);
          add(p.x, p.y, f + 1, 0);
        });
      }
    }
  });

  const occupied = (x: number, y: number, floor: number) =>
    items.some((o) => sameLevel(o.floor || 0, floor) && findDef(o.itemId)?.shape === def.shape && Math.hypot(o.x - x, o.y - y) < 2);

  let best: PlacedItem | null = null;
  let bestScore = SLOT_RANGE * SLOT_RANGE;
  spots.forEach((s) => {
    // Ściana/filar stojący na krawędzi albo wiszący pod nią.
    for (const floor of s.ground ? [s.level] : [s.level, s.level - 1]) {
      if (occupied(s.x, s.y, floor)) continue;
      const dx = s.x * m - ray.origin.x;
      const dy = floor * LEVEL_HEIGHT + SLOT_TOP + HALF_WALL_HEIGHT - ray.origin.y;
      const dz = s.y * m - ray.origin.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > SLOT_RANGE * SLOT_RANGE) continue;
      const cos = (dx * ray.dir.x + dy * ray.dir.y + dz * ray.dir.z) / Math.sqrt(d2);
      if (cos < SLOT_COSINE) continue;
      const score = (1 - cos) * d2;
      if (score < bestScore) {
        bestScore = score;
        best = {
          id: 'preview',
          itemId: def.id,
          x: round3(s.x),
          y: round3(s.y),
          floor,
          rotation: isWall ? normalizeAngle(s.rotation + (turn % 2) * 180) : 0,
        };
      }
    }
  });
  return best;
}

/**
 * Wolne miejsce na podłogę/dach przy krawędzi najbliżej celownika (FindEmptyFloorSlot z gry).
 * Krawędzie: płyty tego samego poziomu, dla dachów także góra ścian. Punkt testowy leży 1,5 m od krawędzi
 * po wolnej stronie, na wysokości wierzchu płyty; zajęte strony (kolizja) odpadają.
 */
export function findSlabSlotByRay(def: BuildItem, items: PlacedItem[], ray: AimRay, turn: number): PlacementResult | null {
  if (!isSlab(def)) return null;
  const roofLike = isRoofLayer(def);
  const m = 1 / UNITS_PER_METER;
  const reach = SLOT_RANGE + SIDE * m;
  const edges = new Map<string, { x: number; y: number; level: number; angle: number }>();
  const add = (x: number, y: number, level: number, angle: number) => {
    const key = `${Math.round(x)},${Math.round(y)},${level.toFixed(2)}`;
    if (!edges.has(key)) edges.set(key, { x, y, level, angle });
  };
  // Krawędzie jak HousingEdge: tworzą je płyty (na swojej wysokości) i ściany (dół i góra).
  // Dachy tylko tam, gdzie CanAttachRoof: góra murka się nie liczy.
  items.forEach((item) => {
    const d = findDef(item.itemId);
    if (!d || Math.hypot(item.x * m - ray.origin.x, item.y * m - ray.origin.z) > reach) return;
    if (isSlab(d)) {
      const level = slabLevel(item, d);
      getEdges(d.shape as SlabShape, item.x, item.y, item.rotation).forEach((e) => add(e.x, e.y, level, e.angle));
    } else if (d.shape === 'wall') {
      const f = item.floor || 0;
      add(item.x, item.y, f, normalizeAngle(item.rotation - 90));
      if (!roofLike || d.part !== 'rampart') add(item.x, item.y, f + 1, normalizeAngle(item.rotation - 90));
    }
  });

  let best: PlacementResult | null = null;
  let bestScore = SLOT_RANGE * SLOT_RANGE;
  const offset = 1.5 * UNITS_PER_METER; // HALF_EDGE_LENGTH * 0.5
  edges.forEach((e) => {
    const floor = roofLike ? e.level - 1 : e.level;
    const rad = (e.angle * Math.PI) / 180;
    for (const side of [1, -1]) {
      const tx = e.x + Math.cos(rad) * offset * side;
      const ty = e.y + Math.sin(rad) * offset * side;
      const dx = tx * m - ray.origin.x;
      const dy = e.level * LEVEL_HEIGHT + SLOT_TOP - ray.origin.y;
      const dz = ty * m - ray.origin.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > SLOT_RANGE * SLOT_RANGE) continue;
      const cos = (dx * ray.dir.x + dy * ray.dir.y + dz * ray.dir.z) / Math.sqrt(d2);
      if (cos < SLOT_COSINE) continue;
      const score = (1 - cos) * d2;
      if (score >= bestScore) continue;
      // płyta po tej stronie krawędzi (FindEmptyFloorSlot: zajęte strony odpadają)
      const preview: PlacedItem = {
        id: 'preview',
        itemId: def.id,
        floor,
        ...slabBesideEdge(def.shape as SlabShape, { x: e.x, y: e.y, angle: side === 1 ? e.angle : normalizeAngle(e.angle + 180) }, turn),
      };
      if (!isPlacementValid(def, preview, items)) continue;
      best = { preview, valid: true, snapPoint: { x: e.x, y: e.y } };
      bestScore = score;
    }
  });
  return best;
}

// --- Grupy: wklejanie i przesuwanie wielu elementów naraz ---

/** Obroty różniące się o wielokrotność tej wartości dają ten sam element. */
const SYMMETRY: Partial<Record<Shape, number>> = { square: 90, pillar: 90, hatch: 90, wall: 180, triangle: 120 };

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Ten sam element w tym samym miejscu (np. wspólna ściana albo filar na styku kopii z oryginałem). */
function isDuplicate(a: PlacedItem, da: BuildItem, b: PlacedItem, db: BuildItem) {
  if (da.shape !== db.shape || da.part !== db.part || !sameLevel(a.floor || 0, b.floor || 0)) return false;
  if (Math.hypot(a.x - b.x, a.y - b.y) > 1) return false;
  const sym = SYMMETRY[da.shape] ?? 360;
  const diff = normalizeAngle(a.rotation - b.rotation) % sym;
  return diff < 1 || diff > sym - 1;
}

/**
 * Przesunięcie całej grupy tak, żeby któraś jej płyta przyległa krawędzią do płyty z `others`
 * (ten sam poziom, krawędzie naprzeciw siebie). Bez krawędzi w zasięgu: krok 30 j., więc układ grupy się nie zmienia.
 */
export function snapGroupDelta(
  group: PlacedItem[],
  others: PlacedItem[],
  raw: Point,
): { dx: number; dy: number; snapPoint: Point | null } {
  // Krawędzie płyt grupy po surowym przesunięciu, w siatce kubełków co SNAP_DIST.
  const buckets = new Map<string, { x: number; y: number; angle: number; level: number }[]>();
  const key = (x: number, y: number) => `${Math.floor(x / SNAP_DIST)},${Math.floor(y / SNAP_DIST)}`;
  group.forEach((item) => {
    const def = findDef(item.itemId);
    if (!def || !isSlab(def)) return;
    const level = slabLevel(item, def);
    getEdges(def.shape as SlabShape, item.x + raw.x, item.y + raw.y, item.rotation).forEach((e) => {
      const k = key(e.x, e.y);
      const list = buckets.get(k);
      if (list) list.push({ ...e, level });
      else buckets.set(k, [{ ...e, level }]);
    });
  });

  let best = null as { dx: number; dy: number; snapPoint: Point | null } | null;
  let bestDist = SNAP_DIST;
  if (buckets.size > 0) {
    others.forEach((item) => {
      const def = findDef(item.itemId);
      if (!def || !isSlab(def)) return;
      const level = slabLevel(item, def);
      getEdges(def.shape as SlabShape, item.x, item.y, item.rotation).forEach((o) => {
        const bx = Math.floor(o.x / SNAP_DIST), by = Math.floor(o.y / SNAP_DIST);
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            buckets.get(`${bx + i},${by + j}`)?.forEach((g) => {
              if (!sameLevel(g.level, level)) return;
              const da = normalizeAngle(o.angle - g.angle - 180);
              if (da > 1 && da < 359) return;
              const dist = Math.hypot(o.x - g.x, o.y - g.y);
              if (dist < bestDist) {
                bestDist = dist;
                best = { dx: round3(raw.x + o.x - g.x), dy: round3(raw.y + o.y - g.y), snapPoint: { x: o.x, y: o.y } };
              }
            });
          }
        }
      });
    });
  }
  return best ?? { dx: Math.round(raw.x / 30) * 30, dy: Math.round(raw.y / 30) * 30, snapPoint: null };
}

export interface PasteResult {
  items: PlacedItem[];
  /** Id elementów schowka, które kolidują z istniejącymi. */
  invalid: Set<string>;
  valid: boolean;
  snapPoint: Point | null;
}

/**
 * Podgląd wklejenia schowka pod kursorem: grupa przesuwa się w całości (bez zaokrąglania pojedynczych elementów),
 * zachowuje odstępy pięter, obraca się o 90° na każde R i dosuwa krawędzią do istniejących płyt.
 * Elementy pokrywające się 1:1 z istniejącymi (wspólna ściana, filar) są pomijane.
 */
export function computePaste({ clip, items, cursor, floor, turn, free = false }: {
  clip: PlacedItem[];
  items: PlacedItem[];
  cursor: Point;
  floor: number;
  turn: number;
  /** 3D: grupa na dowolnej wysokości, poziomy dokładne. */
  free?: boolean;
}): PasteResult {
  const minFloor = Math.min(...clip.map((i) => i.floor || 0));
  // Punkt zaczepienia: płyta z najniższego piętra, inaczej pierwszy element.
  const ref = clip.find((i) => (i.floor || 0) === minFloor && isSlab(findDef(i.itemId))) ?? clip[0];
  const rot = (turn % 4) * 90;
  const turnAround = rotator(0, 0, rot);
  const moved = clip.map((i) => {
    const p = turnAround(i.x - ref.x, i.y - ref.y);
    return { ...i, x: ref.x + p.x, y: ref.y + p.y, rotation: normalizeAngle(i.rotation + rot), floor: roundLevel((i.floor || 0) - minFloor + floor) };
  });

  const { dx, dy, snapPoint } = snapGroupDelta(moved, items, { x: cursor.x - ref.x, y: cursor.y - ref.y });
  const out: PlacedItem[] = [];
  const invalid = new Set<string>();
  // filary z wklejanej kopii też podpierają ściany z tej kopii
  const support = [...items, ...moved.map((i) => ({ ...i, x: round3(i.x + dx), y: round3(i.y + dy) }))];
  moved.forEach((i) => {
    const def = findDef(i.itemId);
    if (!def) return;
    const p = { ...i, x: round3(i.x + dx), y: round3(i.y + dy) };
    if (items.some((o) => {
      const d = findDef(o.itemId);
      return !!d && isDuplicate(p, def, o, d);
    })) return;
    const groundOnly = !free && isFloorPart(def) && (p.floor || 0) > 0;
    if (groundOnly || !isValid(def, p, items) || wallMissingPillars(def, p, support) || !roofSupported(def, p, support)) invalid.add(i.id);
    out.push(p);
  });
  return { items: out, invalid, valid: out.length > 0 && invalid.size === 0, snapPoint };
}

// --- Koszty ---

/**
 * Surowce na zbudowanie elementów: suma przepisów (craft daje `craftYield` sztuk, więc liczymy pełne crafty).
 * `loot`: ile elementów nie ma przepisu (trzeba je znaleźć albo kupić).
 */
export function computeMaterials(items: PlacedItem[]) {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const def = findDef(item.itemId);
    if (def) counts[def.id] = (counts[def.id] || 0) + 1;
  });
  const totals: Record<string, number> = {};
  let loot = 0;
  Object.entries(counts).forEach(([id, count]) => {
    const def = findDef(id)!;
    if (def.noRecipe) loot += count;
    const crafts = Math.ceil(count / (def.craftYield || 1));
    Object.entries(def.costs).forEach(([mat, qty]) => {
      if (qty > 0) totals[mat] = (totals[mat] || 0) + qty * crafts;
    });
  });
  return { totals, loot };
}

/**
 * Drzwi postawione przed wersją 0.22 stały spodem na dole ściany; teraz pivot jest w slocie otworu jak w grze.
 * Przesuwa takie drzwi na właściwą wysokość (zwraca tę samą tablicę, gdy nic się nie zmienia).
 */
export function resnapDoors(items: PlacedItem[]): PlacedItem[] {
  let changed = false;
  const out = items.map((item) => {
    const def = findDef(item.itemId);
    if (!isDoorLike(def)) return item;
    const part = DOOR_FRAMES[def!.build!];
    const f = item.floor || 0;
    const wall = items.find(
      (w) => findDef(w.itemId)?.part === part && Math.hypot(w.x - item.x, w.y - item.y) < 3 && f >= (w.floor || 0) - 0.05 && f <= (w.floor || 0) + 1.05,
    );
    if (!wall) return item;
    const bottom = WALL_BOTTOM + (SLOT_HEIGHT[part] ?? WALL_HALF) - (def!.pivot ?? (def!.size?.[1] ?? 2.8) / 2);
    const floor = roundLevel((wall.floor || 0) + bottom / LEVEL_HEIGHT);
    if (Math.abs(floor - f) < 0.0005) return item;
    changed = true;
    return { ...item, floor };
  });
  return changed ? out : items;
}

/**
 * Usuwa elementy razem z drzwiami, bramami i okiennicami osadzonymi w usuwanych ścianach.
 * Drzwi stawia się tylko w otworze (findDoorSlot), więc bez ściany zostałyby w powietrzu: w planie to błąd.
 */
export function removeItems(items: PlacedItem[], ids: Set<string>): PlacedItem[] {
  const frames = items.filter((i) => ids.has(i.id) && Object.values(DOOR_FRAMES).includes(findDef(i.itemId)?.part as PartId));
  if (frames.length === 0) return items.filter((i) => !ids.has(i.id));
  const gone = new Set(ids);
  for (const item of items) {
    const def = findDef(item.itemId);
    if (!isDoorLike(def)) continue;
    const part = DOOR_FRAMES[def!.build!];
    const f = item.floor || 0;
    if (frames.some((w) => findDef(w.itemId)?.part === part && Math.hypot(w.x - item.x, w.y - item.y) < 3 && f >= (w.floor || 0) - 0.05 && f <= (w.floor || 0) + 1.05)) {
      gone.add(item.id);
    }
  }
  return items.filter((i) => !gone.has(i.id));
}

export const newItemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// --- Bazy: grupy połączonych elementów ---

/**
 * Podział elementów na bazy: elementy są w jednej bazie, gdy stoją obok siebie (do 61 j., czyli sąsiednia płyta)
 * na sąsiednich poziomach. Kolejność: od największej bazy.
 */
export function baseGroups(items: PlacedItem[]): PlacedItem[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const cell = (v: number) => Math.floor(v / 64);
  const grid = new Map<string, number[]>();
  items.forEach((it, i) => {
    const key = `${cell(it.x)},${cell(it.y)}`;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  items.forEach((a, i) => {
    const cx = cell(a.x), cy = cell(a.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        grid.get(`${cx + dx},${cy + dy}`)?.forEach((j) => {
          if (j <= i) return;
          const b = items[j];
          if (Math.abs((a.floor || 0) - (b.floor || 0)) > 1.05 || Math.hypot(a.x - b.x, a.y - b.y) > 61) return;
          parent[find(i)] = find(j);
        });
      }
    }
  });
  const groups = new Map<number, PlacedItem[]>();
  items.forEach((it, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(it);
    else groups.set(r, [it]);
  });
  return [...groups.values()].sort((a, b) => b.length - a.length);
}
