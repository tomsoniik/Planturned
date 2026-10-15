/*
  Tłumaczenia PL / EN. Słownik EN ma typ słownika PL, więc brakujący klucz nie przejdzie kompilacji.
  Język: cookie "lang" (ustawia przełącznik), a bez niego język przeglądarki (Accept-Language).
*/
import type { BuildItem, MaterialId, PartId } from './builder';
import type { BaseMode, TimeOfDay } from './scene';

export const LANGS = ['pl', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'pl';
export const LANG_COOKIE = 'lang';

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** "pl-PL,pl;q=0.9,en;q=0.8" -> pierwszy obsługiwany język, inaczej angielski. */
export function langFromAcceptLanguage(header: string | null): Lang {
  if (!header) return DEFAULT_LANG;
  for (const part of header.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return 'en';
}

export type AimReason = 'mapLimit' | 'noBuildZone' | 'skyFloor' | 'floorGroundOnly';
export type AimWarn = 'oxygen';
export type SidebarTabId = 'blocks' | 'map' | 'color' | 'hotkeys';
export type PartGroupId = 'slabs' | 'walls' | 'pillars' | 'stairs';

const pl = {
  meta: {
    title: 'Planturned - planer baz do Unturned',
    description: 'Zaprojektuj bazę do Unturned w 2D i obejrzyj ją w 3D. Działa w przeglądarce, bez konta.',
  },
  common: {
    newProject: 'Nowy projekt',
    myProjects: 'Moje projekty',
    home: 'Strona główna',
    language: 'Język',
    projectName: (n: number) => `Baza ${n}`,
  },
  home: {
    title: 'Zaplanuj bazę, zanim ją postawisz.',
    sub: 'Planer baz do Unturned. Rysujesz w 2D, potem chodzisz po bazie w 3D na prawdziwej mapie z gry.',
    previewCaption: 'Przykładowa baza 4x3. Przeciągnij, żeby obrócić.',
    footer: 'Projekt fanowski. Unturned należy do Smartly Dressed Games. Tło: Washington Landscape (Phobia), ekran ładowania z gry.',
  },
  projects: {
    note: 'Zapisane w tej przeglądarce. Eksportuj plik, jeśli chcesz mieć kopię.',
    loadFile: 'Wczytaj plik',
    loaded: (name: string) => `Wczytano "${name}"`,
    badFile: 'Ten plik nie wygląda na projekt bazy',
    confirmDelete: (name: string) => `Usunąć "${name}"? Tego nie da się cofnąć.`,
    emptyTitle: 'Nie masz jeszcze projektów',
    emptyText: 'Utwórz pierwszy albo wczytaj plik .baseplan.json od kogoś z ekipy.',
    emptyPlan: 'Pusty plan',
    exportTitle: 'Eksportuj do pliku',
    deleteTitle: 'Usuń projekt',
    elements: (n: number) => {
      if (n === 1) return '1 element';
      const d = n % 10, dd = n % 100;
      return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? `${n} elementy` : `${n} elementów`;
    },
  },
  editor: {
    loading3d: 'Ładowanie widoku 3D',
    loading: 'Wczytywanie',
    notFoundTitle: 'Nie ma takiego projektu',
    notFoundText: 'Projekty są zapisywane w przeglądarce, w której je utworzono. Ten link nie pasuje do żadnego z nich.',
    back: 'Wróć do projektów',
    showToolbox: 'Pokaż przybornik',
    hideToolbox: 'Schowaj przybornik',
    projectName: 'Nazwa projektu',
    rename: 'Zmień nazwę',
    saved: 'Zapisano',
    autosave: 'Zapis automatyczny',
    timeOfDay: 'Pora dnia',
    baseType: 'Rodzaj bazy',
    skyHeight: 'Wysokość skybase',
    skyHeightTitle: (max: number) => `Wysokość nad terenem (max ${max} m przez limit mapy 1024 m)`,
    floor: 'Piętro',
    view: 'Widok',
    groundFloor: 'Parter',
    floorLabel: (lvl: number) => (lvl === 0 ? 'Parter' : `Piętro ${lvl}`),
    undo: 'Cofnij (Ctrl Z)',
    redo: 'Ponów (Ctrl Y)',
    bedAreas: 'Zasięg claimu łóżek',
    export: 'Eksportuj do pliku',
    clear: 'Wyczyść projekt',
    confirmClear: 'Wyczyścić cały projekt? Możesz to cofnąć przez Ctrl Z.',
    pasteSame: 'Te elementy już tu stoją',
    pasteOverlap: 'Kopia nachodzi na istniejące elementy',
    tabs: { blocks: 'Klocki', map: 'Teren', color: 'Kolor', hotkeys: 'Skróty' } satisfies Record<SidebarTabId, string>,
    groups: {
      slabs: 'Podłogi i dachy',
      walls: 'Ściany',
      pillars: 'Filary',
      stairs: 'Schody i rampy',
    } satisfies Record<PartGroupId, string>,
    results: 'Wyniki',
    material: 'Materiał',
    search: 'Szukaj elementu',
    clearSearch: 'Wyczyść wyszukiwanie',
    noMatch: (q: string) => `Nic nie pasuje do "${q}".`,
    brickNoHatch: 'Cegła nie ma klapy w grze, do otworów użyj klapy z innego materiału.',
    colorHint: 'Wybierz kolor, potem kliknij element (albo zaznaczenie), żeby go pomalować. Nowe elementy też dostaną ten kolor.',
    colorOff: 'Wyłącz',
    colorDefault: 'Domyślny',
    colorDefaultTitle: 'Przywróć kolor materiału',
    colorCustom: 'Własny kolor',
    colorAria: (c: string) => `Kolor ${c}`,
    rotate: 'obrót',
    emptyHint: ['Pusty plan. Wciśnij', '(podłoga) i kliknij w siatkę.'] as [string, string],
    zoomOut: 'Oddal',
    zoomIn: 'Przybliż',
    hatchHint: 'Klapę stawia się w dachu z otworem',
    floorHint: 'Podłogi tylko na parterze, wyżej stawiaj dachy',
    demolishHint: 'Wyburzanie: kliknij element',
    placingHint: (name: string) => `${name}, R obraca`,
    pasteHint: (n: number) => `Wklejanie ${n} el.: R obraca, klik wstawia (Shift: kolejna kopia), Esc anuluje`,
    hotkeys: [
      [['1', '9'], 'element z przybornika'],
      [['X'], 'wyburzanie'],
      [['B'], 'łóżko'],
      [['R'], 'obrót, inna krawędź'],
      [['PgUp', 'PgDn'], '2D: piętro wyżej, niżej'],
      [['Klik'], '3D: przejmij kamerę, Esc oddaje kursor'],
      [['W', 'A', 'S', 'D'], '3D: ruch, Shift szybciej'],
      [['Spacja', 'Q'], '3D: w górę, w dół (chodząc: skok)'],
      [['F'], '3D: latanie albo chodzenie'],
      [['Esc'], 'odłóż element, odznacz'],
      [['LPM'], 'stawianie, zaznaczanie, przeciąganie'],
      [['PPM'], 'przesuwanie widoku 2D'],
      [['Kółko'], 'przybliżenie 2D'],
      [['Shift', 'Klik'], 'zaznacz kilka'],
      [['Delete'], 'usuń zaznaczone'],
      [['Ctrl', 'C'], 'kopiuj zaznaczone'],
      [['Ctrl', 'V'], 'wklej: podgląd pod kursorem, R obraca, klik wstawia'],
      [['Ctrl', 'Z'], 'cofnij'],
      [['Ctrl', 'Y'], 'ponów'],
    ] as [string[], string][],
  },
  view3d: {
    lockFailed: 'Przeglądarka nie oddała kursora: obracaj kamerę prawym przyciskiem, stawiaj lewym',
    lockHint: 'Kliknij w scenę, żeby sterować kamerą',
    walking: 'Chodzenie',
    flying: 'Latanie',
    fits: 'Pasuje',
    collides: 'Koliduje',
    aimAtGrid: 'Wyceluj w siatkę',
    ground: 'ziemia',
    level: (n: number) => `poziom ${n}`,
    reasons: {
      mapLimit: 'ponad limit wysokości mapy',
      noBuildZone: 'strefa zakazu budowy',
      skyFloor: 'w skybase podłogę zastępuje dach',
      floorGroundOnly: 'podłoga tylko na ziemi',
    } satisfies Record<AimReason, string>,
    warns: { oxygen: 'powyżej granicy tlenu' } satisfies Record<AimWarn, string>,
  },
  map: {
    loadingList: 'Wczytywanie listy map',
    noMaps: 'Brak map z gry. Wyeksportuj je z lokalnej instalacji Unturned:',
    noMapsHint: 'Potrzebny Python z pakietami UnityPy, numpy i pillow. Skrypt czyta pliki gry i zapisuje je w public/maps.',
    pickHint: 'Kliknij na mapie miejsce bazy. Teren i satelita pochodzą z plików gry.',
    toTerrain: 'Na teren',
    noMap: 'Bez mapy',
    mapGroup: 'Mapa',
    pickAria: 'Wybierz miejsce bazy',
    mapAlt: (name: string) => `Mapa ${name}`,
    east: 'X (wschód)',
    north: 'Z (północ)',
    elevation: 'Wysokość parteru (m)',
    terrainHere: (h: string) => `Teren w tym miejscu: ${h} m`,
    water: (h: string) => `, poziom wody: ${h} m`,
    underlay: 'Satelita pod planem 2D',
  },
  time: { day: 'Dzień', dusk: 'Zmierzch', night: 'Noc' } satisfies Record<TimeOfDay, string>,
  mode: { ground: 'Na ziemi', sky: 'Skybase' } satisfies Record<BaseMode, string>,
  materials: { maple: 'Klon', birch: 'Brzoza', pine: 'Sosna', metal: 'Metal', brick: 'Cegła' } satisfies Record<MaterialId, string>,
  parts: {
    floor: 'Podłoga',
    wall: 'Ściana',
    pillar: 'Filar',
    roof: 'Dach',
    doorway: 'Ściana z drzwiami',
    window: 'Ściana z oknem',
    garage: 'Ściana garażowa',
    rampart: 'Murek',
    post: 'Słupek',
    tri_floor: 'Podłoga trójkątna',
    tri_roof: 'Dach trójkątny',
    hole: 'Dach z otworem',
    tri_hole: 'Dach trójkątny z otworem',
    hatch: 'Klapa',
    stairs: 'Schody',
    ramp: 'Rampa',
    ramp_wall: 'Ściana rampy',
  } satisfies Record<PartId, string>,
  tools: { remover: 'Wyburzanie', bed: 'Łóżko' },
};

export type Dict = typeof pl;

const en: Dict = {
  meta: {
    title: 'Planturned - Unturned base planner',
    description: 'Design your Unturned base in 2D and walk through it in 3D. Runs in the browser, no account needed.',
  },
  common: {
    newProject: 'New project',
    myProjects: 'My projects',
    home: 'Home',
    language: 'Language',
    projectName: (n: number) => `Base ${n}`,
  },
  home: {
    title: 'Plan your base before you build it.',
    sub: 'A base planner for Unturned. Draw it in 2D, then walk through it in 3D on a real map from the game.',
    previewCaption: 'Sample 4x3 base. Drag to rotate.',
    footer: 'Fan project. Unturned belongs to Smartly Dressed Games. Background: Washington Landscape (Phobia), an in-game loading screen.',
  },
  projects: {
    note: 'Saved in this browser. Export a file if you want a copy.',
    loadFile: 'Load file',
    loaded: (name: string) => `Loaded "${name}"`,
    badFile: "This file doesn't look like a base project",
    confirmDelete: (name: string) => `Delete "${name}"? This can't be undone.`,
    emptyTitle: 'No projects yet',
    emptyText: 'Create your first one or load a .baseplan.json file from your crew.',
    emptyPlan: 'Empty plan',
    exportTitle: 'Export to file',
    deleteTitle: 'Delete project',
    elements: (n: number) => (n === 1 ? '1 piece' : `${n} pieces`),
  },
  editor: {
    loading3d: 'Loading 3D view',
    loading: 'Loading',
    notFoundTitle: 'Project not found',
    notFoundText: "Projects are saved in the browser where they were created. This link doesn't match any of them.",
    back: 'Back to projects',
    showToolbox: 'Show toolbox',
    hideToolbox: 'Hide toolbox',
    projectName: 'Project name',
    rename: 'Rename',
    saved: 'Saved',
    autosave: 'Autosave',
    timeOfDay: 'Time of day',
    baseType: 'Base type',
    skyHeight: 'Skybase height',
    skyHeightTitle: (max: number) => `Height above terrain (max ${max} m due to the 1024 m map limit)`,
    floor: 'Floor',
    view: 'View',
    groundFloor: 'Ground',
    floorLabel: (lvl: number) => (lvl === 0 ? 'Ground floor' : `Floor ${lvl}`),
    undo: 'Undo (Ctrl Z)',
    redo: 'Redo (Ctrl Y)',
    bedAreas: 'Bed claim radius',
    export: 'Export to file',
    clear: 'Clear project',
    confirmClear: 'Clear the whole project? You can undo it with Ctrl Z.',
    pasteSame: 'These pieces are already here',
    pasteOverlap: 'The copy overlaps existing pieces',
    tabs: { blocks: 'Pieces', map: 'Terrain', color: 'Color', hotkeys: 'Keys' },
    groups: { slabs: 'Floors and roofs', walls: 'Walls', pillars: 'Pillars', stairs: 'Stairs and ramps' },
    results: 'Results',
    material: 'Material',
    search: 'Search pieces',
    clearSearch: 'Clear search',
    noMatch: (q: string) => `Nothing matches "${q}".`,
    brickNoHatch: 'Brick has no hatch in the game; use a hatch from another material for openings.',
    colorHint: 'Pick a color, then click a piece (or the selection) to paint it. New pieces get this color too.',
    colorOff: 'Off',
    colorDefault: 'Default',
    colorDefaultTitle: 'Restore material color',
    colorCustom: 'Custom color',
    colorAria: (c: string) => `Color ${c}`,
    rotate: 'rotate',
    emptyHint: ['Empty plan. Press', '(floor) and click the grid.'],
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    hatchHint: 'Hatches go into a roof with a hole',
    floorHint: 'Floors only on the ground floor; use roofs higher up',
    demolishHint: 'Demolish: click a piece',
    placingHint: (name: string) => `${name}, R rotates`,
    pasteHint: (n: number) => `Pasting ${n} pcs: R rotates, click places (Shift: another copy), Esc cancels`,
    hotkeys: [
      [['1', '9'], 'piece from the toolbox'],
      [['X'], 'demolish'],
      [['B'], 'bed'],
      [['R'], 'rotate, other edge'],
      [['PgUp', 'PgDn'], '2D: floor up, down'],
      [['Click'], '3D: grab the camera, Esc releases the cursor'],
      [['W', 'A', 'S', 'D'], '3D: move, Shift for faster'],
      [['Space', 'Q'], '3D: up, down (walking: jump)'],
      [['F'], '3D: fly or walk'],
      [['Esc'], 'drop the piece, deselect'],
      [['LMB'], 'place, select, drag'],
      [['RMB'], 'pan the 2D view'],
      [['Wheel'], '2D zoom'],
      [['Shift', 'Click'], 'select several'],
      [['Delete'], 'delete selected'],
      [['Ctrl', 'C'], 'copy selected'],
      [['Ctrl', 'V'], 'paste: preview under the cursor, R rotates, click places'],
      [['Ctrl', 'Z'], 'undo'],
      [['Ctrl', 'Y'], 'redo'],
    ],
  },
  view3d: {
    lockFailed: "The browser didn't release the cursor: rotate the camera with the right button, place with the left",
    lockHint: 'Click the scene to control the camera',
    walking: 'Walking',
    flying: 'Flying',
    fits: 'Fits',
    collides: 'Collides',
    aimAtGrid: 'Aim at the grid',
    ground: 'ground',
    level: (n: number) => `level ${n}`,
    reasons: {
      mapLimit: 'above the map height limit',
      noBuildZone: 'no-build zone',
      skyFloor: 'on a skybase a roof replaces the floor',
      floorGroundOnly: 'floors only on the ground',
    },
    warns: { oxygen: 'above the oxygen limit' },
  },
  map: {
    loadingList: 'Loading map list',
    noMaps: 'No game maps. Export them from your local Unturned install:',
    noMapsHint: 'Needs Python with UnityPy, numpy and pillow. The script reads the game files and writes them to public/maps.',
    pickHint: 'Click the map to place your base. Terrain and satellite come from the game files.',
    toTerrain: 'Snap to terrain',
    noMap: 'No map',
    mapGroup: 'Map',
    pickAria: 'Pick the base location',
    mapAlt: (name: string) => `${name} map`,
    east: 'X (east)',
    north: 'Z (north)',
    elevation: 'Ground floor height (m)',
    terrainHere: (h: string) => `Terrain here: ${h} m`,
    water: (h: string) => `, water level: ${h} m`,
    underlay: 'Satellite under the 2D plan',
  },
  time: { day: 'Day', dusk: 'Dusk', night: 'Night' },
  mode: { ground: 'On ground', sky: 'Skybase' },
  materials: { maple: 'Maple', birch: 'Birch', pine: 'Pine', metal: 'Metal', brick: 'Brick' },
  parts: {
    floor: 'Floor',
    wall: 'Wall',
    pillar: 'Pillar',
    roof: 'Roof',
    doorway: 'Doorway',
    window: 'Window wall',
    garage: 'Garage wall',
    rampart: 'Rampart',
    post: 'Post',
    tri_floor: 'Triangle floor',
    tri_roof: 'Triangle roof',
    hole: 'Roof with hole',
    tri_hole: 'Triangle roof with hole',
    hatch: 'Hatch',
    stairs: 'Stairs',
    ramp: 'Ramp',
    ramp_wall: 'Ramp wall',
  },
  tools: { remover: 'Demolish', bed: 'Bed' },
};

export const DICTS: Record<Lang, Dict> = { pl, en };

/** Nazwa elementu w danym języku (bez materiału, tak jak w przyborniku). */
export function itemLabel(def: BuildItem, t: Dict): string {
  if (def.shape === 'remover') return t.tools.remover;
  if (def.shape === 'bed') return t.tools.bed;
  return def.part ? t.parts[def.part] : def.name;
}

/** Pełna nazwa z materiałem, np. "Podłoga (klon)". */
export function itemFullLabel(def: BuildItem, t: Dict): string {
  const base = itemLabel(def, t);
  return def.material ? `${base} (${t.materials[def.material].toLowerCase()})` : base;
}
