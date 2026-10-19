"use client";

/*
  Plan 2D na jednym <canvas>.
  Zamiast tysięcy elementów DOM: elementy są grupowane (piętro, warstwa, wygląd), każda grupa to jedna Path2D
  budowana tylko przy zmianie planu. Klatka to setTransform widoku i kilkadziesiąt wypełnień.
  Wzory (słoje, siatka metalu, kreskowanie dachów) to CanvasPattern tworzone raz.
  Wygląd odtwarza dawne style CSS elementów (builder.module.css).
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import { BED_CLAIM_RADIUS, TRI_H, TRI_R, findDef, isRoofLayer, type BuildItem, type PlacedItem } from '@/lib/builder';

/** Kolejność warstw w rzucie: płyty, ściany, filary, dachy na wierzchu. */
export const layerOf = (def: BuildItem) => {
  if (isRoofLayer(def)) return 30;
  if (def.shape === 'hatch') return 35;
  if (def.shape === 'wall') return 20;
  if (def.shape === 'pillar') return 25;
  if (def.shape === 'bed') return 15;
  return 10;
};

export type HoverMode = 'paint' | 'remove';

interface Props {
  /** Elementy do narysowania (bez aktualnie przeciąganych). */
  items: PlacedItem[];
  currentFloor: number;
  showBedAreas: boolean;
  selectedIds: ReadonlySet<string>;
  hover: { id: string; mode: HoverMode } | null;
  drag: { items: PlacedItem[]; dx: number; dy: number } | null;
  pan: { x: number; y: number };
  scale: number;
}

type Paint = string | CanvasPattern | CanvasGradient;
interface Op {
  path: Path2D;
  fill?: Paint;
  stroke?: Paint;
  lineWidth?: number;
  dash?: number[];
  alpha: number;
}
interface BedImage {
  m: DOMMatrix;
  alpha: number;
}

const LOWER_FLOOR_ALPHA = 0.22;
const ROOF_ALPHA = 0.8;
const DARK = (a: number) => `rgba(0,0,0,${a})`;
const LIGHT = (a: number) => `rgba(255,255,255,${a})`;

// --- Kształty lokalne (środek elementu w 0,0, przed obrotem) ---

const rectPath = (x: number, y: number, w: number, h: number) => {
  const p = new Path2D();
  p.rect(x, y, w, h);
  return p;
};
const centered = (hw: number, hh: number) => rectPath(-hw, -hh, hw * 2, hh * 2);
const triPath = (grow = 0) => {
  // trójkąt ze środkiem w centroidzie; grow > 0 powiększa go o tyle jednostek (obrys zaznaczenia)
  const k = (TRI_R + grow) / TRI_R;
  const p = new Path2D();
  p.moveTo(-30 * k, TRI_R * k);
  p.lineTo(30 * k, TRI_R * k);
  p.lineTo(0, (TRI_R - TRI_H) * k);
  p.closePath();
  return p;
};

const SHAPES = {
  square: centered(30, 30),
  squareInset: centered(29.5, 29.5),
  tri: triPath(),
  triInset: triPath(-0.5),
  wall: centered(30, 2.5),
  wallOutline: centered(31, 3.5),
  rampart: centered(30, 1.5),
  rampartOutline: centered(31, 2.5),
  doorway: (() => {
    const p = rectPath(-30, -2.5, 21.6, 5);
    p.rect(8.4, -2.5, 21.6, 5);
    return p;
  })(),
  garageSides: (() => {
    const p = rectPath(-30, -2.5, 7.8, 5);
    p.rect(22.2, -2.5, 7.8, 5);
    return p;
  })(),
  garageMiddle: rectPath(-22.2, -2.5, 44.4, 5),
  windowBand: rectPath(-9, -2.5, 18, 5),
  pillar: centered(5, 5),
  pillarRing: centered(7, 7),
  post: centered(3.5, 3.5),
  postRing: centered(5.5, 5.5),
  hatch: centered(11, 11),
  hatchRing: centered(13, 13),
  hatchStripe: rectPath(4.4, -11, 3.3, 22),
  holeCut: centered(12, 12),
  holeCutOutline: centered(13, 13),
  triHoleCut: centered(11, 11),
  stairsSteps: rectPath(-16.2, -30, 32.4, 60),
  stairsLines: (() => {
    // ciemne stopnie co 6.6 jednostki od dołu, każdy 1.6 grubości
    const p = new Path2D();
    for (let y = 30 - 5; y > -30; y -= 6.6) p.rect(-16.2, y - 1.6, 32.4, 1.6);
    return p;
  })(),
  bed: centered(10, 20),
  bedInset: centered(9.5, 19.5),
};

