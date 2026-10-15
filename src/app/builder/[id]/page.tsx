"use client";

import React, { useState, useMemo, useRef, useEffect, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  Bed,
  Cube,
  DownloadSimple,
  Keyboard,
  MagnifyingGlass,
  MapTrifold,
  Moon,
  SunHorizon,
  PaintBucket,
  PencilSimple,
  SidebarSimple,
  Sun,
  Trash,
  X,
} from '@phosphor-icons/react';
import styles from '../builder.module.css';
import { useAppStore } from '@/store/useAppStore';
import { exportProject, getProject, updateProject, type Project } from '@/lib/projects';
import type { Site } from '@/lib/terrain';
import { DEFAULT_SCENE, MODE_LABELS, SKY_HEIGHTS, TIME_LABELS, type SceneSettings, type TimeOfDay } from '@/lib/scene';
import MapPicker from '@/components/MapPicker';
import SiteUnderlay from '@/components/SiteUnderlay';
import {
  BED,
  BED_CLAIM_RADIUS,
  FLOORS,
  MATERIALS,
  REMOVER,
  computePaste,
  computePlacement,
  findDef,
  floorLabel,
  isRoofLayer,
  itemsForMaterial,
  getPolygonVertices,
  newItemId,
  pointInPolygon,
  snapGroupDelta,
  type BuildItem,
  type MaterialId,
  type PartId,
  type PlacedItem,
} from '@/lib/builder';

const Builder3D = dynamic(() => import('@/components/Builder3D'), {
  ssr: false,
  loading: () => <div className={styles.loading3d}>Ładowanie widoku 3D</div>,
});

const PAINT_COLORS = ['#d9534f', '#e8692f', '#e2b93b', '#8dc46f', '#3e8ed0', '#8e6bbf', '#c9ccd1', '#3a3d42'];

type SidebarTab = 'blocks' | 'map' | 'color' | 'hotkeys';

const TABS: { id: SidebarTab; label: string; Icon: typeof Cube }[] = [
  { id: 'blocks', label: 'Klocki', Icon: Cube },
  { id: 'map', label: 'Teren', Icon: MapTrifold },
  { id: 'color', label: 'Kolor', Icon: PaintBucket },
  { id: 'hotkeys', label: 'Skróty', Icon: Keyboard },
];

/** Grupy w przyborniku. Klawisze 1-9 dalej idą po kolejności PARTS. */
const PART_GROUPS: { label: string; parts: PartId[] }[] = [
  { label: 'Podłogi i dachy', parts: ['floor', 'tri_floor', 'roof', 'tri_roof', 'hole', 'tri_hole', 'hatch'] },
  { label: 'Ściany', parts: ['wall', 'doorway', 'window', 'garage', 'rampart', 'ramp_wall'] },
  { label: 'Filary', parts: ['pillar', 'post'] },
  { label: 'Schody i rampy', parts: ['stairs', 'ramp'] },
];

const HOTKEYS: { keys: string[]; label: string }[] = [
  { keys: ['1', '9'], label: 'element z przybornika' },
  { keys: ['X'], label: 'wyburzanie' },
  { keys: ['B'], label: 'łóżko' },
  { keys: ['R'], label: 'obrót, inna krawędź' },
  { keys: ['PgUp', 'PgDn'], label: '2D: piętro wyżej, niżej' },
  { keys: ['Klik'], label: '3D: przejmij kamerę, Esc oddaje kursor' },
  { keys: ['W', 'A', 'S', 'D'], label: '3D: ruch, Shift szybciej' },
  { keys: ['Spacja', 'Q'], label: '3D: w górę, w dół (chodząc: skok)' },
  { keys: ['F'], label: '3D: latanie albo chodzenie' },
  { keys: ['Esc'], label: 'odłóż element, odznacz' },
  { keys: ['LPM'], label: 'stawianie, zaznaczanie, przeciąganie' },
  { keys: ['PPM'], label: 'przesuwanie widoku 2D' },
  { keys: ['Kółko'], label: 'przybliżenie 2D' },
  { keys: ['Shift', 'Klik'], label: 'zaznacz kilka' },
  { keys: ['Delete'], label: 'usuń zaznaczone' },
  { keys: ['Ctrl', 'C'], label: 'kopiuj zaznaczone' },
  { keys: ['Ctrl', 'V'], label: 'wklej: podgląd pod kursorem, R obraca, klik wstawia' },
  { keys: ['Ctrl', 'Z'], label: 'cofnij' },
  { keys: ['Ctrl', 'Y'], label: 'ponów' },
];

const shapeClassFor = (def: BuildItem) => {
  switch (def.shape) {
    case 'bed': return styles.shapeBed;
    case 'wall': return def.part === 'rampart' ? styles.shapeRampart : styles.shapeWall;
    case 'pillar': return def.part === 'post' ? styles.shapePost : styles.shapePillar;
    case 'triangle': return styles.shapeTriangle;
    case 'hatch': return styles.shapeHatch;
    default: return styles.shapeSquare;
  }
};

const itemTransform = (def: BuildItem, rotation: number) =>
  def.shape === 'triangle'
    ? `translate(-50%, -66.666%) rotate(${rotation}deg)`
    : `translate(-50%, -50%) rotate(${rotation}deg)`;

