/*
  Model klocków Planturned.

  Struktury, ID, kolory, receptury i wymiary pochodzą z plików gry Unturned
  (Bundles/Items/Structures/*.dat i modele z core.masterbundle, patrz scripts/export_game_data.py).
  Ikony: SilKsPlugins/UnturnedImages (folder vanilla), zapisane w public/unturned/items/<id>.png.

  Układ planu: 1 pole podłogi = 60 jednostek = 6 m (10 jednostek na metr). Poziom (floor) 0..3,
  wysokość poziomu w grze 4,5 m. Warstwy:
    - płyty: podłogi (poziom L) oraz dachy, otwory, schody i rampy (Construct Roof, fizycznie na L+1)
    - ściany i ich warianty stoją na krawędziach płyt
    - filary i słupki stoją w narożnikach płyt
*/

export type Shape = 'square' | 'triangle' | 'wall' | 'pillar' | 'hatch' | 'bed' | 'remover';

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
  costs: Record<string, number>;
  /** Wytrzymałość w grze (Health z pliku .dat). */
  health?: number;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  rotation: number; // stopnie
  customColor?: string;
  floor?: number;
}

export const SIDE = 60;
export const TRI_R = (SIDE * Math.sqrt(3)) / 6;
export const TRI_H = (SIDE * Math.sqrt(3)) / 2;
export const BED_CLAIM_RADIUS = 270;
export const FLOORS = [0, 1, 2, 3];
export const floorLabel = (lvl: number) => (lvl === 0 ? 'Parter' : `Piętro ${lvl}`);
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

function recipe(material: MaterialId, part: PartId): Record<string, number> {
  if (material === 'metal') {
    if (part === 'hatch') return { metal_sheet: 1, metal_scrap: 2 };
    return { metal_sheet: METAL_SHEETS[part] };
  }
  if (material === 'brick') return { bricks: BRICKS[part] };
  if (part === 'hatch') return { [`${material}_plank`]: 4, metal_scrap: 1 };
  return { [`${material}_log`]: WOOD_LOGS[part] };
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

export const MATERIAL_LABELS: Record<string, string> = {
  maple_log: 'Kłody klonowe',
  birch_log: 'Kłody brzozowe',
  pine_log: 'Kłody sosnowe',
  maple_plank: 'Deski klonowe',
  birch_plank: 'Deski brzozowe',
  pine_plank: 'Deski sosnowe',
  metal_sheet: 'Blacha',
  metal_scrap: 'Złom',
  bricks: 'Cegły',
};

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

/** W grze dachy, otwory, schody i rampy to Construct Roof: stoją na wysokości dachu danego poziomu. */
export const isRoofLayer = (def?: BuildItem) =>
  def?.part === 'roof' || def?.part === 'tri_roof' || def?.part === 'hole' || def?.part === 'tri_hole' ||
  def?.part === 'stairs' || def?.part === 'ramp';
export const isSlab = (def?: BuildItem) => def?.shape === 'square' || def?.shape === 'triangle';
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
}

export interface PlacementResult {
  preview: PlacedItem | null;
  valid: boolean;
  snapPoint: Point | null;
}

const SNAP_DIST = 30;

