"use client";

import React, { useState, useMemo, useRef, useEffect, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  Bed,
  Buildings,
  Cube,
  DownloadSimple,
  GridFour,
  Hammer,
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
import { loadMap, type MapData, type Site } from '@/lib/terrain';
import { DEFAULT_SCENE, SKY_HEIGHTS, type SceneSettings, type TimeOfDay } from '@/lib/scene';
import { itemFullLabel, itemLabel, type PartGroupId, type SidebarTabId } from '@/lib/i18n';
import { useI18n, useT } from '@/components/I18nProvider';
import LangSwitch from '@/components/LangSwitch';
import MapPicker from '@/components/MapPicker';
import SiteUnderlay from '@/components/SiteUnderlay';
import PlanCanvas, { layerOf } from '@/components/PlanCanvas';
import KeybindsPanel from '@/components/KeybindsPanel';
import BasesPanel, { baseWorld, type BaseInfo } from '@/components/BasesPanel';
import { Chat, Hotbar, Inventory, MapScreen, PauseMenu, type ChatMessage } from '@/components/Hud3D';
import hud from '@/components/Hud3D.module.css';
import { SLOT_ACTIONS, keyLabel, useKeybinds } from '@/lib/keybinds';
import { cameraPosition, lockPointer, sendSceneCommand, unlockPointer, useView3D, type Overlay } from '@/lib/view3d';
import { COMMAND_IDS, COMMAND_USAGE, isCommandId, parseCommand } from '@/lib/commands';
import {
  BED,
  BED_CLAIM_RADIUS,
  BUILD_ITEMS,
  baseGroups,
  FLOORS,
  LEVEL_HEIGHT,
  MATERIALS,
  REMOVER,
  computePaste,
  computePlacement,
  findDef,
  itemsForMaterial,
  getPolygonVertices,
  newItemId,
  normalizeHotbar,
  planFloor,
  roundLevel,
  pointInPolygon,
  snapGroupDelta,
  type BuildItem,
  type Hotbar as HotbarSlots,
  type MaterialId,
  type PartId,
  type PlacedItem,
  isRoofLayer,
  roofSupported,
  wallMissingPillars,
} from '@/lib/builder';

const Builder3D = dynamic(() => import('@/components/Builder3D'), {
  ssr: false,
  loading: function Loading3D() {
    return <div className={styles.loading3d}>{useT().editor.loading3d}</div>;
  },
});

const PAINT_COLORS = ['#d9534f', '#e8692f', '#e2b93b', '#8dc46f', '#3e8ed0', '#8e6bbf', '#c9ccd1', '#3a3d42'];

type SidebarTab = SidebarTabId;

const TABS: { id: SidebarTab; Icon: typeof Cube }[] = [
  { id: 'blocks', Icon: Cube },
  { id: 'bases', Icon: Buildings },
  { id: 'map', Icon: MapTrifold },
  { id: 'color', Icon: PaintBucket },
  { id: 'hotkeys', Icon: Keyboard },
];

/** Grupy w przyborniku. Klawisze 1-9 dalej idą po kolejności PARTS. */
const PART_GROUPS: { id: PartGroupId; parts: PartId[] }[] = [
  { id: 'slabs', parts: ['floor', 'tri_floor', 'roof', 'tri_roof', 'hole', 'tri_hole', 'hatch'] },
  { id: 'walls', parts: ['wall', 'doorway', 'window', 'garage', 'rampart', 'ramp_wall'] },
  { id: 'pillars', parts: ['pillar', 'post'] },
  { id: 'stairs', parts: ['stairs', 'ramp'] },
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


/** Obrys elementu do trafiania kursorem (jak w rzucie: ściana 60x5, filar 10x10...), z małym zapasem. */
const hitPolygon = (item: PlacedItem, def: BuildItem) => {
  if (def.shape === 'square' || def.shape === 'triangle') return getPolygonVertices(def.shape, item.x, item.y, item.rotation);
  const half: Record<string, [number, number]> = { wall: [30, 4], pillar: [6, 6], hatch: [11, 11], bed: [10, 20] };
  const [hw, hh] = half[def.shape] ?? [5, 5];
  const r = (item.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: item.x + x * c - y * s, y: item.y + x * s + y * c }));
};


const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

/** Id elementów do podpowiedzi komendy /give. */
const ITEM_IDS = BUILD_ITEMS.map(i => i.id);