/** Wnętrze elementu w rzucie 2D (otwór, stopnie schodów, ikona łóżka). */
const renderInterior = (def: BuildItem) => {
  if (def.shape === 'bed') return <img src={def.icon} alt="" className={styles.bedIcon} />;
  if (def.part === 'hole') return <span className={styles.holeCut} />;
  if (def.part === 'tri_hole') return <span className={styles.triHoleCut} />;
  if (def.part === 'stairs') return <span className={styles.stairsSteps} />;
  return null;
};

/** Kolejność warstw w rzucie: płyty, ściany, filary, dachy na wierzchu. */
const layerOf = (def: BuildItem) => {
  if (isRoofLayer(def)) return 30;
  if (def.shape === 'hatch') return 35;
  if (def.shape === 'wall') return 20;
  if (def.shape === 'pillar') return 25;
  if (def.shape === 'bed') return 15;
  return 10;
};

/** Obrys elementu do trafiania kursorem (jak w rzucie: ściana 60x5, filar 10x10...), z małym zapasem. */
const hitPolygon = (item: PlacedItem, def: BuildItem) => {
  if (def.shape === 'square' || def.shape === 'triangle') return getPolygonVertices(def.shape, item.x, item.y, item.rotation);
  const half: Record<string, [number, number]> = { wall: [30, 4], pillar: [6, 6], hatch: [11, 11], bed: [10, 20] };
  const [hw, hh] = half[def.shape] ?? [5, 5];
  const r = (item.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: item.x + x * c - y * s, y: item.y + x * s + y * c }));
};

