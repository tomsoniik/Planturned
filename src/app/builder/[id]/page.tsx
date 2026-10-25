"use client";

import React, { useState, useMemo, useRef, useEffect, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsOutCardinal,
  Bed,
  Bird,
  Buildings,
  ChartBar,
  Copy,
  CopySimple,
  CornersOut,
  Crosshair,
  Cube,
  Cursor,
  DownloadSimple,
  Eye,
  FloppyDisk,
  FolderOpen,
  FrameCorners,
  GameController,
  GlobeHemisphereWest,
  GridFour,
  Hammer,
  Hand,
  House,
  Keyboard,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  MapTrifold,
  Moon,
  PaintBrush,
  PaintBucket,
  PencilSimple,
  PersonSimpleWalk,
  Planet,
  Plus,
  SelectionAll,
  SidebarSimple,
  SlidersHorizontal,
  Stack,
  Sun,
  SunHorizon,
  Terminal,
  Trash,
  Translate,
} from '@phosphor-icons/react';
import styles from '../builder.module.css';
import { useAppStore } from '@/store/useAppStore';
import { exportProject, getProject, updateProject, type Project } from '@/lib/projects';
import { loadMap, type MapData, type Site } from '@/lib/terrain';
import { DEFAULT_SCENE, type SceneSettings, type TimeOfDay } from '@/lib/scene';
import { itemFullLabel, itemLabel } from '@/lib/i18n';
import { useI18n, useT } from '@/components/I18nProvider';
import TopBar, { Dialog, type MenuEntry } from '@/components/editor/TopBar';
import { ToolRail, ViewBar, ViewMenu, type ToolDef, type ViewItem } from '@/components/editor/ViewportChrome';
import { Actions, Field, Fields, Inspector, ObjHead, Palette, PanelSlot, RaidSection, Section, SectionTool, Seg, SwitchRow, type InspectorTab } from '@/components/editor/Inspector';
import Dock, { LayersAdd, Transport, type DockView, type LayerRow } from '@/components/editor/Dock';
import sh from '@/components/editor/EditorShell.module.css';
import LangSwitch from '@/components/LangSwitch';
import SiteUnderlay from '@/components/SiteUnderlay';
import PlanCanvas, { layerOf } from '@/components/PlanCanvas';
import KeybindsPanel from '@/components/KeybindsPanel';
import { BuildWindow, type WindowTab } from '@/components/BuildWindow';
import MapChooser from '@/components/MapChooser';
import BasesPanel, { baseWorld, useBases, type BaseInfo } from '@/components/BasesPanel';
import MaterialsPanel from '@/components/MaterialsPanel';
import { loadProps } from '@/lib/props';
import Settings3DPanel from '@/components/Settings3DPanel';
import { useSettings3D } from '@/lib/settings3d';
import { Chat, Inventory, MapScreen, QuickStart, type ChatMessage } from '@/components/Hud3D';
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
  REMOVER,
  UNITS_PER_METER,
  computePaste,
  computePlacement,
  findDef,
  isPropId,
  removeItems,
  resnapDoors,
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

/** Baza (połączone elementy) z ostatnio postawionym elementem: na niej otwiera się plan. */
const newestBase = (items: PlacedItem[]) => {
  const last = items.at(-1);
  return last ? baseGroups(items).find(g => g.some(i => i.id === last.id)) : undefined;
};

/** Losowy spawn dla /spawn bez numeru (1..n). */
const randomSpawn = (n: number) => Math.floor(Math.random() * n) + 1;

/** Id elementów do podpowiedzi komendy /give. */
const ITEM_IDS = BUILD_ITEMS.map(i => i.id);