/** Obrys do zaznaczenia i podświetlenia: pudełko elementu (tak jak dawny outline CSS). */
function boxPath(def: BuildItem, grow: number): Path2D {
  switch (def.shape) {
    case 'triangle':
      return triPath(grow);
    case 'wall':
      return def.part === 'rampart' ? centered(30 + grow, 1.5 + grow) : centered(30 + grow, 2.5 + grow);
    case 'pillar':
      return def.part === 'post' ? centered(3.5 + grow, 3.5 + grow) : centered(5 + grow, 5 + grow);
    case 'hatch':
      return centered(11 + grow, 11 + grow);
    case 'bed':
      return centered(10 + grow, 20 + grow);
    default:
      return centered(30 + grow, 30 + grow);
  }
}

// --- Wzory: kafelek rysowany raz, potem tylko powtarzany ---

type PatternKind = 'wood' | 'metal' | 'roof' | 'rampart';
const patternCache = new Map<string, CanvasPattern | null>();

function tile(kind: PatternKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  if (kind === 'wood') {
    // pionowe słoje: 1 jednostka ciemna co 10
    c.width = 10; c.height = 10;
    g.fillStyle = DARK(0.16); g.fillRect(0, 0, 1, 10);
  } else if (kind === 'metal') {
    // siatka blachy co 30
    c.width = 30; c.height = 30;
    g.fillStyle = DARK(0.2); g.fillRect(0, 0, 30, 1); g.fillRect(0, 0, 1, 30);
  } else if (kind === 'roof') {
    // kreskowanie dachu: pas 2 jednostki co 8 (obracany o -45°)
    c.width = 8; c.height = 8;
    g.fillStyle = DARK(0.28); g.fillRect(0, 0, 2, 8);
  } else {
    // murek: przerwy 2 jednostki co 8
    c.width = 8; c.height = 8;
    g.fillStyle = DARK(0.4); g.fillRect(6, 0, 2, 8);
  }
  return c;
}

/** Wzór w układzie planu, obrócony razem z elementem. Klucz obejmuje obrót, więc obiekt powstaje raz na kombinację. */
function pattern(kind: PatternKind, rotation: number): CanvasPattern | null {
  const rot = kind === 'roof' ? rotation - 45 : rotation;
  const key = `${kind}:${((rot % 360) + 360) % 360}`;
  if (patternCache.has(key)) return patternCache.get(key)!;
  const p = document.createElement('canvas').getContext('2d')!.createPattern(tile(kind), 'repeat');
  p?.setTransform(new DOMMatrix().rotate(rot));
  patternCache.set(key, p);
  return p;
}

// --- Budowanie grup ---

class Batch {
  /**
   * Przebiegi w kolejności rysowania w obrębie jednej warstwy jednego piętra.
   * W jednym przebiegu kolejność grup nie może mieć znaczenia (każda grupa maluje tylko swoje elementy),
   * dlatego wszystko, co leży na wierzchu innego wypełnienia tego samego elementu, ma osobny przebieg.
   */
  private passes = [new Map<string, Op>(), new Map<string, Op>(), new Map<string, Op>(), new Map<string, Op>(), new Map<string, Op>()];
  private loose: Op[] = [];

  add(pass: number, key: string, local: Path2D, m: DOMMatrix, style: Omit<Op, 'path'>) {
    const map = this.passes[pass];
    const k = `${key}|${style.alpha}`;
    let op = map.get(k);
    if (!op) map.set(k, (op = { ...style, path: new Path2D() }));
    op.path.addPath(local, m);
  }

  /** Element z własnym gradientem: nie da się go połączyć z innymi. */
  addLoose(op: Op) {
    this.loose.push(op);
  }

  ops(): Op[] {
    const [outline, body, detail, cut, inset] = this.passes.map((p) => [...p.values()]);
    return [...outline, ...body, ...detail, ...this.loose, ...cut, ...inset];
  }
}

const OUTLINE = 0, BODY = 1, DETAIL = 2, CUT = 3, INSET = 4;