export function computePlacement({ def, items, cursor, floor, turn }: PlacementInput): PlacementResult {
  if (def.shape === 'remover') return { preview: null, valid: false, snapPoint: null };

  const base = { id: 'preview', itemId: def.id, floor };
  // W grze podłogi stawia się tylko na terenie; wyższe kondygnacje to dachy poziomu niżej.
  const groundOnly = (def.part === 'floor' || def.part === 'tri_floor') && floor > 0;
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
    // Klapa tylko w otworze dachu z tego samego poziomu.
    let best: PlacedItem | null = null;
    let bestDist = SNAP_DIST;
    anchors.forEach(({ item, def: d }) => {
      if (d.part !== 'hole' || (item.floor || 0) !== floor) return;
      const dist = Math.hypot(item.x - cursor.x, item.y - cursor.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    });
    const hole = best as PlacedItem | null;
    if (!hole) {
      return { preview: { ...base, x: cursor.x, y: cursor.y, rotation: 0 }, valid: false, snapPoint: null };
    }
    preview = { ...base, x: hole.x, y: hole.y, rotation: hole.rotation };
  } else if (def.shape === 'wall' || def.shape === 'pillar') {
    // Krawędzie / narożniki płyt, na których element stoi (fizyczny poziom == floor).
    let best: { x: number; y: number; angle: number } | null = null;
    let bestDist = SNAP_DIST;
    anchors.forEach(({ item, def: d }) => {
      if (slabLevel(item, d) !== floor) return;
      const shape = d.shape as SlabShape;
      const vertices = getPolygonVertices(shape, item.x, item.y, item.rotation);
      if (def.shape === 'pillar') {
        vertices.forEach((v) => {
          const dist = Math.hypot(v.x - cursor.x, v.y - cursor.y);
          if (dist < bestDist) {
            bestDist = dist;
            best = { ...v, angle: 0 };
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
          best = edge;
        }
      });
    });
    const target = best as { x: number; y: number; angle: number } | null;
    if (target) {
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
    const ownSlab = floor + (isRoofLayer(def) ? 1 : 0);
    const edges: { e: { x: number; y: number; angle: number }; dist: number }[] = [];
    let center: PlacedItem | null = null;
    let centerDist = 20;

    anchors.forEach(({ item, def: d }) => {
      const s = slabLevel(item, d);
      // Dach nad pomieszczeniem: środek nad podłogą z tego samego poziomu.
      if (isRoofLayer(def) && s === floor && d.shape === def.shape) {
        const dist = Math.hypot(item.x - cursor.x, item.y - cursor.y);
        if (dist < centerDist) {
          centerDist = dist;
          center = item;
        }
      }
      if (s !== ownSlab) return;
      const dShape = d.shape as SlabShape;
      const vertices = getPolygonVertices(dShape, item.x, item.y, item.rotation);
      // Kursor na istniejącej płycie: każda jej krawędź jest kandydatem (wybierzemy najbliższą wolną).
      const onTop = pointInPolygon(cursor, vertices);
      getEdges(dShape, item.x, item.y, item.rotation).forEach((e, i) => {
        const dist = distToSegment(cursor, vertices[i], vertices[(i + 1) % vertices.length]);
        if (dist < SNAP_DIST || onTop) edges.push({ e, dist });
      });
    });

    const c = center as PlacedItem | null;
    const besideEdge = (e: { x: number; y: number; angle: number }): PlacedItem => {
      const baseEdges = getBaseEdges(shape);
      const chosen = baseEdges[turn % baseEdges.length];
      const R = normalizeAngle(normalizeAngle(e.angle + 180) - chosen.angle);
      const rad = (R * Math.PI) / 180;
      const bx = chosen.x * Math.cos(rad) - chosen.y * Math.sin(rad);
      const by = chosen.x * Math.sin(rad) + chosen.y * Math.cos(rad);
      return { ...base, x: round3(e.x - bx), y: round3(e.y - by), rotation: R };
    };
    if (c && isValid(def, { ...base, x: c.x, y: c.y, rotation: c.rotation }, items)) {
      preview = { ...base, x: c.x, y: c.y, rotation: c.rotation };
    } else if (edges.length > 0) {
      // Najbliższa krawędź z wolnym miejscem obok (zajęte, np. wewnętrzne, pomijamy jak gra).
      edges.sort((a, b) => a.dist - b.dist);
      const free = edges.find(({ e }) => isValid(def, besideEdge(e), items)) ?? edges[0];
      preview = besideEdge(free.e);
      snapPoint = free.e;
    } else if (c) {
      preview = { ...base, x: c.x, y: c.y, rotation: c.rotation };
    } else {
      preview = { ...base, x: Math.round(cursor.x / 30) * 30, y: Math.round(cursor.y / 30) * 30, rotation: freeRotation };
    }
  }

  return { preview, valid: !groundOnly && isValid(def, preview, items), snapPoint };
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

    if (def.shape === 'bed' || d.shape === 'bed') {
      return def.shape === 'bed' && d.shape === 'bed' && (item.floor || 0) === (preview.floor || 0) && dist < 15;
    }
    if (def.shape === 'hatch' || d.shape === 'hatch') {
      return def.shape === 'hatch' && d.shape === 'hatch' && (item.floor || 0) === (preview.floor || 0) && dist < 5;
    }
    if (def.shape === 'wall' && d.shape === 'wall' && (item.floor || 0) === (preview.floor || 0)) {
      return wallsClash(preview, item);
    }
    const sameGroup =
      (isSlab(def) && isSlab(d) && slabLevel(item, d) === level) ||
      (def.shape === d.shape && (def.shape === 'wall' || def.shape === 'pillar') && (item.floor || 0) === (preview.floor || 0));
    if (!sameGroup) return false;
    return polygonsIntersect(
      getPolygonVertices(def.shape, preview.x, preview.y, preview.rotation),
      getPolygonVertices(d.shape, item.x, item.y, item.rotation),
    );
  });
}