export default function BuilderCanvas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addNotification } = useAppStore();
  const { t } = useI18n();
  const binds = useKeybinds(s => s.binds);
  const hydrateKeybinds = useKeybinds(s => s.hydrate);
  useEffect(() => hydrateKeybinds(), [hydrateKeybinds]);
  const hydrateSettings3D = useSettings3D(s => s.hydrate);
  useEffect(() => hydrateSettings3D(), [hydrateSettings3D]);
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
  // Okno klocków nad planem 2D (E) i jego zakładka
  const [windowTab, setWindowTab] = useState<WindowTab>('blocks');
  const [windowOpen, setWindowOpen] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [showBedAreas, setShowBedAreas] = useState(true);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [showUnderlay, setShowUnderlay] = useState(true);

  // Shell edytora: inspektor, dolny panel, siatka, narzędzie przesuwania widoku, okna Pomocy
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('props');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [dockView, setDockView] = useState<DockView>('bar');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [panTool, setPanTool] = useState(false);
  const [dialog, setDialog] = useState<'help' | 'keys' | 'commands' | 'settings3d' | null>(null);
  /** Ostatni kolor malowania: narzędzie Maluj wraca do niego po wyłączeniu. */
  const lastPaintRef = useRef(PAINT_COLORS[0]);
  // Wąski ekran: inspektor zasłaniałby plan, więc startuje schowany (przełącznik na pasku widoku)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.innerWidth <= 900) setInspectorOpen(false);
  }, []);
  const walk3d = useView3D(s => s.walk);
  const orbiting = useView3D(s => s.orbit);

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
    // plan otwiera się na ostatnio budowanej bazie, na jej najniższym poziomie (skybase stoi np. na poziomie 9, nie na 0)
    if (p.items.length) setCurrentFloor(Math.min(...(newestBase(p.items) ?? p.items).map(planFloor)));
    lastSavedRef.current = JSON.stringify(p.items);
  }, [id]);

  // Dawne wersje: po wczytaniu rekwizytów (findDef zna wtedy prop_<id>) drzwi na wysokość jak w grze,
  // a rekwizyty usunięte z planera (spoza propCatalog) znikają z projektu
  useEffect(() => {
    if (!project) return;
    let alive = true;
    loadProps().then(props => alive && setPlacedItems(items => {
      // bez listy rekwizytów (błąd sieci) niczego nie usuwamy
      const known = props.length ? items.filter(i => !isPropId(i.itemId) || findDef(i.itemId)) : items;
      return resnapDoors(known.length === items.length ? items : known);
    }));
    return () => {
      alive = false;
    };
  }, [project]);

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
    const set = new Set([...FLOORS.map(f => f + floorBase), ...levels, currentFloor, Math.max(floorBase + FLOORS.length - 1, ...levels) + 1]);
    return [...set].sort((a, b) => a - b);
  }, [placedItems, floorBase, currentFloor]);

  const setSite = (site: Site | undefined) => {
    if (!project) return;
    updateProject(id, { site, noMap: !site });
    setProject({ ...project, site, noMap: !site });
  };
  // Nowy projekt bez mapy i bez elementów: najpierw pytamy, na jakiej mapie budujesz
  const [chooserOpen, setChooserOpen] = useState(false);
  const needsMap = !!project && !project.site && !project.noMap && placedItems.length === 0;

  const renameProject = (name: string) => {
    if (!project) return;
    updateProject(id, { name });
    setProject({ ...project, name });
  };


  /** Przybornik: wybór elementu (bez odkładania przy drugim kliknięciu, to robi Esc). */
  const pickItem = (itemId: string) => {
    setPaste(null);
    setMoving(null);
    setPanTool(false);
    setActiveItem(itemId);
    setTurn(0);
  };

  const selectItem = (itemId: string | null) => {
    setPaste(null);
    setMoving(null);
    setPanTool(false);
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
  /** Plan dopasowany do elementów (zoom i środek), z marginesem; bez elementów: punkt 0,0 na środku. */
  const fitItems = (items: PlacedItem[]) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    if (items.length === 0) {
      setScale(1);
      setPan({ x: r.width / 2, y: r.height / 2 });
      return;
    }
    const xs = items.map(i => i.x), ys = items.map(i => i.y);
    const w = Math.max(...xs) - Math.min(...xs) + 120, h = Math.max(...ys) - Math.min(...ys) + 120;
    // mała baza nie wypełnia całego ekranu (max 150%)
    const next = Math.min(1.5, Math.max(0.2, Math.min(r.width / w, r.height / h) * 0.85));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    setScale(next);
    setPan({ x: r.width / 2 - cx * next, y: r.height / 2 - cy * next });
  };
  /**
   * Plan pokazuje bazę: jeśli na bieżącym piętrze nic nie ma (np. baza postawiona w Sandboxie stoi na terenie albo w powietrzu),
   * przechodzi na najniższe piętro z elementami, i dopasowuje widok do elementów tego piętra.
   */
  const focusPlan = (items: PlacedItem[], floor: number) => {
    const level = items.length && !items.some(i => planFloor(i) === floor) ? Math.min(...items.map(planFloor)) : floor;
    if (level !== floor) setCurrentFloor(level);
    fitItems(items.filter(i => planFloor(i) === level));
  };

  // Widok na bazie przy pierwszym wczytaniu
  const centeredRef = useRef(false);
  useEffect(() => {
    if (!project || centeredRef.current || is3DMode) return;
    centeredRef.current = true;
    // piętro (najniższe ostatnio budowanej bazy) ustawia efekt wczytania projektu
    const base = newestBase(project.items) ?? [];
    const level = base.length ? Math.min(...base.map(planFloor)) : 0;
    fitItems(base.filter(i => planFloor(i) === level));
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

  /** Klocek z okna: już jest na pasku, to ten slot; inaczej trafia do wybranego slotu (jak w ekwipunku gry). */
  const takeItem = (itemId: string) => {
    pickItem(itemId);
    const def = findDef(itemId);
    if (def?.material) setMaterial(def.material);
    if (!def?.part) return; // wyburzanie i łóżko mają własne klawisze
    const at = hotbar.indexOf(itemId);
    if (at >= 0) {
      setSlot(at);
      return;
    }
    const target = heldSlot ?? slot ?? (hotbar.indexOf(null) >= 0 ? hotbar.indexOf(null) : 0);
    setHotbar(hotbar.map((v, i) => (i === target ? itemId : v)));
    setSlot(target);
  };

  // itemId: przedmiot właśnie włożony do slotu (pasek w tym renderze jest jeszcze sprzed zapisu)
  const selectSlot = (i: number, itemId?: string | null) => {
    setSlot(i);
    setPaste(null);
    setMoving(null);
    setPanTool(false);
    setActiveItem(itemId !== undefined ? itemId : hotbar[i] ?? null);
    setTurn(0);
  };

  /** Ostatni element w chwili wejścia do 3D: po powrocie widać, czy coś tam postawiono. */
  const lastBefore3DRef = useRef<string | undefined>(undefined);
  const setView3D = (on: boolean) => {
    if (on) lastBefore3DRef.current = placedItemsRef.current.at(-1)?.id;
    setIs3DMode(on);
    setOverlay('none');
    setWindowOpen(false);
    setPanTool(false);
    if (!on) {
      unlockPointer();
      // to, co postawiono w 3D, od razu widać na planie: piętro i widok na bazie z najnowszym elementem
      const items = placedItemsRef.current;
      const group = items.at(-1)?.id !== lastBefore3DRef.current ? newestBase(items) : undefined;
      if (group) {
        const level = Math.min(...group.map(planFloor));
        setCurrentFloor(level);
        fitItems(group.filter(i => planFloor(i) === level));
      } else focusPlan(items, currentFloor);
    }
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
          const n = args[0] ? Math.round(Number(args[0])) : randomSpawn(spawns.length);
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
        case 'screenshot':
          if (sendSceneCommand({ kind: 'screenshot' })) info(t.commands.screenshot);
          else fail(t.commands.noScene);
          break;
        case 'orbit':
          if (sendSceneCommand({ kind: 'orbit', on: true })) info(t.commands.orbit);
          else fail(t.commands.noScene);
          break;
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
      commitAction(removeItems(placedItems, new Set(selectedItemIds)));
      setSelectedItemIds([]);
    } else if (selectedItemId) {
      commitAction(removeItems(placedItems, new Set([selectedItemId])));
    }
    setSelectedItemId(null);
  };

  // --- Bazy (grupy połączonych elementów) ---
  /** Przenoszona baza (G): wisi w celowniku do kliknięcia. */
  const [moving, setMoving] = useState<PlacedItem[] | null>(null);
  const startMove = (items: PlacedItem[]) => {
    setActiveItem(null);
    setMoving(items);
    setPaste({ turn: 0 });
  };
  const deleteBase = (b: BaseInfo) => {
    if (!window.confirm(t.bases.confirmDelete(b.items.length))) return;
    const ids = new Set(b.items.map(i => i.id));
    commitAction(removeItems(placedItems, ids));
    setSelectedItemIds(prev => prev.filter(i => !ids.has(i)));
  };
  /** 2D: plan przybliżony do bazy, jej najniższe piętro, cała baza zaznaczona. */
  const showBase = (b: BaseInfo) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setPan({ x: rect.width / 2 - b.cx * scale, y: rect.height / 2 - b.cy * scale });
    setCurrentFloor(Math.min(...b.items.map(planFloor)));
    setSelectedItemIds(b.items.map(i => i.id));
  };

  // Kółko w 3D: następny / poprzedni slot paska (jak w grze)
  useEffect(() => {
    if (!is3DMode) return;
    const onWheel = (e: WheelEvent) => {
      // na orbicie kółko przybliża kamerę, a nie zmienia slotu
      if (useView3D.getState().overlay !== 'none' || useView3D.getState().orbit || !containerRef.current?.contains(e.target as Node)) return;
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
    // Narzędzie Przesuń widok: lewy przycisk przesuwa plan (prawy przesuwa zawsze)
    if (panTool && e.button === 0) {
      setIsPanning(true);
      containerRef.current?.setPointerCapture(e.pointerId);
      return;
    }
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
    if (!dragState && !selectionBox && !paste && !panTool && (activeItem === null || isRemoverActive)) {
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

  /** color: kolor z palety inspektora; bez niego kolor narzędzia Maluj ('clear' zdejmuje kolor). */
  const paintItems = (targets: string[], color = selectedColor) => {
    const set = new Set(targets);
    commitAction(placedItems.map(item =>
      set.has(item.id) ? { ...item, customColor: color === 'clear' ? undefined : color } : item
    ));
  };

  const handleItemPointerDown = (e: React.PointerEvent, itemId: string) => {
    if (e.button !== 0 || paste) return;

    if (isRemoverActive) {
      e.stopPropagation();
      commitAction(removeItems(placedItems, new Set([itemId])));
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

  // --- Akcje shellu (menu, inspektor, narzędzia) ---
  const bases = useBases(placedItems);
  const selectedList = useMemo(() => placedItems.filter(i => selectedSet.has(i.id)), [placedItems, selectedSet]);

  const saveNow = () => {
    if (!project) return;
    updateProject(id, { items: placedItems });
    lastSavedRef.current = JSON.stringify(placedItems);
    setSavedAt(new Date());
    addNotification(t.shell.savedNow, 'success');
  };
  const exportNow = () => project && exportProject({ ...project, items: placedItems });
  const clearProject = () => {
    if (placedItems.length > 0 && window.confirm(t.editor.confirmClear)) commitAction([]);
  };
  const deselect = () => {
    setSelectedItemIds([]);
    setSelectedItemId(null);
  };
  const copySelection = () => {
    if (selectedList.length === 0) return;
    setClipboard(selectedList);
    addNotification(t.editor.copied(selectedList.length), 'success');
  };
  const pasteClipboard = () => {
    if (clipboard.length === 0) return;
    setActiveItem(null);
    deselect();
    setPaste({ turn: 0 });
  };
  /** Duplikuj: kopia zaznaczenia od razu wisi pod kursorem do wstawienia. */
  const duplicateSelection = () => {
    if (selectedList.length === 0) return;
    setClipboard(selectedList);
    setActiveItem(null);
    setPanTool(false);
    deselect();
    setPaste({ turn: 0 });
  };
  const selectAll = () => {
    setSelectedItemIds(placedItems.filter(i => planFloor(i) === currentFloor).map(i => i.id));
    setSelectedItemId(null);
  };
  /** Cała baza: połączone elementy, do których należy zaznaczenie. */
  const selectBase = () => {
    const ids = new Set(baseGroups(placedItems).filter(g => g.some(i => selectedSet.has(i.id))).flat().map(i => i.id));
    setSelectedItemIds([...ids]);
    setSelectedItemId(null);
  };
  const addToBar = (itemId: string) => {
    if (hotbar.includes(itemId)) return;
    const target = hotbar.indexOf(null) >= 0 ? hotbar.indexOf(null) : slot ?? 0;
    setHotbar(hotbar.map((v, i) => (i === target ? itemId : v)));
  };
  const zoomTo = (next: number) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (r) zoomAt(r.width / 2, r.height / 2, Math.min(4, Math.max(0.2, next)));
  };
  /** Wyśrodkuj: plan dopasowany do elementów bieżącego piętra (albo całego projektu). */
  const fitView = () => {
    const onFloor = placedItems.filter(i => planFloor(i) === currentFloor);
    fitItems(onFloor.length ? onFloor : placedItems);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  const selectTool = () => {
    setPaste(null);
    setMoving(null);
    setActiveItem(null);
    setPanTool(false);
    if (selectedColor) {
      lastPaintRef.current = selectedColor;
      setSelectedColor('');
    }
  };
  const togglePaint = () => {
    if (selectedColor) {
      lastPaintRef.current = selectedColor;
      setSelectedColor('');
      return;
    }
    setPaste(null);
    setActiveItem(null);
    setPanTool(false);
    setSelectedColor(lastPaintRef.current);
    setInspectorTab('props');
  };
  const pickPaint = (color: string) => {
    if (color && color !== 'clear') lastPaintRef.current = color;
    setSelectedColor(color);
  };
  const openBlocks = () => {
    if (is3DMode) openOverlay('inventory');
    else {
      setWindowTab('blocks');
      setWindowOpen(true);
    }
  };
  const orbitBase = (b: BaseInfo) =>
    sendSceneCommand({ kind: 'orbit', on: true, target: [b.cx / UNITS_PER_METER, b.floor * LEVEL_HEIGHT, b.cy / UNITS_PER_METER] });
  const teleportBase = (b: BaseInfo) => {
    if (!project?.site) return;
    const w = baseWorld(b, project.site);
    sendSceneCommand({ kind: 'tp', x: w.x, z: w.z, y: w.y });
  };

  // Okna Pomocy i wybór mapy w 3D zamrażają scenę jak nakładka (klawisze nie chodzą postacią)
  const modalOpen = !!dialog || chooserOpen;
  useEffect(() => {
    if (!is3DMode) return;
    const view = useView3D.getState();
    if (modalOpen && view.overlay === 'none') view.setOverlay('menu');
    if (!modalOpen && view.overlay === 'menu') view.setOverlay('none');
  }, [modalOpen, is3DMode]);

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
          // Esc z przechwyconym kursorem tylko go oddaje (panele edytora są wtedy pod ręką); drugi raz nic nie zamyka
          if (performance.now() - view.changedAt < 300) return;
          if (view.overlay !== 'none') setOverlay('none');
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

      if (!is3DMode && windowOpen && (e.key === 'Escape' || (!mod && e.code === binds.inventory))) {
        e.preventDefault();
        setWindowOpen(false);
        return;
      }
      if (!is3DMode && !mod && e.code === binds.inventory) {
        e.preventDefault();
        setWindowOpen(true);
        return;
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
      if (mod && k === 's') {
        e.preventDefault();
        saveNow();
        return;
      }
      if (mod && k === 'd' && !is3DMode) {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && k === 'a' && !is3DMode) {
        e.preventDefault();
        selectAll();
        return;
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
  const mapName = project?.site?.map ?? t.shell.noMap;
  const floorName = (lvl: number) => t.editor.floorLabel(lvl - floorBase);
  const floorCounts = new Map<number, number>();
  for (const i of placedItems) floorCounts.set(planFloor(i), (floorCounts.get(planFloor(i)) ?? 0) + 1);
  const floorsUsed = floorCounts.size;
  const TimeIcon = scene.time === 'day' ? Sun : scene.time === 'dusk' ? SunHorizon : Moon;
  const timeOptions = (['day', 'dusk', 'night'] as TimeOfDay[]).map(time => ({
    id: time,
    label: t.time[time],
    icon: time === 'day' ? <Sun size={13} weight="bold" /> : time === 'dusk' ? <SunHorizon size={13} weight="bold" /> : <Moon size={13} weight="bold" />,
  }));

  // Podpowiedź u dołu planu: wklejanie, trzymany element (z powodem, gdy nie pasuje), wyburzanie, malowanie
  const hint2d: { text: string; tone: 'accent' | 'bad' } | null = pastePreview
    ? { text: t.editor.pasteHint(pastePreview.items.length, keyName(binds.rotate)), tone: 'accent' }
    : activeDef
      ? {
          text: isRemoverActive
            ? t.editor.demolishHint
            : activeDef.shape === 'hatch' && !isValidPlacement
              ? t.editor.hatchHint
              : (activeDef.part === 'floor' || activeDef.part === 'tri_floor') && currentFloor > 0
                ? t.editor.floorHint
                : activeDef.shape === 'wall' && previewItem && wallMissingPillars(activeDef, previewItem, placedItems)
                  ? t.editor.wallHint
                  : isRoofLayer(activeDef) && previewItem && !roofSupported(activeDef, previewItem, placedItems)
                    ? t.editor.roofHint
                    : t.editor.placingHint(itemFullLabel(activeDef, t), keyName(binds.rotate)),
          tone: isRemoverActive || (previewItem && !isValidPlacement) ? 'bad' : 'accent',
        }
      : selectedColor
        ? { text: t.toolbox.paint(selectedColor === 'clear' ? t.editor.colorDefault : selectedColor), tone: 'accent' }
        : null;

  // --- Menu górnego paska ---
  const appMenu: MenuEntry[] = [
    { label: t.common.home, icon: <House size={16} weight="duotone" />, href: '/' },
    { label: t.common.myProjects, icon: <FolderOpen size={16} weight="duotone" />, href: '/builder' },
    { label: t.changelog.nav, icon: <ArrowCounterClockwise size={16} weight="duotone" />, href: '/changelog' },
  ];
  const hasSelection = selectedList.length > 0;
  const menus: Record<'file' | 'edit' | 'view' | 'help', MenuEntry[]> = {
    file: [
      { label: t.common.myProjects, icon: <ArrowLeft size={16} weight="bold" />, href: '/builder' },
      'rule',
      { label: t.shell.save, icon: <FloppyDisk size={16} weight="duotone" />, hint: 'Ctrl S', onClick: saveNow },
      { label: t.editor.export, icon: <DownloadSimple size={16} weight="duotone" />, onClick: exportNow },
      { label: t.mapChooser.change, icon: <MapTrifold size={16} weight="duotone" />, onClick: () => setChooserOpen(true) },
      'rule',
      { label: t.editor.clear, icon: <Trash size={16} weight="duotone" />, danger: true, onClick: clearProject },
    ],
    edit: [
      { label: t.shell.undo, hint: 'Ctrl Z', disabled: past.length === 0, onClick: undo },
      { label: t.shell.redo, hint: 'Ctrl Y', disabled: future.length === 0, onClick: redo },
      'rule',
      { label: t.shell.copy, icon: <Copy size={16} weight="duotone" />, hint: 'Ctrl C', disabled: !hasSelection, onClick: copySelection },
      { label: t.shell.paste, hint: 'Ctrl V', disabled: clipboard.length === 0, onClick: pasteClipboard },
      { label: t.shell.duplicate, icon: <CopySimple size={16} weight="duotone" />, hint: 'Ctrl D', disabled: !hasSelection || is3DMode, onClick: duplicateSelection },
      { label: t.shell.remove, icon: <Trash size={16} weight="duotone" />, hint: keyName(binds.deleteSelected), disabled: !hasSelection, onClick: deleteSelection },
      'rule',
      { label: t.shell.selectAll, icon: <SelectionAll size={16} weight="duotone" />, hint: 'Ctrl A', disabled: is3DMode, onClick: selectAll },
      { label: t.shell.deselect, hint: 'Esc', disabled: !hasSelection, onClick: deselect },
    ],
    view: [
      { label: t.editor.modes.planner, checked: !is3DMode, onClick: () => setView3D(false) },
      { label: t.editor.modes.sandbox, checked: is3DMode, onClick: () => setView3D(true) },
      'rule',
      { label: t.shell.underlay, icon: <GlobeHemisphereWest size={16} weight="duotone" />, checked: showUnderlay, disabled: !project?.site || is3DMode, onClick: () => setShowUnderlay(v => !v) },
      { label: t.shell.beds, icon: <Bed size={16} weight="duotone" />, checked: showBedAreas, onClick: () => setShowBedAreas(v => !v) },
      { label: t.shell.grid, icon: <GridFour size={16} weight="duotone" />, checked: showGrid, disabled: is3DMode, onClick: () => setShowGrid(v => !v) },
      'rule',
      { label: t.shell.inspector, icon: <SidebarSimple size={16} weight="duotone" />, checked: inspectorOpen, onClick: () => setInspectorOpen(v => !v) },
      { label: t.shell.dock, checked: !dockCollapsed, onClick: () => setDockCollapsed(v => !v) },
      'rule',
      { label: t.shell.fit, icon: <FrameCorners size={16} weight="duotone" />, disabled: is3DMode, onClick: fitView },
      { label: t.shell.zoomReset, disabled: is3DMode, onClick: () => zoomTo(1) },
      'rule',
      { label: t.shell.settings3d, icon: <SlidersHorizontal size={16} weight="duotone" />, onClick: () => setDialog('settings3d') },
      { label: t.shell.fullscreen, icon: <CornersOut size={16} weight="duotone" />, onClick: toggleFullscreen },
    ],
    help: [
      { label: t.shell.howToPlay, icon: <GameController size={16} weight="duotone" />, onClick: () => setDialog('help') },
      { label: t.shell.keys, icon: <Keyboard size={16} weight="duotone" />, onClick: () => setDialog('keys') },
      { label: t.shell.commands, icon: <Terminal size={16} weight="duotone" />, onClick: () => setDialog('commands') },
      'rule',
      { label: t.common.language, icon: <Translate size={16} weight="duotone" />, extra: <LangSwitch /> },
    ],
  };

  // --- Pasek widoku nad sceną ---
  const inspectorToggle: ViewItem = { id: 'inspector', label: t.shell.inspector, icon: <SidebarSimple size={15} weight="duotone" />, on: inspectorOpen, compact: true, onClick: () => setInspectorOpen(v => !v) };
  const fullscreenBtn: ViewItem = { id: 'fullscreen', label: t.shell.fullscreen, icon: <CornersOut size={15} weight="bold" />, compact: true, onClick: toggleFullscreen };
  const viewGroups: ViewItem[][] = is3DMode
    ? [
        [
          {
            id: 'walk',
            label: walk3d ? t.shell.walk : t.shell.fly,
            icon: walk3d ? <PersonSimpleWalk size={15} weight="duotone" /> : <Bird size={15} weight="duotone" />,
            kbd: keyName(binds.toggleFly),
            onClick: () => sendSceneCommand({ kind: 'fly', on: walk3d }),
          },
          { id: 'beds', label: t.shell.beds, icon: <Bed size={15} weight="duotone" />, on: showBedAreas, onClick: () => setShowBedAreas(v => !v) },
          {
            id: 'time',
            node: (
              <ViewMenu
                label={t.time[scene.time]}
                icon={<TimeIcon size={15} weight="duotone" />}
                entries={timeOptions.map(o => ({ label: o.label, icon: o.icon, checked: scene.time === o.id, onClick: () => setScene({ time: o.id }) }))}
              />
            ),
          },
        ],
        [
          ...(activeMapData ? [{ id: 'map', label: t.shell.map, icon: <MapTrifold size={15} weight="duotone" />, kbd: keyName(binds.map), onClick: () => openOverlay('map') }] : []),
          { id: 'orbit', label: t.shell.orbit, icon: <Planet size={15} weight="duotone" />, on: orbiting, onClick: () => sendSceneCommand({ kind: 'orbit', on: !orbiting }) },
        ],
        [fullscreenBtn, inspectorToggle],
      ]
    : [
        [
          ...(project?.site ? [{ id: 'underlay', label: t.shell.underlay, icon: <GlobeHemisphereWest size={15} weight="duotone" />, on: showUnderlay, onClick: () => setShowUnderlay(v => !v) }] : []),
          { id: 'beds', label: t.shell.beds, icon: <Bed size={15} weight="duotone" />, on: showBedAreas, onClick: () => setShowBedAreas(v => !v) },
          { id: 'grid', label: t.shell.grid, icon: <GridFour size={15} weight="duotone" />, on: showGrid, onClick: () => setShowGrid(v => !v) },
        ],
        [
          {
            id: 'zoom',
            node: (
              <ViewMenu
                label={`${Math.round(scale * 100)}%`}
                entries={[
                  { label: t.editor.zoomIn, icon: <MagnifyingGlassPlus size={16} weight="duotone" />, onClick: () => zoomTo(scale * 1.2) },
                  { label: t.editor.zoomOut, icon: <MagnifyingGlassMinus size={16} weight="duotone" />, onClick: () => zoomTo(scale / 1.2) },
                  'rule',
                  { label: '50%', checked: Math.abs(scale - 0.5) < 0.01, onClick: () => zoomTo(0.5) },
                  { label: '100%', checked: Math.abs(scale - 1) < 0.01, onClick: () => zoomTo(1) },
                  { label: '200%', checked: Math.abs(scale - 2) < 0.01, onClick: () => zoomTo(2) },
                  'rule',
                  { label: t.shell.fit, icon: <FrameCorners size={16} weight="duotone" />, onClick: fitView },
                ]}
              />
            ),
          },
          fullscreenBtn,
          inspectorToggle,
        ],
      ];

  // --- Rail narzędzi ---
  const tools: ToolDef[] = [
    { id: 'place', label: t.shell.tool.place, icon: <Plus size={18} weight="bold" />, on: !!activeDef && !isRemoverActive, more: true, kbd: keyName(binds.inventory), onClick: openBlocks },
    { id: 'select', label: t.shell.tool.select, icon: <Cursor size={18} weight="fill" />, on: !activeItem && !selectedColor && !panTool && !paste, onClick: selectTool },
    { id: 'demolish', label: t.shell.tool.demolish, icon: <Hammer size={18} weight="duotone" />, on: isRemoverActive, danger: true, kbd: keyName(binds.demolish), onClick: () => selectItem(REMOVER.id) },
    ...(is3DMode
      ? [{ id: 'orbit', label: t.shell.orbit, icon: <Planet size={18} weight="duotone" />, on: orbiting, onClick: () => sendSceneCommand({ kind: 'orbit', on: !orbiting }) }]
      : [
          { id: 'paint', label: t.shell.tool.paint, icon: <PaintBucket size={18} weight="duotone" />, on: !!selectedColor && !activeItem, onClick: togglePaint },
          {
            id: 'pan',
            label: t.shell.tool.pan,
            icon: <Hand size={18} weight="duotone" />,
            on: panTool,
            onClick: () => {
              if (!panTool) {
                setActiveItem(null);
                setPaste(null);
              }
              setPanTool(!panTool);
            },
          },
        ]),
  ];

  // --- Inspektor: właściwości zaznaczenia, trzymanego elementu albo projektu ---
  const paintPalette = (
    <Palette
      colors={PAINT_COLORS}
      value={selectedColor}
      onPick={c => {
        setActiveItem(null);
        pickPaint(c);
      }}
      extra={[
        { id: 'off', label: t.editor.colorOff, on: selectedColor === '', onClick: () => pickPaint('') },
        { id: 'clear', label: t.editor.colorDefault, on: selectedColor === 'clear', onClick: () => pickPaint('clear') },
      ]}
    />
  );
  const renderProps = () => {
    const selIds = selectedList.map(i => i.id);
    if (!is3DMode && selectedList.length > 0) {
      const single = selectedList.length === 1 ? selectedList[0] : null;
      const def = single ? findDef(single.itemId) : undefined;
      const actions = (
        <Actions
          items={[
            { id: 'copy', label: t.shell.copy, icon: <Copy size={17} weight="duotone" />, onClick: copySelection },
            { id: 'dup', label: t.shell.duplicate, icon: <CopySimple size={17} weight="duotone" />, onClick: duplicateSelection },
            { id: 'base', label: t.shell.selectBase, icon: <SelectionAll size={17} weight="duotone" />, onClick: selectBase },
            { id: 'del', label: t.shell.remove, icon: <Trash size={17} weight="duotone" />, danger: true, onClick: deleteSelection },
          ]}
        />
      );
      if (single && def) {
        const color = single.customColor || def.color;
        const rot = Math.round(((single.rotation % 360) + 360) % 360);
        return (
          <>
            <ObjHead def={def} title={itemFullLabel(def, t)} sub={floorName(planFloor(single))} />
            {actions}
            <Section icon={<ArrowsOutCardinal size={15} weight="duotone" />} title={t.shell.position}>
              <Fields>
                <Field label="X" value={(single.x / UNITS_PER_METER).toFixed(1)} unit="m" />
                <Field label="Y" value={(single.y / UNITS_PER_METER).toFixed(1)} unit="m" />
                <Field label={t.shell.rotation} value={`${rot}°`} />
                <Field label={t.shell.level} value={planFloor(single) - floorBase} />
              </Fields>
            </Section>
            <Section
              icon={<PaintBrush size={15} weight="duotone" />}
              title={t.shell.appearance}
              tool={single.customColor ? <SectionTool label={t.shell.colorReset} icon={<ArrowCounterClockwise size={14} weight="bold" />} onClick={() => paintItems(selIds, 'clear')} /> : undefined}
            >
              <Fields>
                <Field label={t.shell.color} value={color.toUpperCase()} lead={<span className={sh.swatchDot} style={{ background: color }} />} />
                {def.material && <Field label={t.shell.material} value={t.materials[def.material]} />}
              </Fields>
              <Palette colors={PAINT_COLORS} value={single.customColor ?? ''} onPick={c => paintItems(selIds, c)} />
            </Section>
            <RaidSection def={def} />
          </>
        );
      }
      return (
        <>
          <ObjHead glyph={<SelectionAll size={18} weight="duotone" />} title={t.shell.selection(selectedList.length)} sub={floorName(currentFloor)} />
          {actions}
          <Section
            icon={<PaintBrush size={15} weight="duotone" />}
            title={t.shell.appearance}
            tool={<SectionTool label={t.shell.colorReset} icon={<ArrowCounterClockwise size={14} weight="bold" />} onClick={() => paintItems(selIds, 'clear')} />}
          >
            <Palette colors={PAINT_COLORS} value="" onPick={c => paintItems(selIds, c)} />
          </Section>
        </>
      );
    }
    if (activeDef && isRemoverActive) {
      return (
        <>
          <ObjHead glyph={<Hammer size={18} weight="duotone" />} title={t.tools.remover} sub={is3DMode ? t.hud.demolishHint : t.editor.demolishHint} />
          <p className={sh.note}>{is3DMode ? t.shell.aimHint : t.shell.pickHint}</p>
        </>
      );
    }
    if (activeDef) {
      const heldColor = selectedColor.startsWith('#') ? selectedColor : activeDef.color;
      return (
        <>
          <ObjHead def={activeDef} title={itemFullLabel(activeDef, t)} sub={`${t.shell.holding}, ${t.shell.rotateKey(keyName(binds.rotate))}`} />
          {!is3DMode && (
            <Section icon={<PaintBrush size={15} weight="duotone" />} title={t.shell.appearance}>
              <Fields>
                <Field label={t.shell.color} value={heldColor.toUpperCase()} lead={<span className={sh.swatchDot} style={{ background: heldColor }} />} />
                {activeDef.material && <Field label={t.shell.material} value={t.materials[activeDef.material]} />}
              </Fields>
              <Palette
                colors={PAINT_COLORS}
                value={selectedColor}
                onPick={pickPaint}
                extra={[{ id: 'def', label: t.editor.colorDefault, on: !selectedColor.startsWith('#'), onClick: () => setSelectedColor('') }]}
              />
            </Section>
          )}
          <RaidSection def={activeDef} />
        </>
      );
    }
    return (
      <>
        <ObjHead glyph={<Cube size={18} weight="duotone" />} title={project?.name || t.editor.loading} sub={t.projects.elements(placedItems.length)} />
        <Section
          icon={<MapTrifold size={15} weight="duotone" />}
          title={t.shell.map}
          tool={<SectionTool label={t.mapChooser.change} icon={<PencilSimple size={14} weight="bold" />} onClick={() => setChooserOpen(true)} />}
        >
          <Fields>
            <Field label={t.shell.map} value={mapName} wide />
          </Fields>
          {!is3DMode && project?.site && <SwitchRow label={t.mapChooser.underlay} checked={showUnderlay} onChange={setShowUnderlay} />}
          {is3DMode && activeMapData && (
            <button className={`${sh.textBtn} ${sh.sectionBtn}`} onClick={() => openOverlay('map')}>
              <MapTrifold size={15} weight="duotone" />
              {t.shell.mapScreen} ({keyName(binds.map)})
            </button>
          )}
        </Section>
        {is3DMode ? (
          <>
            <Section icon={<SunHorizon size={15} weight="duotone" />} title={t.shell.scene}>
              <Seg label={t.editor.timeOfDay} value={scene.time} options={timeOptions} onChange={time => setScene({ time })} />
              <SwitchRow label={t.editor.bedAreas} checked={showBedAreas} onChange={setShowBedAreas} />
            </Section>
            <Section icon={<PersonSimpleWalk size={15} weight="duotone" />} title={t.hud.quick.move}>
              <Seg
                label={t.shell.walk}
                value={walk3d ? 'walk' : 'fly'}
                options={[
                  { id: 'fly', label: t.shell.fly, icon: <Bird size={13} weight="bold" /> },
                  { id: 'walk', label: t.shell.walk, icon: <PersonSimpleWalk size={13} weight="bold" /> },
                ]}
                onChange={v => sendSceneCommand({ kind: 'fly', on: v === 'fly' })}
              />
            </Section>
          </>
        ) : (
          <>
            <Section icon={<Eye size={15} weight="duotone" />} title={t.shell.view}>
              <SwitchRow label={t.editor.bedAreas} checked={showBedAreas} onChange={setShowBedAreas} />
              <SwitchRow label={t.shell.grid} checked={showGrid} onChange={setShowGrid} />
            </Section>
            <Section icon={<PaintBucket size={15} weight="duotone" />} title={t.shell.paint}>
              <p className={sh.lead}>{t.shell.paintHint}</p>
              {paintPalette}
            </Section>
          </>
        )}
        <Section icon={<ChartBar size={15} weight="duotone" />} title={t.shell.stats}>
          <Fields>
            <Field label={t.shell.statElements} value={placedItems.length} wide />
            <Field label={t.shell.statFloors} value={floorsUsed} />
            <Field label={t.shell.statBases} value={bases.length} />
          </Fields>
        </Section>
        <p className={sh.note}>{is3DMode ? t.shell.aimHint : t.shell.pickHint}</p>
      </>
    );
  };
  const footDef = !is3DMode && selectedList.length === 1 ? findDef(selectedList[0].itemId) : activeDef && !isRemoverActive ? activeDef : undefined;
  const footSlot = footDef ? hotbar.indexOf(footDef.id) : -1;
  const inspectorFooter = !footDef?.part ? null : footSlot >= 0 ? (
    <span>{t.shell.inBar(keyName(binds[SLOT_ACTIONS[footSlot]]))}</span>
  ) : (
    <button className={sh.footBtn} onClick={() => addToBar(footDef.id)}>
      <Plus size={14} weight="bold" />
      {t.shell.addToBar}
    </button>
  );

  // --- Dolny panel: w 2D piętra (najwyższe u góry), w 3D budowle z orbitą i teleportem ---
  const layers: LayerRow[] = is3DMode
    ? bases.map((b, i) => ({
        id: b.items[0].id,
        label: t.bases.name(i + 1),
        icon: <Buildings size={14} weight="duotone" />,
        count: b.items.length,
        title: t.bases.orbit,
        onClick: () => orbitBase(b),
        tools: project?.site ? (
          <button className={sh.layerTool} onClick={() => teleportBase(b)} title={t.bases.teleport} aria-label={t.bases.teleport}>
            <Crosshair size={13} weight="bold" />
          </button>
        ) : undefined,
      }))
    : [...floorsList].reverse().map(lvl => ({
        id: `f${lvl}`,
        label: floorName(lvl),
        icon: <Stack size={14} weight="duotone" />,
        count: floorCounts.get(lvl) ?? 0,
        on: lvl === currentFloor,
        onClick: () => setCurrentFloor(lvl),
      }));
  const addFloor = () => setCurrentFloor(Math.max(...floorsList) + 1);

  return (
    <div className={sh.shell}>
      <TopBar
        appMenu={appMenu}
        menus={menus}
        name={project?.name ?? ''}
        saved={!!savedAt}
        onRename={renameProject}
        mode={is3DMode ? 'sandbox' : 'planner'}
        onMode={m => setView3D(m === 'sandbox')}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onSave={saveNow}
        onExport={exportNow}
      />

      <div className={sh.main}>
        <div className={sh.viewport}>
          {/* Płótno */}
          <div
            ref={containerRef}
            className={styles.canvasContainer}
            data-mode={is3DMode ? '3d' : panTool ? 'pan' : isRemoverActive ? 'remove' : activeItem ? 'place' : 'select'}
            data-hover={hoverId ? 'item' : undefined}
            onPointerDown={is3DMode ? undefined : handlePointerDownCanvas}
            onPointerMove={is3DMode ? undefined : handlePointerMoveCanvas}
            onPointerUp={is3DMode ? undefined : handlePointerUpCanvas}
            onWheel={is3DMode ? undefined : handleWheel}
            onContextMenu={e => e.preventDefault()}
          >
            {is3DMode ? (
              <Builder3D
                projectName={project?.name ?? ''}
                placedItems={placedItems}
                activeItem={activeItem}
                turn={turn}
                showBedAreas={showBedAreas}
                selectedItemIds={selectedItemIds}
                scene={scene}
                site={project?.site}
                onPlaceItem={(newItem) => commitAction([...placedItemsRef.current, { ...newItem, id: newItemId() }])}
                // otwieranie drzwi i klap to stan budowli, nie edycja planu: bez wpisu w historii cofania
                onToggleItem={(itemId) => setPlacedItems((items) => items.map((i) => (i.id === itemId ? { ...i, open: !i.open } : i)))}
                onDeleteItem={(itemId) => {
                  commitAction(removeItems(placedItemsRef.current, new Set([itemId])));
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
              </>
            )}
            {!is3DMode && (
              <>
                {showGrid && (
                  <div
                    className={styles.grid}
                    style={{
                      inset: -gridMajor,
                      backgroundSize: `${gridMajor}px ${gridMajor}px, ${gridMajor}px ${gridMajor}px, ${gridMinor}px ${gridMinor}px, ${gridMinor}px ${gridMinor}px`,
                      transform: `translate3d(${((pan.x % gridMajor) + gridMajor) % gridMajor}px, ${((pan.y % gridMajor) + gridMajor) % gridMajor}px, 0)`,
                    }}
                  />
                )}
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
              </>
            )}
          </div>

          <ViewBar mapName={mapName} onMap={() => setChooserOpen(true)} groups={viewGroups} />
          <ToolRail tools={tools} />
          {!is3DMode && (
            <>
              {hint2d && <div className={sh.hint} data-tone={hint2d.tone}>{hint2d.text}</div>}
              <span className={sh.coords}>x {Math.round(mousePos.x)}, y {Math.round(mousePos.y)}</span>
            </>
          )}
          {!is3DMode && windowOpen && (
            <BuildWindow
              tab={windowTab}
              activeItem={activeItem}
              hotbar={hotbar}
              onTab={setWindowTab}
              onPick={itemId => {
                takeItem(itemId);
                setWindowOpen(false);
              }}
              onClose={() => setWindowOpen(false)}
              panels={{
                color: (
                  <>
                    <p className={styles.panelHint}>{t.editor.colorHint}</p>
                    {paintPalette}
                  </>
                ),
                bases: (
                  <BasesPanel
                    items={placedItems}
                    site={project?.site}
                    map={activeMapData}
                    hint={t.bases.hint2d}
                    onShow={b => {
                      showBase(b);
                      setWindowOpen(false);
                    }}
                    onDelete={deleteBase}
                  />
                ),
                materials: <MaterialsPanel items={placedItems} projectName={project?.name ?? ''} />,
                hotkeys: <KeybindsPanel />,
              }}
            />
          )}
        </div>

        {inspectorOpen && (
          <Inspector tab={inspectorTab} onTab={setInspectorTab} footer={inspectorTab === 'props' ? inspectorFooter : null}>
            {inspectorTab === 'props' && renderProps()}
            {inspectorTab === 'bases' && (
              <PanelSlot>
                <BasesPanel
                  items={placedItems}
                  site={project?.site}
                  map={activeMapData}
                  hint={is3DMode ? t.shell.aimHint : t.bases.hint2d}
                  onShow={is3DMode ? undefined : showBase}
                  onMove={is3DMode ? b => {
                    startMove(b.items);
                    lockPointer();
                  } : undefined}
                  onTeleport={is3DMode && project?.site ? teleportBase : undefined}
                  onOrbit={is3DMode ? orbitBase : undefined}
                  onDelete={deleteBase}
                />
              </PanelSlot>
            )}
            {inspectorTab === 'materials' && (
              <PanelSlot>
                <MaterialsPanel items={placedItems} projectName={project?.name ?? ''} />
              </PanelSlot>
            )}
          </Inspector>
        )}
      </div>

      <Dock
        view={dockView}
        onView={setDockView}
        collapsed={dockCollapsed}
        onCollapse={setDockCollapsed}
        action={!is3DMode ? (
          <button className={sh.textBtn} onClick={addFloor}>
            <Plus size={14} weight="bold" />
            {t.shell.addFloor}
          </button>
        ) : undefined}
        center={is3DMode ? (
          activeDef && <span className={sh.transportNow}>{itemFullLabel(activeDef, t)}</span>
        ) : (
          <Transport
            label={floorName(currentFloor)}
            meta={t.projects.elements(floorCount)}
            onFirst={() => setCurrentFloor(floorsList[0])}
            onPrev={() => setCurrentFloor(f => [...floorsList].reverse().find(l => l < f) ?? f)}
            onNext={() => setCurrentFloor(f => floorsList.find(l => l > f) ?? f)}
            onLast={() => setCurrentFloor(floorsList[floorsList.length - 1])}
          />
        )}
        right={!is3DMode ? (
          <div className={sh.zoomCtl}>
            <button className={sh.iconBtn} onClick={() => zoomTo(scale / 1.2)} title={t.editor.zoomOut} aria-label={t.editor.zoomOut}>
              <MagnifyingGlassMinus size={15} weight="bold" />
            </button>
            <input
              type="range"
              min={20}
              max={400}
              step={5}
              value={Math.round(scale * 100)}
              onChange={e => zoomTo(Number(e.target.value) / 100)}
              aria-label={t.shell.zoomReset}
            />
            <button className={sh.iconBtn} onClick={() => zoomTo(scale * 1.2)} title={t.editor.zoomIn} aria-label={t.editor.zoomIn}>
              <MagnifyingGlassPlus size={15} weight="bold" />
            </button>
            <output>{Math.round(scale * 100)}%</output>
            <button className={sh.iconBtn} onClick={fitView} title={t.shell.fit} aria-label={t.shell.fit}>
              <FrameCorners size={15} weight="bold" />
            </button>
          </div>
        ) : undefined}
        layersTitle={is3DMode ? t.shell.tabs.bases : t.shell.floors}
        layersTool={!is3DMode ? <LayersAdd label={t.shell.addFloor} onClick={addFloor} /> : undefined}
        layers={layers}
        hotbar={hotbar}
        selected={heldSlot}
        activeItem={activeItem}
        demolishOn={isRemoverActive}
        onSlot={selectSlot}
        onClearSlot={i => setHotbar(hotbar.map((v, k) => (k === i ? null : v)))}
        onDemolish={() => selectItem(REMOVER.id)}
        onAll={openBlocks}
        onPick={takeItem}
      />

      {((!is3DMode && needsMap) || chooserOpen) && (
        <MapChooser
          current={project?.site?.map}
          onPick={site => {
            setSite(site);
            setChooserOpen(false);
          }}
          onClose={needsMap ? undefined : () => setChooserOpen(false)}
        />
      )}

      {dialog === 'help' && (
        <Dialog title={t.shell.howToPlay} icon={<GameController size={18} weight="duotone" />} onClose={() => setDialog(null)}>
          <QuickStart />
        </Dialog>
      )}
      {dialog === 'keys' && (
        <Dialog title={t.shell.keys} icon={<Keyboard size={18} weight="duotone" />} onClose={() => setDialog(null)}>
          <KeybindsPanel />
        </Dialog>
      )}
      {dialog === 'settings3d' && (
        <Dialog title={t.shell.settings3d} icon={<SlidersHorizontal size={18} weight="duotone" />} onClose={() => setDialog(null)}>
          <Settings3DPanel />
        </Dialog>
      )}
      {dialog === 'commands' && (
        <Dialog title={t.shell.commands} icon={<Terminal size={18} weight="duotone" />} onClose={() => setDialog(null)}>
          <p className={sh.lead}>{t.hud.commandsHint(keyName(binds.chat))}</p>
          <ul className={sh.commandList}>
            {COMMAND_IDS.map(c => (
              <li key={c}>
                <code>{COMMAND_USAGE[c]}</code>
                <span>{t.commands.desc[c]}</span>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </div>
  );
}