function itemMatrix(item: PlacedItem, dx = 0, dy = 0) {
  return new DOMMatrix().translate(item.x + dx, item.y + dy).rotate(item.rotation);
}

function addItem(batch: Batch, beds: BedImage[], item: PlacedItem, def: BuildItem, alpha: number, canvasColor: string) {
  const m = itemMatrix(item);
  const c = item.customColor || def.color;
  const part = def.part;
  const roofLike = part === 'roof' || part === 'tri_roof' || part === 'hole' || part === 'tri_hole';
  const a = roofLike ? alpha * ROOF_ALPHA : alpha;
  const rot = item.rotation;
  const inset = { stroke: DARK(0.35), lineWidth: 1, alpha: a };

  switch (def.shape) {
    case 'square': {
      if (part === 'stairs') {
        batch.add(BODY, 'sq-dark', SHAPES.square, m, { fill: DARK(0.25), alpha: a });
        batch.add(DETAIL, `steps:${c}`, SHAPES.stairsSteps, m, { fill: c, alpha: a });
        batch.add(CUT, 'steps-lines', SHAPES.stairsLines, m, { fill: DARK(0.45), alpha: a });
      } else {
        batch.add(BODY, `sq:${c}`, SHAPES.square, m, { fill: c, alpha: a });
        if (roofLike) batch.add(DETAIL, `roof:${rot}`, SHAPES.square, m, { fill: pattern('roof', rot) ?? DARK(0.1), alpha: a });
        else if (part === 'ramp') {
          // ramp: ciemny dół, jasna góra (gradient w układzie planu)
          const p0 = m.transformPoint({ x: 0, y: 30 }), p1 = m.transformPoint({ x: 0, y: -30 });
          const g = document.createElement('canvas').getContext('2d')!.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
          g.addColorStop(0, DARK(0.45)); g.addColorStop(1, LIGHT(0.25));
          const path = new Path2D(); path.addPath(SHAPES.square, m);
          batch.addLoose({ path, fill: g, alpha: a });
        } else if (def.material === 'metal') batch.add(DETAIL, `metal:${rot}`, SHAPES.square, m, { fill: pattern('metal', rot) ?? c, alpha: a });
        else batch.add(DETAIL, `wood:${rot}`, SHAPES.square, m, { fill: pattern('wood', rot) ?? c, alpha: a });
        if (part === 'hole') {
          batch.add(CUT, 'hole-outline', SHAPES.holeCutOutline, m, { fill: DARK(0.5), alpha: a });
          // otwór kryje dach w całości (dawniej przezroczystość działała na cały element naraz)
          batch.add(CUT, 'hole-cut', SHAPES.holeCut, m, { fill: canvasColor, alpha });
        }
      }
      batch.add(INSET, 'sq-inset', SHAPES.squareInset, m, inset);
      break;
    }
    case 'triangle': {
      batch.add(BODY, `tri:${c}`, SHAPES.tri, m, { fill: c, alpha: a });
      if (roofLike) batch.add(DETAIL, `troof:${rot}`, SHAPES.tri, m, { fill: pattern('roof', rot) ?? DARK(0.1), alpha: a });
      else if (def.material === 'metal') batch.add(DETAIL, `tmetal:${rot}`, SHAPES.tri, m, { fill: pattern('metal', rot) ?? c, alpha: a });
      else batch.add(DETAIL, `twood:${rot}`, SHAPES.tri, m, { fill: pattern('wood', rot) ?? c, alpha: a });
      if (part === 'tri_hole') batch.add(CUT, 'tri-cut', SHAPES.triHoleCut, m, { fill: canvasColor, alpha });
      batch.add(INSET, 'tri-inset', SHAPES.triInset, m, inset);
      break;
    }
    case 'wall': {
      if (part === 'rampart') {
        batch.add(OUTLINE, 'rampart-outline', SHAPES.rampartOutline, m, { fill: DARK(0.5), alpha: a });
        batch.add(BODY, `rampart:${c}`, SHAPES.rampart, m, { fill: c, alpha: a });
        batch.add(DETAIL, `rampart:${rot}`, SHAPES.rampart, m, { fill: pattern('rampart', rot) ?? c, alpha: a });
      } else if (part === 'doorway') {
        batch.add(BODY, `door:${c}`, SHAPES.doorway, m, { fill: c, alpha: a });
      } else if (part === 'garage') {
        batch.add(BODY, `garage:${c}`, SHAPES.garageSides, m, { fill: c, alpha: a });
        batch.add(DETAIL, 'garage-mid', SHAPES.garageMiddle, m, { fill: LIGHT(0.12), alpha: a });
      } else if (part === 'ramp_wall') {
        const p0 = m.transformPoint({ x: -30, y: 0 }), p1 = m.transformPoint({ x: 30, y: 0 });
        const g = document.createElement('canvas').getContext('2d')!.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c);
        const path = new Path2D(); path.addPath(SHAPES.wall, m);
        batch.addLoose({ path, fill: g, alpha: a });
      } else {
        batch.add(OUTLINE, 'wall-outline', SHAPES.wallOutline, m, { fill: DARK(0.5), alpha: a });
        batch.add(BODY, `wall:${c}`, SHAPES.wall, m, { fill: c, alpha: a });
        if (part === 'window') batch.add(CUT, 'window', SHAPES.windowBand, m, { fill: LIGHT(0.55), alpha: a });
      }
      break;
    }
    case 'pillar': {
      const post = part === 'post';
      batch.add(OUTLINE, post ? 'post-ring' : 'pillar-ring', post ? SHAPES.postRing : SHAPES.pillarRing, m, { fill: canvasColor, alpha: a });
      batch.add(BODY, `pillar:${c}`, post ? SHAPES.post : SHAPES.pillar, m, { fill: c, alpha: a });
      break;
    }
    case 'hatch': {
      batch.add(OUTLINE, 'hatch-ring', SHAPES.hatchRing, m, { fill: canvasColor, alpha: a });
      batch.add(BODY, `hatch:${c}`, SHAPES.hatch, m, { fill: c, alpha: a });
      batch.add(CUT, 'hatch-stripe', SHAPES.hatchStripe, m, { fill: DARK(0.35), alpha: a });
      break;
    }
    case 'bed': {
      batch.add(BODY, `bed:${c}`, SHAPES.bed, m, { fill: c, alpha: a });
      batch.add(INSET, 'bed-inset', SHAPES.bedInset, m, inset);
      beds.push({ m, alpha: a });
      break;
    }
  }
}

