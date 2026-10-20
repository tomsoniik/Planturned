/*
  Klawisze do zmiany przez użytkownika. Zapisywane jako KeyboardEvent.code (fizyczne miejsce klawisza),
  więc działają tak samo na układzie polskim, niemieckim czy AZERTY.
  Stałe (nie do zmiany): Esc (przeglądarka oddaje nim kursor w 3D, potem menu), / (czat z komendą),
  Ctrl+C/V/Z/Y i przyciski myszy.
*/
import { create } from 'zustand';

export const KEYBIND_ACTIONS = [
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9',
  'demolish', 'bed', 'rotate', 'deleteSelected',
  'floorUp', 'floorDown',
  'forward', 'back', 'left', 'right', 'up', 'down', 'sprint', 'crouch', 'prone', 'toggleFly',
  'inventory', 'chat',
] as const;
export type KeybindAction = (typeof KEYBIND_ACTIONS)[number];
export type Keybinds = Record<KeybindAction, string>;

export const DEFAULT_KEYBINDS: Keybinds = {
  slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4', slot5: 'Digit5',
  slot6: 'Digit6', slot7: 'Digit7', slot8: 'Digit8', slot9: 'Digit9',
  demolish: 'KeyX',
  bed: 'KeyB',
  rotate: 'KeyR',
  deleteSelected: 'Delete',
  floorUp: 'PageUp',
  floorDown: 'PageDown',
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  up: 'Space',
  down: 'KeyQ',
  sprint: 'ShiftLeft',
  // w grze kucanie to X, ale tu X to wyburzanie
  crouch: 'KeyC',
  prone: 'KeyZ',
  toggleFly: 'KeyF',
  inventory: 'KeyE',
  chat: 'KeyT',
};

export const SLOT_ACTIONS: KeybindAction[] = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9'];

/** Klawisze, których nie da się przypisać: zarezerwowane przez przeglądarkę lub stałe skróty. */
export const RESERVED_CODES = new Set(['Escape', 'Tab', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ContextMenu', 'CapsLock']);

const STORAGE_KEY = 'planturned:keybinds';

function load(): Keybinds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEYBINDS };
    const saved = JSON.parse(raw) as Partial<Keybinds>;
    const out = { ...DEFAULT_KEYBINDS };
    for (const a of KEYBIND_ACTIONS) if (typeof saved[a] === 'string') out[a] = saved[a]!;
    return out;
  } catch {
    return { ...DEFAULT_KEYBINDS };
  }
}

function save(binds: Keybinds) {
  try {
    // zapisujemy tylko zmienione, żeby nowe domyślne klawisze w przyszłych wersjach działały od razu
    const diff = Object.fromEntries(KEYBIND_ACTIONS.filter((a) => binds[a] !== DEFAULT_KEYBINDS[a]).map((a) => [a, binds[a]]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
  } catch {
    // tryb prywatny / brak miejsca: zmiana działa do zamknięcia karty
  }
}

interface KeybindState {
  binds: Keybinds;
  loaded: boolean;
  /** Wczytanie z localStorage (po zamontowaniu, bo na serwerze go nie ma). */
  hydrate: () => void;
  /** Przypisuje klawisz. Jeśli zajmowała go inna akcja, dostaje ona poprzedni klawisz tej akcji (zamiana). Zwraca zamienioną akcję. */
  assign: (action: KeybindAction, code: string) => KeybindAction | null;
  reset: (action?: KeybindAction) => void;
}

export const useKeybinds = create<KeybindState>((set, get) => ({
  binds: { ...DEFAULT_KEYBINDS },
  loaded: false,
  hydrate: () => {
    if (!get().loaded) set({ binds: load(), loaded: true });
  },
  assign: (action, code) => {
    const binds = { ...get().binds };
    const other = KEYBIND_ACTIONS.find((a) => a !== action && binds[a] === code) ?? null;
    if (other) binds[other] = binds[action];
    binds[action] = code;
    save(binds);
    set({ binds });
    return other;
  },
  reset: (action) => {
    // jedna akcja: domyślny klawisz z tą samą zamianą co przy zwykłym przypisaniu
    if (action) {
      get().assign(action, DEFAULT_KEYBINDS[action]);
      return;
    }
    const binds = { ...DEFAULT_KEYBINDS };
    save(binds);
    set({ binds });
  },
}));

/** Czytelna nazwa klawisza z KeyboardEvent.code (np. KeyR -> R, Digit1 -> 1, ShiftLeft -> Shift). */
export function keyLabel(code: string, names: { space: string; shift: string }): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const map: Record<string, string> = {
    Space: names.space,
    ShiftLeft: names.shift,
    ShiftRight: `${names.shift} R`,
    PageUp: 'PgUp',
    PageDown: 'PgDn',
    Delete: 'Del',
    Backspace: 'Backspace',
    Enter: 'Enter',
    Insert: 'Ins',
    Home: 'Home',
    End: 'End',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  return map[code] ?? code;
}