const RenderedItem = React.memo(({
  item, def, currentFloor, showBedAreas, isSelected, hoverMark = false,
}: {
  item: PlacedItem;
  def: BuildItem;
  currentFloor: number;
  showBedAreas: boolean;
  isSelected: boolean;
  hoverMark?: boolean;
}) => {
  const itemFloor = item.floor || 0;
  if (itemFloor > currentFloor) return null; // wyższe piętra ukryte

  const isLowerFloor = itemFloor < currentFloor;

  return (
    <>
      {def.shape === 'bed' && showBedAreas && !isLowerFloor && (
        <div
          className={styles.claim}
          style={{ left: item.x, top: item.y, width: BED_CLAIM_RADIUS * 2, height: BED_CLAIM_RADIUS * 2 }}
        />
      )}
      <div
        className={`${styles.placedItem} ${shapeClassFor(def)} ${isSelected ? styles.selected : ''} ${hoverMark ? styles.hoverMark : ''}`}
        data-part={def.part}
        data-material={def.material}
        style={{
          left: item.x,
          top: item.y,
          transform: itemTransform(def, item.rotation),
          transformOrigin: def.shape === 'triangle' ? '50% 66.666%' : '50% 50%',
          '--c': item.customColor || def.color,
          opacity: isLowerFloor ? 0.22 : undefined,
          zIndex: hoverMark ? 900 : layerOf(def) + itemFloor * 40,
        } as React.CSSProperties}
      >
        {renderInterior(def)}
      </div>
    </>
  );
});
RenderedItem.displayName = 'RenderedItem';

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export default function BuilderCanvas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addNotification } = useAppStore();

  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [material, setMaterial] = useState<MaterialId>('maple');
  const [turn, setTurn] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startMousePos: { x: number; y: number };
    initialItems: PlacedItem[];
    preDragState: PlacedItem[];
    dx: number;
    dy: number;
  } | null>(null);
  const [clipboard, setClipboard] = useState<PlacedItem[]>([]);
  /** Tryb wklejania: podgląd schowka pod kursorem; turn = liczba obrotów o 90°. */
  const [paste, setPaste] = useState<{ turn: number } | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [past, setPast] = useState<PlacedItem[][]>([]);
  const [future, setFuture] = useState<PlacedItem[][]>([]);
  const placedItemsRef = useRef<PlacedItem[]>([]);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    placedItemsRef.current = placedItems;
  }, [placedItems]);

  const commitAction = (newItems: PlacedItem[]) => {
    setPast(prev => {
      const nextPast = [...prev, placedItemsRef.current];
      return nextPast.length > 50 ? nextPast.slice(nextPast.length - 50) : nextPast;
    });
    setFuture([]);
    setPlacedItems(newItems);
  };

  const undo = () => {
    if (past.length === 0) return;
    setFuture(f => [...f, placedItemsRef.current]);
    setPlacedItems(past[past.length - 1]);
    setPast(p => p.slice(0, p.length - 1));
  };

  const redo = () => {
    if (future.length === 0) return;
    setPast(p => [...p, placedItemsRef.current]);
    setPlacedItems(future[future.length - 1]);
    setFuture(f => f.slice(0, f.length - 1));
  };

  const [selectedColor, setSelectedColor] = useState<string>(''); // '' = bez malowania, 'clear' = zdejmij kolor
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [is3DMode, setIs3DMode] = useState(false);
  // Malowanie dotyczy tylko planu 2D; w 3D struktury wyglądają jak w grze.
  const tab: SidebarTab = is3DMode && sidebarTab === 'color' ? 'blocks' : sidebarTab;
  const [showBedAreas, setShowBedAreas] = useState(true);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [showUnderlay, setShowUnderlay] = useState(true);

  const materialItems = useMemo(() => itemsForMaterial(material), [material]);
  const hotbar = useMemo(() => [REMOVER, ...materialItems.slice(0, 9)], [materialItems]);

  const itemCounts = useMemo(() => {
    const map: Record<string, number> = {};
    placedItems.forEach(i => {
      const def = findDef(i.itemId);
      if (def) map[def.id] = (map[def.id] || 0) + 1;
    });
    return map;
  }, [placedItems]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return materialItems;
    const q = searchQuery.toLowerCase();
    return materialItems.filter(i => i.name.toLowerCase().includes(q));
  }, [searchQuery, materialItems]);

  // Wczytanie projektu z localStorage
  useEffect(() => {
    const p = getProject(id);
    if (!p) {
      // localStorage jest dostępny dopiero po montażu
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotFound(true);
      return;
    }
    setProject(p);
    setPlacedItems(p.items);
    lastSavedRef.current = JSON.stringify(p.items);
    if (window.innerWidth < 900) setIsSidebarCollapsed(true);
  }, [id]);

  // Autozapis (debounce)
  useEffect(() => {
    if (!project) return;
    const dataStr = JSON.stringify(placedItems);
    if (dataStr === lastSavedRef.current) return;
    const timeout = setTimeout(() => {
      updateProject(id, { items: placedItems });
      lastSavedRef.current = dataStr;
      setSavedAt(new Date());
    }, 400);
    return () => clearTimeout(timeout);
  }, [placedItems, project, id]);

  const scene = project?.scene ?? DEFAULT_SCENE;
  const setScene = (patch: Partial<SceneSettings>) => {
    if (!project) return;
    const next = { ...scene, ...patch };
    updateProject(id, { scene: next });
    setProject({ ...project, scene: next });
  };

  // Skybase nie może przebić twardego limitu budowania (1024 m świata, docs/sky-limits.md); zapas na kilka pięter.
  const maxSkyHeight = Math.max(20, Math.floor((1024 - (project?.site?.elevation ?? 0) - 30) / 5) * 5);

  // Piętra w 2D: presety Parter-3, lista rośnie, gdy w 3D zbudowano wyżej.
  const floorsList = useMemo(() => {
    const top = placedItems.reduce((m, i) => Math.max(m, i.floor || 0), 0);
    return Array.from({ length: Math.max(FLOORS.length, top + 2) }, (_, i) => i);
  }, [placedItems]);

  const setSite = (site: Site | undefined) => {
    if (!project) return;
    updateProject(id, { site });
    setProject({ ...project, site });
  };

  const saveName = () => {
    const name = editName.trim();
    setIsEditingName(false);
    if (!project || !name || name === project.name) return;
    updateProject(id, { name });
    setProject({ ...project, name });
  };

  const selectItem = (itemId: string | null) => {
    setPaste(null);
    setActiveItem(prev => (prev === itemId ? null : itemId));
    setTurn(0);
  };

  // Widok 2D
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Wyśrodkowanie widoku na bazie przy pierwszym wczytaniu
  const centeredRef = useRef(false);
  useEffect(() => {
    if (!project || centeredRef.current || is3DMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    centeredRef.current = true;
    const items = project.items;
    if (items.length === 0) {
      setPan({ x: rect.width / 2, y: rect.height / 2 });
      return;
    }
    const xs = items.map(i => i.x), ys = items.map(i => i.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    setPan({ x: rect.width / 2 - cx, y: rect.height / 2 - cy });
  }, [project, is3DMode]);

  // Blokada przewijania strony kółkiem nad płótnem
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventScroll = (e: WheelEvent) => {
      if (el.contains(e.target as Node)) e.preventDefault();
    };
    document.addEventListener('wheel', preventScroll, { passive: false });
    return () => document.removeEventListener('wheel', preventScroll);
  }, []);

  const activeDef = activeItem ? findDef(activeItem) : undefined;
  const isRemoverActive = activeDef?.shape === 'remover';

  const deleteSelection = () => {
    if (selectedItemIds.length > 0) {
      commitAction(placedItems.filter(i => !selectedItemIds.includes(i.id)));
      setSelectedItemIds([]);
    } else if (selectedItemId) {
      commitAction(placedItems.filter(i => i.id !== selectedItemId));
    }
    setSelectedItemId(null);
  };

  // Skróty klawiszowe (2D i 3D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (e.key === 'Escape') {
        setPaste(null);
        setActiveItem(null);
        setSelectedItemId(null);
        setSelectedItemIds([]);
      }
      if (e.key === 'Delete') deleteSelection();
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (mod && k === 'c') {
        const itemsToCopy = placedItems.filter(i => selectedItemIds.includes(i.id));
        setClipboard(itemsToCopy);
        if (itemsToCopy.length > 0) addNotification(`Skopiowano: ${itemsToCopy.length}`, 'success');
      }
      if (mod && k === 'v' && clipboard.length > 0 && !is3DMode) {
        e.preventDefault();
        setActiveItem(null);
        setSelectedItemIds([]);
        setSelectedItemId(null);
        setPaste({ turn: 0 });
      }
      if (mod) return;
      if (k === 'r' && paste) setPaste(p => (p ? { turn: p.turn + 1 } : p));
      if (k === 'r' && activeDef) setTurn(t => t + 1);
      if (k === 'x') selectItem(REMOVER.id);
      if (k === 'b') selectItem(BED.id);
      if (e.key === 'PageUp') {
        e.preventDefault();
        setCurrentFloor(f => Math.min(f + 1, floorsList.length - 1));
      }
      if (e.key === 'PageDown') {
        e.preventDefault();
        setCurrentFloor(f => Math.max(f - 1, 0));
      }
      if (/^[1-9]$/.test(e.key)) {
        const target = materialItems[Number(e.key) - 1];
        if (target) selectItem(target.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Podgląd stawianego elementu (wspólne snapowanie z 3D)
  const placement = activeDef && !isRemoverActive
    ? computePlacement({ def: activeDef, items: placedItems, cursor: mousePos, floor: currentFloor, turn })
    : null;
  const previewItem = placement?.preview ?? null;
  const isValidPlacement = placement?.valid ?? false;
  const pastePreview = useMemo(
    () => (paste && clipboard.length > 0
      ? computePaste({ clip: clipboard, items: placedItems, cursor: mousePos, floor: currentFloor, turn: paste.turn })
      : null),
    [paste, clipboard, placedItems, mousePos, currentFloor],
  );
  const snapPoint = pastePreview?.snapPoint ?? placement?.snapPoint ?? null;

  const commitPaste = (keepPasting: boolean) => {
    if (!pastePreview) return;
    if (!pastePreview.valid) {
      addNotification(pastePreview.items.length === 0 ? 'Te elementy już tu stoją' : 'Kopia nachodzi na istniejące elementy', 'error');
      return;
    }
    const newItems = pastePreview.items.map(i => ({ ...i, id: newItemId() }));
    commitAction([...placedItems, ...newItems]);
    setSelectedItemIds(newItems.map(i => i.id));
    if (!keepPasting) setPaste(null);
  };

  /** Element bieżącego piętra pod punktem planu: wyższa warstwa (dach > filar > ściana > płyta) wygrywa. */
  const hitTest = (p: { x: number; y: number }) => {
    let best: string | null = null;
    let bestLayer = -1;
    for (const item of placedItems) {
      if ((item.floor || 0) !== currentFloor) continue;
      if (Math.abs(item.x - p.x) > 45 || Math.abs(item.y - p.y) > 45) continue;
      const def = findDef(item.itemId);
      if (!def) continue;
      const layer = layerOf(def);
      if (layer >= bestLayer && pointInPolygon(p, hitPolygon(item, def))) {
        best = item.id;
        bestLayer = layer;
      }
    }
    return best;
  };

  const handlePointerDownCanvas = (e: React.PointerEvent) => {
    // Klik w element (zaznaczanie, przeciąganie, wyburzanie, malowanie); stawianie idzie dalej.
    if (e.button === 0 && !paste && (isRemoverActive || activeItem === null)) {
      const hit = hitTest(mousePosRef.current);
      if (hit) {
        handleItemPointerDown(e, hit);
        return;
      }
    }
    if (e.button === 2) {
      setIsPanning(true);
      containerRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    if (paste) {
      commitPaste(e.shiftKey);
      return;
    }

    if (!activeItem) {
      setSelectionBox({ startX: mousePos.x, startY: mousePos.y, endX: mousePos.x, endY: mousePos.y });
    }
    if (selectedItemId) setSelectedItemId(null);

    if (previewItem && isValidPlacement) {
      commitAction([...placedItems, {
        id: newItemId(),
        itemId: previewItem.itemId,
        x: previewItem.x,
        y: previewItem.y,
        rotation: previewItem.rotation,
        customColor: (selectedColor && selectedColor !== 'clear') ? selectedColor : undefined,
        floor: currentFloor,
      }]);
    }
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = (e.clientX - rect.left - pan.x) / scale;
    const my = (e.clientY - rect.top - pan.y) / scale;
    setMousePos({ x: mx, y: my });
    mousePosRef.current = { x: mx, y: my };
    if (!dragState && !selectionBox && !paste && (activeItem === null || isRemoverActive)) {
      const hit = hitTest({ x: mx, y: my });
      if (hit !== hoverId) setHoverId(hit);
    } else if (hoverId) {
      setHoverId(null);
    }

    if (dragState) {
      const moving = new Set(dragState.initialItems.map(i => i.id));
      const { dx, dy } = snapGroupDelta(
        dragState.initialItems,
        placedItems.filter(i => !moving.has(i.id)),
        { x: mx - dragState.startMousePos.x, y: my - dragState.startMousePos.y },
      );
      setDragState(prev => (prev ? { ...prev, dx, dy } : null));
    } else if (selectionBox) {
      setSelectionBox(prev => (prev ? { ...prev, endX: mx, endY: my } : null));
    }
  };

  const handlePointerUpCanvas = (e: React.PointerEvent) => {
    setIsPanning(false);
    containerRef.current?.releasePointerCapture(e.pointerId);

    if (dragState) {
      if (dragState.dx !== 0 || dragState.dy !== 0) {
        setPlacedItems(prev => prev.map(item => {
          const initial = dragState.initialItems.find(i => i.id === item.id);
          return initial ? { ...item, x: initial.x + dragState.dx, y: initial.y + dragState.dy } : item;
        }));
        setPast(prev => {
          const nextPast = [...prev, dragState.preDragState];
          return nextPast.length > 50 ? nextPast.slice(nextPast.length - 50) : nextPast;
        });
        setFuture([]);
      }
      setDragState(null);
    }

    if (selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      if (maxX - minX > 5 || maxY - minY > 5) {
        setSelectedItemIds(placedItems
          .filter(item => (item.floor || 0) === currentFloor && item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY)
          .map(i => i.id));
      } else {
        setSelectedItemIds([]);
      }
      setSelectionBox(null);
    }
  };

  const zoomAt = (mouseX: number, mouseY: number, newScale: number) => {
    const canvasX = (mouseX - pan.x) / scale;
    const canvasY = (mouseY - pan.y) / scale;
    setPan({ x: mouseX - canvasX * newScale, y: mouseY - canvasY * newScale });
    setScale(newScale);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newScale = e.deltaY < 0 ? Math.min(scale * 1.1, 4) : Math.max(scale / 1.1, 0.2);
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, newScale);
  };

  const paintItems = (targets: string[]) => {
    commitAction(placedItems.map(item =>
      targets.includes(item.id) ? { ...item, customColor: selectedColor === 'clear' ? undefined : selectedColor } : item
    ));
  };

  const handleItemPointerDown = (e: React.PointerEvent, itemId: string) => {
    if (e.button !== 0 || paste) return;

    if (isRemoverActive) {
      e.stopPropagation();
      commitAction(placedItems.filter(i => i.id !== itemId));
      return;
    }
    if (activeItem !== null) return;
    e.stopPropagation();

    if (selectedColor !== '') {
      paintItems(selectedItemIds.includes(itemId) ? selectedItemIds : [itemId]);
      return;
    }

    if (selectedItemIds.includes(itemId) && !e.shiftKey) {
      setDragState({
        isDragging: true,
        startMousePos: mousePosRef.current,
        initialItems: placedItems.filter(i => selectedItemIds.includes(i.id)),
        preDragState: placedItems,
        dx: 0,
        dy: 0,
      });
      containerRef.current?.setPointerCapture(e.pointerId);
    } else {
      const newSelection = e.shiftKey
        ? (selectedItemIds.includes(itemId) ? selectedItemIds.filter(i => i !== itemId) : [...selectedItemIds, itemId])
        : [itemId];
      setSelectedItemIds(newSelection);

      if (!e.shiftKey) {
        setDragState({
          isDragging: true,
          startMousePos: mousePosRef.current,
          initialItems: placedItems.filter(i => i.id === itemId),
          preDragState: placedItems,
          dx: 0,
          dy: 0,
        });
        containerRef.current?.setPointerCapture(e.pointerId);
      }
    }
    setSelectedItemId(itemId);
  };


  const floorCount = useMemo(
    () => placedItems.filter(i => (i.floor || 0) === currentFloor).length,
    [placedItems, currentFloor],
  );

  const memoizedPlacedItems = useMemo(() => placedItems.map(item => {
    if (dragState?.isDragging && dragState.initialItems.some(i => i.id === item.id)) return null;
    const def = findDef(item.itemId);
    if (!def) return null;
    return (
      <RenderedItem
        key={item.id}
        item={item}
        def={def}
        currentFloor={currentFloor}
        showBedAreas={showBedAreas}
        isSelected={selectedItemId === item.id || selectedItemIds.includes(item.id)}
      />
    );
  }), [placedItems, selectedItemId, selectedItemIds, currentFloor, showBedAreas, dragState]);
  const hoverItem = hoverId ? placedItems.find(i => i.id === hoverId) : undefined;
  const hoverDef = hoverItem ? findDef(hoverItem.itemId) : undefined;

  if (notFound) {
    return (
      <div className={styles.missing}>
        <h1>Nie ma takiego projektu</h1>
        <p>Projekty są zapisywane w przeglądarce, w której je utworzono. Ten link nie pasuje do żadnego z nich.</p>
        <Link href="/builder" className="btn btn-primary">Moje projekty</Link>
      </div>
    );
  }

  const gridMinor = 30 * scale;
  const gridMajor = 120 * scale;

  const shortName = (item: BuildItem) => (item.part ? item.name.replace(/ \(.*\)$/, '') : item.name);

  const renderCard = (item: BuildItem) => {
    const count = itemCounts[item.id] || 0;
    const idx = materialItems.indexOf(item);
    return (
      <button
        key={item.id}
        className={styles.itemCard}
        data-on={activeItem === item.id || undefined}
        onClick={() => selectItem(item.id)}
        title={item.health ? `${shortName(item)}, ${item.health} HP` : shortName(item)}
      >
        {idx >= 0 && idx < 9 && <kbd className={styles.itemKey}>{idx + 1}</kbd>}
        {count > 0 && <span className={styles.itemCount}>{count}</span>}
        <span className={styles.itemThumb}>
          <img src={item.icon} alt="" />
        </span>
        <span className={styles.itemName}>{shortName(item)}</span>
      </button>
    );
  };

  const renderTool = (item: BuildItem, hotkey: string) => (
    <button
      key={item.id}
      className={styles.toolBtn}
      data-on={activeItem === item.id || undefined}
      data-remover={item.shape === 'remover' || undefined}
      onClick={() => selectItem(item.id)}
    >
      <img src={item.icon} alt="" />
      <span>{item.shape === 'bed' ? 'Łóżko' : item.name}</span>
      <kbd>{hotkey}</kbd>
    </button>
  );

  const activeMaterial = MATERIALS.find(m => m.id === material);
  const groupedItems = searchQuery.trim()
    ? [{ label: 'Wyniki', items: filteredItems }]
    : PART_GROUPS.map(g => ({ label: g.label, items: filteredItems.filter(i => i.part && g.parts.includes(i.part)) }))
        .filter(g => g.items.length > 0);

  return (
    <div className={styles.shell}>
      {/* Górny pasek */}
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Link href="/builder" className="icon-btn" title="Wróć do projektów">
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <button
            className="icon-btn"
            data-on={!isSidebarCollapsed || undefined}
            onClick={() => setIsSidebarCollapsed(c => !c)}
            title={isSidebarCollapsed ? 'Pokaż przybornik' : 'Schowaj przybornik'}
          >
            <SidebarSimple size={18} weight="bold" />
          </button>

          {isEditingName ? (
            <input
              autoFocus
              className={`input ${styles.nameInput}`}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              aria-label="Nazwa projektu"
            />
          ) : (
            <button
              className={styles.projectName}
              onClick={() => { setEditName(project?.name || ''); setIsEditingName(true); }}
              title="Zmień nazwę"
            >
              <span>{project?.name || 'Wczytywanie'}</span>
              <PencilSimple size={14} />
            </button>
          )}
          <span className={styles.saveState}>{savedAt ? 'Zapisano' : 'Zapis automatyczny'}</span>
        </div>

        <div className={styles.topCenter}>
          {is3DMode ? (
            <>
              <div className={styles.segmented} role="group" aria-label="Pora dnia">
                {(['day', 'dusk', 'night'] as TimeOfDay[]).map(t => {
                  const Icon = t === 'day' ? Sun : t === 'dusk' ? SunHorizon : Moon;
                  return (
                    <button key={t} data-on={scene.time === t || undefined} onClick={() => setScene({ time: t })} title={TIME_LABELS[t]}>
                      <Icon size={14} weight="bold" /> <span className={styles.segLabel}>{TIME_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.segmented} role="group" aria-label="Rodzaj bazy">
                {(['ground', 'sky'] as const).map(m => (
                  <button key={m} data-on={scene.mode === m || undefined} onClick={() => setScene({ mode: m })}>
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
              {scene.mode === 'sky' && (
                <div className={styles.segmented} role="group" aria-label="Wysokość skybase">
                  {SKY_HEIGHTS.filter(hgt => hgt <= maxSkyHeight).map(hgt => (
                    <button key={hgt} data-on={scene.skyHeight === hgt || undefined} onClick={() => setScene({ skyHeight: hgt })}>
                      {hgt}
                    </button>
                  ))}
                  <label className={styles.skyInput} title={`Wysokość nad terenem (max ${maxSkyHeight} m przez limit mapy 1024 m)`}>
                    <input
                      type="number"
                      min={5}
                      max={maxSkyHeight}
                      step={5}
                      value={scene.skyHeight}
                      onChange={e => setScene({ skyHeight: Math.min(maxSkyHeight, Math.max(5, Number(e.target.value) || 5)) })}
                    />
                    m
                  </label>
                </div>
              )}
            </>
          ) : (
            <div className={styles.segmented} role="group" aria-label="Piętro">
              {floorsList.map(lvl => (
                <button key={lvl} data-on={currentFloor === lvl || undefined} onClick={() => setCurrentFloor(lvl)}>
                  {lvl === 0 ? 'Parter' : lvl}
                </button>
              ))}
            </div>
          )}
          <div className={styles.segmented} role="group" aria-label="Widok">
            <button data-on={!is3DMode || undefined} onClick={() => setIs3DMode(false)}>2D</button>
            <button data-on={is3DMode || undefined} onClick={() => setIs3DMode(true)}>3D</button>
          </div>
        </div>

        <div className={styles.topRight}>
          <button className="icon-btn" onClick={undo} disabled={past.length === 0} title="Cofnij (Ctrl Z)">
            <ArrowCounterClockwise size={18} weight="bold" />
          </button>
          <button className="icon-btn" onClick={redo} disabled={future.length === 0} title="Ponów (Ctrl Y)">
            <ArrowClockwise size={18} weight="bold" />
          </button>
          <span className={styles.divider} />
          <button
            className="icon-btn"
            data-on={showBedAreas || undefined}
            onClick={() => setShowBedAreas(v => !v)}
            title="Zasięg claimu łóżek"
          >
            <Bed size={18} weight="bold" />
          </button>
          <button
            className="icon-btn"
            onClick={() => project && exportProject({ ...project, items: placedItems })}
            title="Eksportuj do pliku"
          >
            <DownloadSimple size={18} weight="bold" />
          </button>
          <button
            className="icon-btn danger"
            onClick={() => {
              if (placedItems.length > 0 && window.confirm('Wyczyścić cały projekt? Możesz to cofnąć przez Ctrl Z.')) {
                commitAction([]);
              }
            }}
            title="Wyczyść projekt"
          >
            <Trash size={18} weight="bold" />
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* Przybornik */}
        <aside className={styles.sidebar} data-collapsed={isSidebarCollapsed || undefined}>
          <div className={styles.tabs} role="tablist">
            {TABS.filter(t => !(is3DMode && t.id === 'color')).map(({ id: tabId, label, Icon }) => (
              <button
                key={tabId}
                role="tab"
                aria-selected={tab === tabId}
                data-on={tab === tabId || undefined}
                onClick={() => setSidebarTab(tabId)}
              >
                <Icon size={16} weight="bold" />
                {label}
              </button>
            ))}
          </div>

          <div className={styles.panel}>
            {tab === 'blocks' && (
              <>
                <div className={styles.tools}>
                  {renderTool(REMOVER, 'X')}
                  {renderTool(BED, 'B')}
                </div>

                <div className={styles.groupHead}>
                  <h3>Materiał</h3>
                  <span>{activeMaterial?.name}</span>
                </div>
                <div className={styles.materials} role="radiogroup" aria-label="Materiał">
                  {MATERIALS.map(m => (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={material === m.id}
                      aria-label={m.name}
                      title={m.name}
                      data-on={material === m.id || undefined}
                      style={{ '--swatch': m.color } as React.CSSProperties}
                      onClick={() => {
                        setMaterial(m.id);
                        // zachowaj typ elementu przy zmianie materiału, jeśli istnieje
                        const part = activeDef?.part;
                        if (part) setActiveItem(itemsForMaterial(m.id).find(i => i.part === part)?.id ?? null);
                      }}
                    />
                  ))}
                </div>

                <label className={styles.search}>
                  <MagnifyingGlass size={14} weight="bold" />
                  <input
                    type="text"
                    placeholder="Szukaj elementu"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} aria-label="Wyczyść wyszukiwanie">
                      <X size={12} weight="bold" />
                    </button>
                  )}
                </label>

                {groupedItems.map(g => (
                  <section key={g.label} className={styles.group}>
                    <div className={styles.groupHead}>
                      <h3>{g.label}</h3>
                    </div>
                    <div className={styles.itemsGrid}>{g.items.map(renderCard)}</div>
                  </section>
                ))}
                {filteredItems.length === 0 && (
                  <p className={styles.muted}>Nic nie pasuje do &quot;{searchQuery}&quot;.</p>
                )}
                {material === 'brick' && (
                  <p className={styles.panelHint}>Cegła nie ma klapy w grze, do otworów użyj klapy z innego materiału.</p>
                )}
              </>
            )}

            {tab === 'map' && (
              <MapPicker
                site={project?.site}
                onChange={setSite}
                showUnderlay={showUnderlay}
                onToggleUnderlay={() => setShowUnderlay(v => !v)}
              />
            )}

            {tab === 'color' && (
              <>
                <p className={styles.panelHint}>
                  Wybierz kolor, potem kliknij element (albo zaznaczenie), żeby go pomalować. Nowe elementy też dostaną ten kolor.
                </p>
                <div className={styles.swatches}>
                  <button
                    className={styles.swatchText}
                    data-on={selectedColor === '' || undefined}
                    onClick={() => setSelectedColor('')}
                  >
                    Wyłącz
                  </button>
                  <button
                    className={styles.swatchText}
                    data-on={selectedColor === 'clear' || undefined}
                    onClick={() => setSelectedColor('clear')}
                    title="Przywróć kolor materiału"
                  >
                    <X size={12} weight="bold" /> Domyślny
                  </button>
                  {PAINT_COLORS.map(c => (
                    <button
                      key={c}
                      className={styles.swatch}
                      data-on={selectedColor === c || undefined}
                      style={{ backgroundColor: c }}
                      onClick={() => setSelectedColor(c)}
                      aria-label={`Kolor ${c}`}
                    />
                  ))}
                </div>
                <label className={styles.customColor}>
                  Własny kolor
                  <input
                    type="color"
                    value={selectedColor.startsWith('#') ? selectedColor : '#8dc46f'}
                    onChange={e => setSelectedColor(e.target.value)}
                  />
                  <code>{selectedColor.startsWith('#') ? selectedColor : '-'}</code>
                </label>
              </>
            )}

            {tab === 'hotkeys' && (
              <dl className={styles.hotkeys}>
                {HOTKEYS.map(h => (
                  <div key={h.label}>
                    <dt>{h.keys.map(k => <kbd key={k}>{k}</kbd>)}</dt>
                    <dd>{h.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {tab === 'blocks' && activeDef && !isRemoverActive && (
            <div className={styles.activeBar}>
              <span className={styles.activeThumb}>
                <img src={activeDef.icon} alt="" />
              </span>
              <div className={styles.activeInfo}>
                <strong>{shortName(activeDef)}</strong>
                {activeDef.health && <span>{activeDef.health} HP</span>}
              </div>
              <span className={styles.activeHint}><kbd>R</kbd> obrót</span>
            </div>
          )}
        </aside>

        {/* Płótno */}
        <div
          ref={containerRef}
          className={styles.canvasContainer}
          data-mode={is3DMode ? '3d' : isRemoverActive ? 'remove' : activeItem ? 'place' : 'select'}
          data-hover={hoverId ? 'item' : undefined}
          onPointerDown={is3DMode ? undefined : handlePointerDownCanvas}
          onPointerMove={is3DMode ? undefined : handlePointerMoveCanvas}
          onPointerUp={is3DMode ? undefined : handlePointerUpCanvas}
          onWheel={is3DMode ? undefined : handleWheel}
          onContextMenu={e => e.preventDefault()}
        >
          {is3DMode ? (
            <Builder3D
              placedItems={placedItems}
              hotbar={hotbar}
              activeItem={activeItem}
              turn={turn}
              showBedAreas={showBedAreas}
              selectedItemIds={selectedItemIds}
              scene={scene}
              site={project?.site}
              onPlaceItem={(newItem) => commitAction([...placedItemsRef.current, { ...newItem, id: newItemId() }])}
              onDeleteItem={(itemId) => {
                commitAction(placedItemsRef.current.filter(i => i.id !== itemId));
                setSelectedItemIds(prev => prev.filter(i => i !== itemId));
              }}
              onSelectActiveItem={(itemId) => {
                setActiveItem(itemId);
                setTurn(0);
              }}
            />
          ) : (
            <>
              <div
                className={styles.grid}
                style={{
                  inset: -gridMajor,
                  backgroundSize: `${gridMajor}px ${gridMajor}px, ${gridMajor}px ${gridMajor}px, ${gridMinor}px ${gridMinor}px, ${gridMinor}px ${gridMinor}px`,
                  transform: `translate3d(${((pan.x % gridMajor) + gridMajor) % gridMajor}px, ${((pan.y % gridMajor) + gridMajor) % gridMajor}px, 0)`,
                }}
              />
              <div
                className={styles.canvas}
                style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
              >
                {project?.site && showUnderlay && <SiteUnderlay site={project.site} />}
                {memoizedPlacedItems}
                {hoverItem && hoverDef && !dragState && (isRemoverActive || selectedColor !== '') && (
                  <RenderedItem
                    item={hoverItem}
                    def={hoverDef}
                    currentFloor={currentFloor}
                    showBedAreas={false}
                    isSelected={false}
                    hoverMark
                  />
                )}

                {dragState?.isDragging && (
                  <div style={{ transform: `translate3d(${dragState.dx}px, ${dragState.dy}px, 0)` }}>
                    {dragState.initialItems.map(item => {
                      const def = findDef(item.itemId);
                      if (!def) return null;
                      return (
                        <RenderedItem
                          key={`drag-${item.id}`}
                          item={item}
                          def={def}
                          currentFloor={currentFloor}
                          showBedAreas={showBedAreas}
                          isSelected
                        />
                      );
                    })}
                  </div>
                )}

                {activeDef && previewItem && (
                  <>
                    {activeDef.shape === 'bed' && showBedAreas && (
                      <div
                        className={styles.claim}
                        data-invalid={!isValidPlacement || undefined}
                        style={{ left: previewItem.x, top: previewItem.y, width: BED_CLAIM_RADIUS * 2, height: BED_CLAIM_RADIUS * 2 }}
                      />
                    )}
                    <div
                      className={`${styles.placedItem} ${styles.preview} ${shapeClassFor(activeDef)}`}
                      data-part={activeDef.part}
                      data-material={activeDef.material}
                      data-invalid={!isValidPlacement || undefined}
                      style={{
                        left: previewItem.x,
                        top: previewItem.y,
                        transform: itemTransform(activeDef, previewItem.rotation),
                        transformOrigin: activeDef.shape === 'triangle' ? '50% 66.666%' : '50% 50%',
                        '--c': isValidPlacement
                          ? ((selectedColor && selectedColor !== 'clear') ? selectedColor : activeDef.color)
                          : 'var(--danger)',
                      } as React.CSSProperties}
                    >
                      {renderInterior(activeDef)}
                    </div>
                  </>
                )}

                {pastePreview?.items.map(item => {
                  const def = findDef(item.itemId);
                  if (!def) return null;
                  const bad = pastePreview.invalid.has(item.id);
                  return (
                    <div
                      key={`paste-${item.id}`}
                      className={`${styles.placedItem} ${styles.preview} ${shapeClassFor(def)}`}
                      data-part={def.part}
                      data-material={def.material}
                      data-invalid={bad || undefined}
                      style={{
                        left: item.x,
                        top: item.y,
                        transform: itemTransform(def, item.rotation),
                        transformOrigin: def.shape === 'triangle' ? '50% 66.666%' : '50% 50%',
                        '--c': bad ? 'var(--danger)' : item.customColor || def.color,
                        opacity: (item.floor || 0) === currentFloor ? undefined : 0.3,
                        zIndex: 400 + layerOf(def),
                      } as React.CSSProperties}
                    >
                      {renderInterior(def)}
                    </div>
                  );
                })}

                {selectionBox && (
                  <div
                    className={styles.selectionBox}
                    style={{
                      left: Math.min(selectionBox.startX, selectionBox.endX),
                      top: Math.min(selectionBox.startY, selectionBox.endY),
                      width: Math.abs(selectionBox.endX - selectionBox.startX),
                      height: Math.abs(selectionBox.endY - selectionBox.startY),
                    }}
                  />
                )}

                {snapPoint && (
                  <div className={styles.snapPoint} style={{ left: snapPoint.x, top: snapPoint.y }} />
                )}
              </div>

              {placedItems.length === 0 && !activeItem && (
                <div className={styles.emptyHint}>
                  <p>Pusty plan. Wciśnij <kbd>1</kbd> (podłoga) i kliknij w siatkę.</p>
                </div>
              )}

              <div className={styles.statusbar}>
                <span>{floorLabel(currentFloor)}: {floorCount}</span>
                <span>x {Math.round(mousePos.x)}, y {Math.round(mousePos.y)}</span>
                <span className={styles.zoom}>
                  <button onClick={() => {
                    const r = containerRef.current?.getBoundingClientRect();
                    if (r) zoomAt(r.width / 2, r.height / 2, Math.max(scale / 1.2, 0.2));
                  }} aria-label="Oddal">-</button>
                  {Math.round(scale * 100)}%
                  <button onClick={() => {
                    const r = containerRef.current?.getBoundingClientRect();
                    if (r) zoomAt(r.width / 2, r.height / 2, Math.min(scale * 1.2, 4));
                  }} aria-label="Przybliż">+</button>
                </span>
                {pastePreview && (
                  <span className={styles.statusActive}>
                    Wklejanie {pastePreview.items.length} el.: R obraca, klik wstawia (Shift: kolejna kopia), Esc anuluje
                  </span>
                )}
                {activeDef && (
                  <span className={styles.statusActive}>
                    {isRemoverActive
                      ? 'Wyburzanie: kliknij element'
                      : activeDef.shape === 'hatch' && !isValidPlacement
                        ? 'Klapę stawia się w dachu z otworem'
                        : (activeDef.part === 'floor' || activeDef.part === 'tri_floor') && currentFloor > 0
                          ? 'Podłogi tylko na parterze, wyżej stawiaj dachy'
                        : `${activeDef.name}, R obraca`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