interface Scene {
  claims: Op[];
  ops: Op[];
  beds: BedImage[];
}

function buildScene(items: PlacedItem[], floor: number, showBedAreas: boolean, colors: Colors): Scene {
  // piętro, potem warstwa (jak dawny z-index: warstwa + piętro * 40); wyższe piętra ukryte
  const buckets = new Map<number, Batch>();
  const beds: BedImage[] = [];
  const claimPath = new Path2D();
  let anyClaim = false;
  for (const item of items) {
    const f = item.floor || 0;
    if (f > floor) continue;
    const def = findDef(item.itemId);
    if (!def) continue;
    const z = f * 40 + layerOf(def);
    let batch = buckets.get(z);
    if (!batch) buckets.set(z, (batch = new Batch()));
    addItem(batch, beds, item, def, f < floor ? LOWER_FLOOR_ALPHA : 1, colors.canvas);
    if (def.shape === 'bed' && showBedAreas && f === floor) {
      claimPath.moveTo(item.x + BED_CLAIM_RADIUS, item.y);
      claimPath.arc(item.x, item.y, BED_CLAIM_RADIUS, 0, Math.PI * 2);
      anyClaim = true;
    }
  }
  const ops = [...buckets.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, batch]) => batch.ops());
  const claims: Op[] = anyClaim
    ? [
        { path: claimPath, fill: `rgba(${colors.accentRgb},0.06)`, alpha: 1 },
        { path: claimPath, stroke: `rgba(${colors.accentRgb},0.45)`, lineWidth: 2, dash: [8, 6], alpha: 1 },
      ]
    : [];
  return { claims, ops, beds };
}

interface Colors {
  canvas: string;
  accent: string;
  accentRgb: string;
  danger: string;
}

function readColors(): Colors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    canvas: v('--canvas', '#0e140f'),
    accent: v('--accent', '#8dc46f'),
    accentRgb: v('--accent-rgb', '141 196 111').split(/\s+/).join(','),
    danger: v('--danger', '#e5484d'),
  };
}