export default function BuilderCanvas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addNotification } = useAppStore();
  const { t } = useI18n();
  const binds = useKeybinds(s => s.binds);
  const hydrateKeybinds = useKeybinds(s => s.hydrate);
  useEffect(() => hydrateKeybinds(), [hydrateKeybinds]);
  const keyName = (code: string) => keyLabel(code, { space: t.keys.space, shift: t.keys.shift });

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
  const router = useRouter();

  // Pasek 9 slotów (per projekt) i wybrany slot
  const hotbar = useMemo(() => normalizeHotbar(project?.hotbar), [project?.hotbar]);
  const [slot, setSlot] = useState<number | null>(null);
  const setHotbar = (next: HotbarSlots) => {
    if (!project) return;
    updateProject(id, { hotbar: next });
    setProject({ ...project, hotbar: next });
  };

  // Nakładki widoku 3D: ekwipunek, czat, menu pauzy
  const overlay = useView3D(s => s.overlay);
  const setOverlay = useView3D(s => s.setOverlay);
  const openOverlay = (o: Overlay) => {
    setOverlay(o);
    unlockPointer();
  };
  const closeOverlay = () => {
    setOverlay('none');
    lockPointer();
  };
  const [chatOpen, setChatOpen] = useState({ seed: 0, initial: '' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const messageId = useRef(0);

  const materialItems = useMemo(() => itemsForMaterial(material), [material]);

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
    return materialItems.filter(i => itemLabel(i, t).toLowerCase().includes(q));
  }, [searchQuery, materialItems, t]);

  // Wczytanie projektu z localStorage
  useEffect(() => {
    const p = getProject(id);
    if (!p) {
      // localStorage jest dostępny dopiero po montażu
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotFound(true);
      return;
    }
    // Dawny tryb skybase opuszczał świat pod bazą; w sandboxie elementy po prostu wiszą na swojej wysokości
    if (p.scene?.mode === 'sky') {
      const lift = p.scene.skyHeight / LEVEL_HEIGHT;
      const items = p.items.map(i => ({ ...i, floor: roundLevel((i.floor || 0) + lift) }));
      const scene = { ...p.scene, mode: 'ground' as const };
      updateProject(id, { items, scene });
      Object.assign(p, { items, scene });
    }
    setProject(p);
    setPlacedItems(p.items);
    // plan otwiera się na najniższym poziomie z elementami (skybase stoi np. na poziomie 9, nie na 0)
    if (p.items.length) setCurrentFloor(Math.min(...p.items.map(planFloor)));
    lastSavedRef.current = JSON.stringify(p.items);
    if (window.innerWidth < 900) setIsSidebarCollapsed(true);
  }, [id]);

  // Dane mapy projektu (spawny dla /spawn i mapy pod M)
  const siteMap = project?.site?.map;
  const [mapData, setMapData] = useState<MapData | null>(null);
  useEffect(() => {
    if (!siteMap) return;
    let alive = true;
    loadMap(siteMap).then(d => alive && setMapData(d)).catch(() => alive && setMapData(null));
    return () => {
      alive = false;
    };
  }, [siteMap]);
  const activeMapData = mapData && mapData.meta.id === siteMap ? mapData : null;

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

  // Piętra w 2D liczone od najniższego poziomu z elementami (to on jest "Parterem"): elementy z 3D stoją
  // na wysokości terenu albo wysoko (skybase), więc piętro = najbliższy pełny poziom, np. 9 dla skybase'a na 40 m.
  const floorBase = useMemo(() => (placedItems.length ? Math.min(...placedItems.map(planFloor)) : 0), [placedItems]);
  // Lista: parter i 3 piętra, piętra z elementami oraz jedno nad najwyższym (bez setek pustych przycisków).
  const floorsList = useMemo(() => {
    const levels = placedItems.map(planFloor);
    const set = new Set([...FLOORS.map(f => f + floorBase), ...levels, Math.max(floorBase + FLOORS.length - 1, ...levels) + 1]);
    return [...set].sort((a, b) => a - b);
  }, [placedItems, floorBase]);

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
    setMoving(null);
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

  /** Slot podświetlony na pasku: wybrany (także pusty) albo ten, w którym leży trzymany element. */
  const heldSlot = slot !== null && (hotbar[slot] ?? null) === activeItem
    ? slot
    : activeItem && hotbar.includes(activeItem) ? hotbar.indexOf(activeItem) : null;

  const selectSlot = (i: number) => {
    setSlot(i);
    setPaste(null);
    setMoving(null);
    setActiveItem(hotbar[i] ?? null);
    setTurn(0);
  };

  const setView3D = (on: boolean) => {
    setIs3DMode(on);
    setOverlay('none');
    if (!on) unlockPointer();
  };

  // --- Czat i komendy (3D) ---
  const say = (lines: Omit<ChatMessage, 'id'>[]) => {
    const added = lines.map(l => ({ ...l, id: ++messageId.current }));
    setMessages(m => [...m, ...added].slice(-80));
    const ids = new Set(added.map(m => m.id));
    // po chwili znikają z ekranu, w otwartym czacie zostają
    setTimeout(() => setMessages(m => m.map(x => (ids.has(x.id) ? { ...x, faded: true } : x))), 9000);
  };

  const runCommand = (text: string) => {
    setHistory(h => [...h.filter(x => x !== text), text].slice(-50));
    const out: Omit<ChatMessage, 'id'>[] = [{ text, kind: 'cmd' }];
    const info = (s: string) => out.push({ text: s, kind: 'info' });
    const fail = (s: string) => out.push({ text: s, kind: 'error' });
    const cmd = parseCommand(text);
    if (!cmd) fail(t.commands.notCommand);
    else if (!isCommandId(cmd.name)) fail(t.commands.unknown(cmd.name));
    else {
      const { name, args } = cmd;
      const usage = () => fail(t.commands.usage(COMMAND_USAGE[name]));
      switch (name) {
        case 'help':
          info([t.commands.list, ...COMMAND_IDS.map(c => `${COMMAND_USAGE[c]}  ${t.commands.desc[c]}`)].join('\n'));
          break;
        case 'time': {
          const v = args[0] as TimeOfDay;
          if (v !== 'day' && v !== 'dusk' && v !== 'night') usage();
          else {
            setScene({ time: v });
            info(t.commands.time(t.time[v]));
          }
          break;
        }
        case 'sky': {
          // kamera nad terenem: tam stawia się dachy skybase'a (płaszczyzna pod kamerą)
          const h = Math.round(Number(args[0] ?? 150));
          if (!Number.isFinite(h) || h < 5) usage();
          else {
            const height = Math.min(h, maxSkyHeight);
            sendSceneCommand({ kind: 'fly', on: true });
            if (sendSceneCommand({ kind: 'height', above: height })) info(t.commands.sky(height));
            else fail(t.commands.noScene);
            if (height < h) info(t.commands.skyClamped(maxSkyHeight));
          }
          break;
        }
        case 'skybase': {
          // dach startowy z materiału, który masz wybrany (domyślnie klon)
          const roof = findDef(`${material}_roof`) ?? findDef('maple_roof')!;
          sendSceneCommand({ kind: 'fly', on: true });
          if (sendSceneCommand({ kind: 'skybase', itemId: roof.id })) info(t.commands.skybase(itemFullLabel(roof, t)));
          else fail(t.commands.noScene);
          break;
        }
        case 'ground':
          if (sendSceneCommand({ kind: 'height', above: 0 })) info(t.commands.ground);
          else fail(t.commands.noScene);
          break;
        case 'spawn': {
          const spawns = activeMapData?.meta.noBuild?.spawns ?? [];
          if (!spawns.length) {
            fail(t.commands.noSpawns);
            break;
          }
          const n = args[0] ? Math.round(Number(args[0])) : Math.floor(Math.random() * spawns.length) + 1;
          const sp = spawns[n - 1];
          if (!sp) usage();
          else if (sendSceneCommand({ kind: 'tp', x: sp[0], z: sp[2] })) info(t.commands.spawn(n, spawns.length));
          else fail(t.commands.noScene);
          break;
        }
        case 'fly':
        case 'walk':
          if (sendSceneCommand({ kind: 'fly', on: name === 'fly' })) info(name === 'fly' ? t.commands.fly : t.commands.walk);
          else fail(t.commands.noScene);
          break;
        case 'tp': {
          const [x, z] = args.map(Number);
          if (args.length < 2 || !Number.isFinite(x) || !Number.isFinite(z)) usage();
          else if (sendSceneCommand({ kind: 'tp', x, z })) info(t.commands.tp(Math.round(x), Math.round(z)));
          else fail(t.commands.noScene);
          break;
        }
        case 'pos': {
          const p = cameraPosition();
          if (p) info(t.commands.pos(Math.round(p[0]), Math.round(p[1]), Math.round(p[2])));
          else fail(t.commands.noScene);
          break;
        }
        case 'beds': {
          const on = args[0] === 'on' ? true : args[0] === 'off' ? false : !showBedAreas;
          setShowBedAreas(on);
          info(t.commands.beds(on));
          break;
        }
        case 'give': {
          const last = args[args.length - 1];
          const slotArg = args.length > 1 && /^[1-9]$/.test(last) ? Number(last) - 1 : null;
          const query = (slotArg === null ? args : args.slice(0, -1)).join('_').toLowerCase();
          if (!query) {
            usage();
            break;
          }
          const def = findDef(query)
            ?? BUILD_ITEMS.find(i => i.id.includes(query))
            ?? BUILD_ITEMS.find(i => itemLabel(i, t).toLowerCase().includes(query.replace(/_/g, ' ')));
          if (!def) {
            fail(t.commands.noItem(query));
            break;
          }
          const target = slotArg ?? heldSlot ?? (hotbar.indexOf(null) >= 0 ? hotbar.indexOf(null) : 0);
          setHotbar(hotbar.map((v, i) => (i === target ? def.id : v)));
          setSlot(target);
          setActiveItem(def.id);
          info(t.commands.give(itemFullLabel(def, t), target + 1));
          break;
        }
        case '2d':
          setView3D(false);
          break;
        case 'undo':
          if (past.length) {
            undo();
            info(t.commands.undo);
          } else fail(t.commands.nothingUndo);
          break;
        case 'redo':
          if (future.length) {
            redo();
            info(t.commands.redo);
          } else fail(t.commands.nothingRedo);
          break;
        case 'clear':
          if (placedItems.length > 0 && window.confirm(t.editor.confirmClear)) {
            commitAction([]);
            info(t.commands.cleared);
          }
          break;
      }
    }
    say(out);
  };

  const deleteSelection = () => {
    if (selectedItemIds.length > 0) {
      commitAction(placedItems.filter(i => !selectedItemIds.includes(i.id)));
      setSelectedItemIds([]);
    } else if (selectedItemId) {
      commitAction(placedItems.filter(i => i.id !== selectedItemId));
    }
    setSelectedItemId(null);
  };

  // --- Bazy (grupy połączonych elementów) ---
  /** Przenoszona baza (G albo menu Budowle): wisi w celowniku do kliknięcia. */
  const [moving, setMoving] = useState<PlacedItem[] | null>(null);
  const startMove = (items: PlacedItem[]) => {
    setActiveItem(null);
    setMoving(items);
    setPaste({ turn: 0 });
  };
  const deleteBase = (b: BaseInfo) => {
    if (!window.confirm(t.bases.confirmDelete(b.items.length))) return;
    const ids = new Set(b.items.map(i => i.id));
    commitAction(placedItems.filter(i => !ids.has(i.id)));
    setSelectedItemIds(prev => prev.filter(i => !ids.has(i)));
  };
  /** 2D: plan przybliżony do bazy, jej najniższe piętro, cała baza zaznaczona. */
  const showBase = (b: BaseInfo) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setPan({ x: rect.width / 2 - b.cx * scale, y: rect.height / 2 - b.cy * scale });
    setCurrentFloor(Math.min(...b.items.map(planFloor)));
    setSelectedItemIds(b.items.map(i => i.id));
  };

  // Skróty klawiszowe (2D i 3D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      // 3D jak w grze: E ekwipunek, T albo / czat, Esc menu; przy otwartej nakładce reszta skrótów śpi
      if (is3DMode) {
        const view = useView3D.getState();
        if (!mod && e.code === binds.inventory && (view.overlay === 'none' || view.overlay === 'inventory')) {
          e.preventDefault();
          if (view.overlay === 'inventory') closeOverlay();
          else openOverlay('inventory');
          return;
        }
        if (!mod && e.code === binds.map && activeMapData && (view.overlay === 'none' || view.overlay === 'map')) {
          e.preventDefault();
          if (view.overlay === 'map') closeOverlay();
          else openOverlay('map');
          return;
        }
        if (e.key === 'Escape' && paste && view.overlay === 'none') {
          setPaste(null);
          setMoving(null);
          return;
        }
        if (e.key === 'Escape') {
          // Esc z przechwyconym kursorem otwiera menu przez pointerlockchange; drugi raz go nie zamykamy
          if (performance.now() - view.changedAt < 300) return;
          if (view.overlay !== 'none') setOverlay('none');
          else openOverlay('menu');
          return;
        }
        if (view.overlay !== 'none') return;
        if (!mod && e.code === binds.grab) {
          // G: baza w celowniku wisi przy celowniku; drugi raz G albo Esc odkłada ją na stare miejsce
          if (moving) {
            setMoving(null);
            setPaste(null);
          } else if (view.lookId) {
            const group = baseGroups(placedItems).find(g => g.some(i => i.id === view.lookId));
            if (group) startMove(group);
          }
          return;
        }
        if (!mod && (e.code === binds.chat || e.key === '/')) {
          e.preventDefault();
          setChatOpen(c => ({ seed: c.seed + 1, initial: e.key === '/' ? '/' : '' }));
          openOverlay('chat');
          return;
        }
      }

      if (e.key === 'Escape') {
        setPaste(null);
        setActiveItem(null);
        setSelectedItemId(null);
        setSelectedItemIds([]);
      }
      if (e.code === binds.deleteSelected) deleteSelection();
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (mod && k === 'c') {
        // w 3D bez zaznaczenia kopiujemy całą bazę (do wklejenia w innym miejscu mapy)
        const itemsToCopy = is3DMode && selectedItemIds.length === 0
          ? placedItems
          : placedItems.filter(i => selectedItemIds.includes(i.id));
        setClipboard(itemsToCopy);
        if (itemsToCopy.length > 0) addNotification(t.editor.copied(itemsToCopy.length), 'success');
      }
      if (mod && k === 'v' && clipboard.length > 0) {
        e.preventDefault();
        setActiveItem(null);
        setSelectedItemIds([]);
        setSelectedItemId(null);
        setPaste({ turn: 0 });
      }
      if (mod) return;
      const code = e.code;
      if (code === binds.rotate && paste) setPaste(p => (p ? { turn: p.turn + 1 } : p));
      if (code === binds.rotate && activeDef) setTurn(t => t + 1);
      if (code === binds.demolish) selectItem(REMOVER.id);
      if (code === binds.bed) selectItem(BED.id);
      if (code === binds.floorUp) {
        e.preventDefault();
        setCurrentFloor(f => floorsList.find(l => l > f) ?? f);
      }
      if (code === binds.floorDown) {
        e.preventDefault();
        setCurrentFloor(f => [...floorsList].reverse().find(l => l < f) ?? f);
      }
      const slotKey = SLOT_ACTIONS.findIndex(a => binds[a] === code);
      if (slotKey >= 0) selectSlot(slotKey);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Kółko w 3D: następny / poprzedni slot paska (jak w grze)
  useEffect(() => {
    if (!is3DMode) return;
    const onWheel = (e: WheelEvent) => {
      if (useView3D.getState().overlay !== 'none' || !containerRef.current?.contains(e.target as Node)) return;
      const from = heldSlot ?? (e.deltaY > 0 ? -1 : 0);
      selectSlot((from + (e.deltaY > 0 ? 1 : -1) + hotbar.length) % hotbar.length);
    };
    window.addEventListener('wheel', onWheel);
    return () => window.removeEventListener('wheel', onWheel);
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
      addNotification(pastePreview.items.length === 0 ? t.editor.pasteSame : t.editor.pasteOverlap, 'error');
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
      if (planFloor(item) !== currentFloor) continue;
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
          .filter(item => planFloor(item) === currentFloor && item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY)
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
    () => placedItems.filter(i => planFloor(i) === currentFloor).length,
    [placedItems, currentFloor],
  );

  const selectedSet = useMemo(
    () => new Set(selectedItemId ? [...selectedItemIds, selectedItemId] : selectedItemIds),
    [selectedItemId, selectedItemIds],
  );
  // Przeciągane elementy rysuje osobna warstwa płótna z przesunięciem.
  // Zależność od samej tablicy (nie od dx/dy), żeby plan nie przebudowywał się przy każdym ruchu.
  const draggedItems = dragState?.isDragging ? dragState.initialItems : null;
  const canvasItems = useMemo(() => {
    if (!draggedItems) return placedItems;
    const ids = new Set(draggedItems.map(i => i.id));
    return placedItems.filter(i => !ids.has(i.id));
  }, [placedItems, draggedItems]);
  const canvasHover = useMemo(
    () => (hoverId && !dragState && (isRemoverActive || selectedColor !== '')
      ? { id: hoverId, mode: isRemoverActive ? 'remove' as const : 'paint' as const }
      : null),
    [hoverId, dragState, isRemoverActive, selectedColor],
  );
  const canvasDrag = useMemo(
    () => (dragState?.isDragging ? { items: dragState.initialItems, dx: dragState.dx, dy: dragState.dy } : null),
    [dragState],
  );

  if (notFound) {
    return (
      <div className={styles.missing}>
        <h1>{t.editor.notFoundTitle}</h1>
        <p>{t.editor.notFoundText}</p>
        <Link href="/builder" className="btn btn-primary">{t.common.myProjects}</Link>
      </div>
    );
  }

  const gridMinor = 30 * scale;
  const gridMajor = 120 * scale;

  const shortName = (item: BuildItem) => itemLabel(item, t);

  const renderCard = (item: BuildItem) => {
    const count = itemCounts[item.id] || 0;
    const idx = hotbar.indexOf(item.id);
    return (
      <button
        key={item.id}
        className={styles.itemCard}
        data-on={activeItem === item.id || undefined}
        onClick={() => selectItem(item.id)}
        title={item.health ? `${shortName(item)}, ${item.health} HP` : shortName(item)}
      >
        {idx >= 0 && idx < 9 && <kbd className={styles.itemKey}>{keyName(binds[SLOT_ACTIONS[idx]])}</kbd>}
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
      {item.shape === 'remover' ? <Hammer size={16} weight="bold" /> : <Bed size={16} weight="bold" />}
      <span>{shortName(item)}</span>
      <kbd>{hotkey}</kbd>
    </button>
  );

  const activeMaterial = MATERIALS.find(m => m.id === material);
  const groupedItems = searchQuery.trim()
    ? [{ label: t.editor.results, items: filteredItems }]
    : PART_GROUPS.map(g => ({ label: t.editor.groups[g.id], items: filteredItems.filter(i => i.part && g.parts.includes(i.part)) }))
        .filter(g => g.items.length > 0);

  return (
    <div className={styles.shell}>
      {/* Górny pasek: tylko w 2D, w 3D ustawienia są w menu (Esc) i komendach */}
      {!is3DMode && (
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Link href="/builder" className="icon-btn" title={t.editor.back}>
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <button
            className="icon-btn"
            data-on={!isSidebarCollapsed || undefined}
            onClick={() => setIsSidebarCollapsed(c => !c)}
            title={isSidebarCollapsed ? t.editor.showToolbox : t.editor.hideToolbox}
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
              aria-label={t.editor.projectName}
            />
          ) : (
            <button
              className={styles.projectName}
              onClick={() => { setEditName(project?.name || ''); setIsEditingName(true); }}
              title={t.editor.rename}
            >
              <span>{project?.name || t.editor.loading}</span>
              <PencilSimple size={14} />
            </button>
          )}
          <span className={styles.saveState}>{savedAt ? t.editor.saved : t.editor.autosave}</span>
        </div>

        <div className={styles.topCenter}>
          {is3DMode ? (
            <>
              <div className={styles.segmented} role="group" aria-label={t.editor.timeOfDay}>
                {(['day', 'dusk', 'night'] as TimeOfDay[]).map(time => {
                  const Icon = time === 'day' ? Sun : time === 'dusk' ? SunHorizon : Moon;
                  return (
                    <button key={time} data-on={scene.time === time || undefined} onClick={() => setScene({ time })} title={t.time[time]}>
                      <Icon size={14} weight="bold" /> <span className={styles.segLabel}>{t.time[time]}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.segmented} role="group" aria-label={t.editor.baseType}>
                {(['ground', 'sky'] as const).map(m => (
                  <button key={m} data-on={scene.mode === m || undefined} onClick={() => setScene({ mode: m })}>
                    {t.mode[m]}
                  </button>
                ))}
              </div>
              {scene.mode === 'sky' && (
                <div className={styles.segmented} role="group" aria-label={t.editor.skyHeight}>
                  {SKY_HEIGHTS.filter(hgt => hgt <= maxSkyHeight).map(hgt => (
                    <button key={hgt} data-on={scene.skyHeight === hgt || undefined} onClick={() => setScene({ skyHeight: hgt })}>
                      {hgt}
                    </button>
                  ))}
                  <label className={styles.skyInput} title={t.editor.skyHeightTitle(maxSkyHeight)}>
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
            <div className={styles.segmented} role="group" aria-label={t.editor.floor}>
              {floorsList.map(lvl => (
                <button key={lvl} data-on={currentFloor === lvl || undefined} onClick={() => setCurrentFloor(lvl)}>
                  {lvl === floorBase ? t.editor.groundFloor : lvl - floorBase}
                </button>
              ))}
            </div>
          )}
          <div className={styles.segmented} role="group" aria-label={t.editor.view}>
            <button data-on={!is3DMode || undefined} onClick={() => setView3D(false)}>2D</button>
            <button data-on={is3DMode || undefined} onClick={() => setView3D(true)}>3D</button>
          </div>
        </div>

        <div className={styles.topRight}>
          <button className="icon-btn" onClick={undo} disabled={past.length === 0} title={t.editor.undo}>
            <ArrowCounterClockwise size={18} weight="bold" />
          </button>
          <button className="icon-btn" onClick={redo} disabled={future.length === 0} title={t.editor.redo}>
            <ArrowClockwise size={18} weight="bold" />
          </button>
          <span className={styles.divider} />
          <button
            className="icon-btn"
            data-on={showBedAreas || undefined}
            onClick={() => setShowBedAreas(v => !v)}
            title={t.editor.bedAreas}
          >
            <Bed size={18} weight="bold" />
          </button>
          <button
            className="icon-btn"
            onClick={() => project && exportProject({ ...project, items: placedItems })}
            title={t.editor.export}
          >
            <DownloadSimple size={18} weight="bold" />
          </button>
          <button
            className="icon-btn danger"
            onClick={() => {
              if (placedItems.length > 0 && window.confirm(t.editor.confirmClear)) {
                commitAction([]);
              }
            }}
            title={t.editor.clear}
          >
            <Trash size={18} weight="bold" />
          </button>
          <span className={styles.divider} />
          <LangSwitch />
        </div>
      </header>
      )}

      <div className={styles.body}>
        {/* Przybornik: tylko w 2D, w 3D jest pasek slotów i ekwipunek (E) */}
        {!is3DMode && (
        <aside className={styles.sidebar} data-collapsed={isSidebarCollapsed || undefined}>
          <div className={styles.tabs} role="tablist">
            {TABS.filter(tb => !(is3DMode && tb.id === 'color')).map(({ id: tabId, Icon }) => (
              <button
                key={tabId}
                role="tab"
                aria-selected={tab === tabId}
                data-on={tab === tabId || undefined}
                onClick={() => setSidebarTab(tabId)}
              >
                <Icon size={16} weight="bold" />
                {t.editor.tabs[tabId]}
              </button>
            ))}
          </div>

          <div className={styles.panel}>
            {tab === 'blocks' && (
              <>
                <div className={styles.tools}>
                  {renderTool(REMOVER, keyName(binds.demolish))}
                  {renderTool(BED, keyName(binds.bed))}
                </div>

                <div className={styles.groupHead}>
                  <h3>{t.editor.material}</h3>
                  <span>{activeMaterial && t.materials[activeMaterial.id]}</span>
                </div>
                <div className={styles.materials} role="radiogroup" aria-label={t.editor.material}>
                  {MATERIALS.map(m => (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={material === m.id}
                      aria-label={t.materials[m.id]}
                      title={t.materials[m.id]}
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
                    placeholder={t.editor.search}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} aria-label={t.editor.clearSearch}>
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
                  <p className={styles.muted}>{t.editor.noMatch(searchQuery)}</p>
                )}
                {material === 'brick' && (
                  <p className={styles.panelHint}>{t.editor.brickNoHatch}</p>
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
                  {t.editor.colorHint}
                </p>
                <div className={styles.swatches}>
                  <button
                    className={styles.swatchText}
                    data-on={selectedColor === '' || undefined}
                    onClick={() => setSelectedColor('')}
                  >
                    {t.editor.colorOff}
                  </button>
                  <button
                    className={styles.swatchText}
                    data-on={selectedColor === 'clear' || undefined}
                    onClick={() => setSelectedColor('clear')}
                    title={t.editor.colorDefaultTitle}
                  >
                    <X size={12} weight="bold" /> {t.editor.colorDefault}
                  </button>
                  {PAINT_COLORS.map(c => (
                    <button
                      key={c}
                      className={styles.swatch}
                      data-on={selectedColor === c || undefined}
                      style={{ backgroundColor: c }}
                      onClick={() => setSelectedColor(c)}
                      aria-label={t.editor.colorAria(c)}
                    />
                  ))}
                </div>
                <label className={styles.customColor}>
                  {t.editor.colorCustom}
                  <input
                    type="color"
                    value={selectedColor.startsWith('#') ? selectedColor : '#8dc46f'}
                    onChange={e => setSelectedColor(e.target.value)}
                  />
                  <code>{selectedColor.startsWith('#') ? selectedColor : '-'}</code>
                </label>
              </>
            )}

            {tab === 'bases' && (
              <BasesPanel
                items={placedItems}
                site={project?.site}
                map={activeMapData}
                hint={t.bases.hint2d}
                onShow={showBase}
                onDelete={deleteBase}
              />
            )}

            {tab === 'hotkeys' && <KeybindsPanel />}
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
              <span className={styles.activeHint}><kbd>{keyName(binds.rotate)}</kbd> {t.editor.rotate}</span>
            </div>
          )}
        </aside>
        )}

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
              paste={
                paste && moving
                  ? { clip: moving, turn: paste.turn, move: true }
                  : paste && clipboard.length > 0 ? { clip: clipboard, turn: paste.turn } : null
              }
              onPaste={(items) => {
                if (moving) {
                  // przeniesienie: te same elementy (te same id) w nowym miejscu
                  const ids = new Set(moving.map(i => i.id));
                  commitAction([...placedItemsRef.current.filter(i => !ids.has(i.id)), ...items]);
                  setMoving(null);
                } else {
                  commitAction([...placedItemsRef.current, ...items.map(i => ({ ...i, id: newItemId() }))]);
                }
                setPaste(null);
              }}
            />
          ) : null}
          {is3DMode && (
            <>
              <Hotbar hotbar={hotbar} selected={heldSlot} />
              {(overlay === 'none' || overlay === 'chat') && <Chat
                key={chatOpen.seed}
                open={overlay === 'chat'}
                initial={chatOpen.initial}
                messages={messages}
                history={history}
                itemIds={ITEM_IDS}
                onSubmit={runCommand}
                onClose={() => useView3D.getState().overlay === 'chat' && closeOverlay()}
              />}
              {overlay === 'inventory' && (
                <Inventory
                  hotbar={hotbar}
                  selected={heldSlot}
                  material={material}
                  onMaterial={setMaterial}
                  onAssign={(i, itemId) => {
                    setHotbar(hotbar.map((v, k) => (k === i ? itemId : v)));
                    if (i === heldSlot || i === slot) setActiveItem(itemId);
                  }}
                  onSwap={(a, b) => {
                    const next = [...hotbar];
                    [next[a], next[b]] = [next[b], next[a]];
                    setHotbar(next);
                  }}
                  onSelectSlot={selectSlot}
                  onClose={closeOverlay}
                />
              )}
              {overlay === 'map' && activeMapData && (
                <MapScreen
                  meta={activeMapData.meta}
                  site={project?.site}
                  onTeleport={(x, z) => {
                    sendSceneCommand({ kind: 'tp', x, z });
                    closeOverlay();
                  }}
                  onClose={closeOverlay}
                />
              )}
              {overlay === 'menu' && (
                <PauseMenu
                  title={project?.name ?? ''}
                  onResume={closeOverlay}
                  footer={t.hud.commandsHint(keyName(binds.chat))}
                  actions={[
                    { label: t.hud.to2d, icon: <GridFour size={16} weight="bold" />, onClick: () => setView3D(false) },
                    { label: t.editor.export, icon: <DownloadSimple size={16} weight="bold" />, onClick: () => project && exportProject({ ...project, items: placedItems }) },
                    { label: t.hud.projects, icon: <ArrowLeft size={16} weight="bold" />, onClick: () => router.push('/builder') },
                  ]}
                  sections={[
                    {
                      id: 'scene',
                      label: t.hud.sections.scene,
                      content: (
                        <>
                          <div className={hud.field}>
                            <span>{t.editor.timeOfDay}</span>
                            <div className={styles.segmented} role="group" aria-label={t.editor.timeOfDay}>
                              {(['day', 'dusk', 'night'] as TimeOfDay[]).map(time => {
                                const Icon = time === 'day' ? Sun : time === 'dusk' ? SunHorizon : Moon;
                                return (
                                  <button key={time} data-on={scene.time === time || undefined} onClick={() => setScene({ time })}>
                                    <Icon size={14} weight="bold" /> {t.time[time]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <label className={hud.toggle}>
                            <input type="checkbox" checked={showBedAreas} onChange={e => setShowBedAreas(e.target.checked)} />
                            {t.editor.bedAreas}
                          </label>
                        </>
                      ),
                    },
                    {
                      id: 'map',
                      label: t.hud.sections.map,
                      content: (
                        <MapPicker
                          site={project?.site}
                          onChange={setSite}
                          showUnderlay={showUnderlay}
                          onToggleUnderlay={() => setShowUnderlay(v => !v)}
                          onTeleport={(x, z) => {
                            sendSceneCommand({ kind: 'tp', x, z });
                            closeOverlay();
                          }}
                        />
                      ),
                    },
                    {
                      id: 'bases',
                      label: t.hud.sections.bases,
                      content: (
                        <BasesPanel
                          items={placedItems}
                          site={project?.site}
                          map={activeMapData}
                          hint={t.bases.hint3d}
                          onMove={(b) => {
                            startMove(b.items);
                            closeOverlay();
                          }}
                          onTeleport={(b) => {
                            if (!project?.site) return;
                            const w = baseWorld(b, project.site);
                            sendSceneCommand({ kind: 'tp', x: w.x, z: w.z, y: w.y });
                            closeOverlay();
                          }}
                          onDelete={deleteBase}
                        />
                      ),
                    },
                    { id: 'keys', label: t.hud.sections.keys, content: <KeybindsPanel /> },
                  ]}
                />
              )}
            </>
          )}
          {!is3DMode && (
            <>
              <div
                className={styles.grid}
                style={{
                  inset: -gridMajor,
                  backgroundSize: `${gridMajor}px ${gridMajor}px, ${gridMajor}px ${gridMajor}px, ${gridMinor}px ${gridMinor}px, ${gridMinor}px ${gridMinor}px`,
                  transform: `translate3d(${((pan.x % gridMajor) + gridMajor) % gridMajor}px, ${((pan.y % gridMajor) + gridMajor) % gridMajor}px, 0)`,
                }}
              />
              {project?.site && showUnderlay && (
                <div
                  className={styles.canvas}
                  style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
                >
                  <SiteUnderlay site={project.site} />
                </div>
              )}
              <PlanCanvas
                items={canvasItems}
                currentFloor={currentFloor}
                showBedAreas={showBedAreas}
                selectedIds={selectedSet}
                hover={canvasHover}
                drag={canvasDrag}
                pan={pan}
                scale={scale}
              />
              <div
                className={styles.canvas}
                style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
              >

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
                        opacity: planFloor(item) === currentFloor ? undefined : 0.3,
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
                  <p>{t.editor.emptyHint[0]} <kbd>{keyName(binds.slot1)}</kbd> {t.editor.emptyHint[1]}</p>
                </div>
              )}

              <div className={styles.statusbar}>
                <span>{t.editor.floorLabel(currentFloor - floorBase)}: {floorCount}</span>
                <span>x {Math.round(mousePos.x)}, y {Math.round(mousePos.y)}</span>
                <span className={styles.zoom}>
                  <button onClick={() => {
                    const r = containerRef.current?.getBoundingClientRect();
                    if (r) zoomAt(r.width / 2, r.height / 2, Math.max(scale / 1.2, 0.2));
                  }} aria-label={t.editor.zoomOut}>-</button>
                  {Math.round(scale * 100)}%
                  <button onClick={() => {
                    const r = containerRef.current?.getBoundingClientRect();
                    if (r) zoomAt(r.width / 2, r.height / 2, Math.min(scale * 1.2, 4));
                  }} aria-label={t.editor.zoomIn}>+</button>
                </span>
                {pastePreview && (
                  <span className={styles.statusActive}>
                    {t.editor.pasteHint(pastePreview.items.length, keyName(binds.rotate))}
                  </span>
                )}
                {activeDef && (
                  <span className={styles.statusActive}>
                    {isRemoverActive
                      ? t.editor.demolishHint
                      : activeDef.shape === 'hatch' && !isValidPlacement
                        ? t.editor.hatchHint
                        : (activeDef.part === 'floor' || activeDef.part === 'tri_floor') && currentFloor > 0
                          ? t.editor.floorHint
                          : activeDef.shape === 'wall' && previewItem && wallMissingPillars(activeDef, previewItem, placedItems)
                            ? t.editor.wallHint
                          : isRoofLayer(activeDef) && previewItem && !roofSupported(activeDef, previewItem, placedItems)
                            ? t.editor.roofHint
                        : t.editor.placingHint(itemFullLabel(activeDef, t), keyName(binds.rotate))}
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
