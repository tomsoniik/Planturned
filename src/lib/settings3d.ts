/*
  Ustawienia Sandboxa 3D zapisywane u użytkownika (jak klawisze): czułość myszy, pole widzenia,
  odwrócenie osi Y, głośność i wyciszenie dźwięków.
*/
import { create } from 'zustand';

export interface Settings3D {
  /** Mnożnik czułości myszy (1 = jak dotąd). */
  sensitivity: number;
  /** Pole widzenia w stopniach (pionowe, jak w three.js). */
  fov: number;
  invertY: boolean;
  /** Głośność 0..1. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS_3D: Settings3D = { sensitivity: 1, fov: 72, invertY: false, volume: 0.8, muted: false };
export const SENSITIVITY_RANGE = [0.2, 3] as const;
export const FOV_RANGE = [60, 100] as const;

const STORAGE_KEY = 'untmatica:settings3d';

function load(): Settings3D {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS_3D };
    const saved = JSON.parse(raw) as Partial<Settings3D>;
    const out = { ...DEFAULT_SETTINGS_3D };
    for (const k of Object.keys(DEFAULT_SETTINGS_3D) as (keyof Settings3D)[]) {
      if (typeof saved[k] === typeof DEFAULT_SETTINGS_3D[k]) (out as Record<string, unknown>)[k] = saved[k];
    }
    return out;
  } catch {
    return { ...DEFAULT_SETTINGS_3D };
  }
}

function save(s: Settings3D) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // tryb prywatny / brak miejsca: ustawienie działa do zamknięcia karty
  }
}

interface SettingsState extends Settings3D {
  loaded: boolean;
  /** Wczytanie z localStorage (po zamontowaniu, bo na serwerze go nie ma). */
  hydrate: () => void;
  set: (patch: Partial<Settings3D>) => void;
  reset: () => void;
}

const pick = (s: SettingsState): Settings3D => ({ sensitivity: s.sensitivity, fov: s.fov, invertY: s.invertY, volume: s.volume, muted: s.muted });

export const useSettings3D = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS_3D,
  loaded: false,
  hydrate: () => {
    if (!get().loaded) set({ ...load(), loaded: true });
  },
  set: (patch) => {
    set(patch);
    save(pick(get()));
  },
  reset: () => {
    set({ ...DEFAULT_SETTINGS_3D });
    save(DEFAULT_SETTINGS_3D);
  },
}));