function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]) {
  for (const op of ops) {
    ctx.globalAlpha = op.alpha;
    if (op.fill) {
      ctx.fillStyle = op.fill;
      ctx.fill(op.path);
    }
    if (op.stroke) {
      ctx.strokeStyle = op.stroke;
      ctx.lineWidth = op.lineWidth ?? 1;
      ctx.setLineDash(op.dash ?? []);
      ctx.stroke(op.path);
    }
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

export default function PlanCanvas({ items, currentFloor, showBedAreas, selectedIds, hover, drag, pan, scale }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [colors, setColors] = useState<Colors | null>(null);
  const [bedIcon, setBedIcon] = useState<HTMLImageElement | null>(null);

  // Rozmiar płótna = rozmiar kontenera × devicePixelRatio (ostre krawędzie na ekranach HiDPI)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setColors(readColors());
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height), dpr: window.devicePixelRatio || 1 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const def = findDef('bed');
    if (!def) return;
    const img = new Image();
    img.onload = () => setBedIcon(img);
    img.src = def.icon;
  }, []);

  const scene = useMemo(
    () => (colors ? buildScene(items, currentFloor, showBedAreas, colors) : null),
    [items, currentFloor, showBedAreas, colors],
  );

  // Zaznaczenie: jeden obrys na wszystkie zaznaczone elementy bieżącego piętra
  const selection = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const path = new Path2D();
    for (const item of items) {
      if (!selectedIds.has(item.id) || (item.floor || 0) !== currentFloor) continue;
      const def = findDef(item.itemId);
      if (def) path.addPath(boxPath(def, 2), itemMatrix(item));
    }
    return path;
  }, [items, selectedIds, currentFloor]);

  // Przeciągane elementy: osobna mała scena, budowana raz na początku przeciągania i rysowana z przesunięciem
  const dragItems = drag?.items ?? null;
  const dragScene = useMemo(
    () => (colors && dragItems ? buildScene(dragItems, currentFloor, false, colors) : null),
    [dragItems, currentFloor, colors],
  );
  const dragOutline = useMemo(() => {
    if (!dragItems) return null;
    const path = new Path2D();
    for (const item of dragItems) {
      const def = findDef(item.itemId);
      if (def) path.addPath(boxPath(def, 2), itemMatrix(item));
    }
    return path;
  }, [dragItems]);

  const hoverPath = useMemo(() => {
    if (!hover) return null;
    const item = items.find((i) => i.id === hover.id);
    const def = item && findDef(item.itemId);
    if (!item || !def) return null;
    const path = new Path2D();
    path.addPath(boxPath(def, hover.mode === 'remove' ? 1 : 0), itemMatrix(item));
    return path;
  }, [hover, items]);

  // Rysowanie: raz na klatkę, niezależnie od liczby zmian stanu w tej klatce
  const frame = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !scene || !colors || size.w === 0) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const { w, h, dpr } = size;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      const ctx = el.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      const view = new DOMMatrix([dpr * scale, 0, 0, dpr * scale, dpr * pan.x, dpr * pan.y]);
      ctx.setTransform(view);

      drawOps(ctx, scene.claims);
      drawOps(ctx, scene.ops);
      if (bedIcon) {
        for (const bed of scene.beds) {
          ctx.globalAlpha = bed.alpha;
          ctx.setTransform(view.multiply(bed.m).rotate(90));
          ctx.drawImage(bedIcon, -20, -10, 40, 20);
        }
        ctx.globalAlpha = 1;
        ctx.setTransform(view);
      }

      if (selection) drawOps(ctx, [{ path: selection, stroke: colors.accent, lineWidth: 2, alpha: 1 }]);

      if (hoverPath && hover) {
        drawOps(ctx, [
          hover.mode === 'remove'
            ? { path: hoverPath, stroke: colors.danger, lineWidth: 2, alpha: 1 }
            : { path: hoverPath, fill: LIGHT(0.2), alpha: 1 },
        ]);
      }

      if (drag && dragScene) {
        const moved = view.translate(drag.dx, drag.dy);
        ctx.setTransform(moved);
        drawOps(ctx, dragScene.ops);
        if (dragOutline) drawOps(ctx, [{ path: dragOutline, stroke: colors.accent, lineWidth: 2, alpha: 1 }]);
        ctx.setTransform(view);
      }
    });
    return () => cancelAnimationFrame(frame.current);
  }, [scene, selection, hoverPath, hover, drag, dragScene, dragOutline, pan, scale, size, colors, bedIcon]);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden />;
}