export const isPlacementValid = (def: BuildItem, preview: PlacedItem, items: PlacedItem[]) => isValid(def, preview, items);

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
  const spots = new Map<string, { x: number; y: number; level: number; rotation: number }>();
  const add = (x: number, y: number, level: number, rotation: number) => {
    const key = `${Math.round(x)},${Math.round(y)},${level}`;
    if (!spots.has(key)) spots.set(key, { x, y, level, rotation });
  };
  const reach = SLOT_RANGE + SIDE * m;

  items.forEach((item) => {
    const d = findDef(item.itemId);
    if (!d || Math.hypot(item.x * m - ray.origin.x, item.y * m - ray.origin.z) > reach) return;
    if (isSlab(d)) {
      const level = slabLevel(item, d);
      const shape = d.shape as SlabShape;
      if (isWall) getEdges(shape, item.x, item.y, item.rotation).forEach((e) => add(e.x, e.y, level, normalizeAngle(e.angle + 90)));
      else getPolygonVertices(shape, item.x, item.y, item.rotation).forEach((v) => add(v.x, v.y, level, 0));
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
    items.some((o) => (o.floor || 0) === floor && findDef(o.itemId)?.shape === def.shape && Math.hypot(o.x - x, o.y - y) < 2);

  let best: PlacedItem | null = null;
  let bestScore = SLOT_RANGE * SLOT_RANGE;
  spots.forEach((s) => {
    // Ściana/filar stojący na krawędzi albo wiszący pod nią.
    for (const floor of [s.level, s.level - 1]) {
      if (floor < 0 || occupied(s.x, s.y, floor)) continue;
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
    const key = `${Math.round(x)},${Math.round(y)},${level}`;
    if (!edges.has(key)) edges.set(key, { x, y, level, angle });
  };
  items.forEach((item) => {
    const d = findDef(item.itemId);
    if (!d || Math.hypot(item.x * m - ray.origin.x, item.y * m - ray.origin.z) > reach) return;
    if (isSlab(d)) {
      const level = slabLevel(item, d);
      if (!roofLike && level !== 0) return;
      getEdges(d.shape as SlabShape, item.x, item.y, item.rotation).forEach((e) => add(e.x, e.y, level, e.angle));
    } else if (roofLike && d.shape === 'wall') {
      add(item.x, item.y, (item.floor || 0) + 1, normalizeAngle(item.rotation - 90));
    }
  });

  let best: PlacementResult | null = null;
  let bestScore = SLOT_RANGE * SLOT_RANGE;
  const offset = 1.5 * UNITS_PER_METER; // HALF_EDGE_LENGTH * 0.5
  edges.forEach((e) => {
    const floor = roofLike ? e.level - 1 : e.level;
    if (floor < 0) return;
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
      const res = computePlacement({ def, items, cursor: { x: tx, y: ty }, floor, turn });
      if (!res.preview || !res.valid || Math.hypot(res.preview.x - tx, res.preview.y - ty) > SIDE * 0.75) continue;
      best = res;
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
  if (da.shape !== db.shape || da.part !== db.part || (a.floor || 0) !== (b.floor || 0)) return false;
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
              if (g.level !== level) return;
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
export function computePaste({ clip, items, cursor, floor, turn }: {
  clip: PlacedItem[];
  items: PlacedItem[];
  cursor: Point;
  floor: number;
  turn: number;
}): PasteResult {
  const minFloor = Math.min(...clip.map((i) => i.floor || 0));
  // Punkt zaczepienia: płyta z najniższego piętra, inaczej pierwszy element.
  const ref = clip.find((i) => (i.floor || 0) === minFloor && isSlab(findDef(i.itemId))) ?? clip[0];
  const rot = (turn % 4) * 90;
  const turnAround = rotator(0, 0, rot);
  const moved = clip.map((i) => {
    const p = turnAround(i.x - ref.x, i.y - ref.y);
    return { ...i, x: ref.x + p.x, y: ref.y + p.y, rotation: normalizeAngle(i.rotation + rot), floor: (i.floor || 0) - minFloor + floor };
  });

  const { dx, dy, snapPoint } = snapGroupDelta(moved, items, { x: cursor.x - ref.x, y: cursor.y - ref.y });
  const out: PlacedItem[] = [];
  const invalid = new Set<string>();
  moved.forEach((i) => {
    const def = findDef(i.itemId);
    if (!def) return;
    const p = { ...i, x: round3(i.x + dx), y: round3(i.y + dy) };
    if (items.some((o) => {
      const d = findDef(o.itemId);
      return !!d && isDuplicate(p, def, o, d);
    })) return;
    const groundOnly = (def.part === 'floor' || def.part === 'tri_floor') && (p.floor || 0) > 0;
    if (groundOnly || !isValid(def, p, items)) invalid.add(i.id);
    out.push(p);
  });
  return { items: out, invalid, valid: out.length > 0 && invalid.size === 0, snapPoint };
}

// --- Koszty ---

export function computeMaterials(items: PlacedItem[]) {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const def = findDef(item.itemId);
    if (def) counts[def.id] = (counts[def.id] || 0) + 1;
  });
  const totals: Record<string, number> = {};
  Object.entries(counts).forEach(([id, count]) => {
    const def = findDef(id)!;
    Object.entries(def.costs).forEach(([mat, qty]) => {
      if (qty > 0) totals[mat] = (totals[mat] || 0) + qty * count;
    });
  });
  return totals;
}

export const newItemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
