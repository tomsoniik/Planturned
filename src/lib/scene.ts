export type TimeOfDay = 'day' | 'dusk' | 'night';
export type BaseMode = 'ground' | 'sky';

/** Ustawienia sceny 3D zapisywane w projekcie. */
export interface SceneSettings {
  time: TimeOfDay;
  mode: BaseMode;
  /** Wysokość platformy skybase nad terenem, w metrach. */
  skyHeight: number;
}

export const DEFAULT_SCENE: SceneSettings = { time: 'day', mode: 'ground', skyHeight: 40 };

export const TIME_LABELS: Record<TimeOfDay, string> = { day: 'Dzień', dusk: 'Zmierzch', night: 'Noc' };
export const MODE_LABELS: Record<BaseMode, string> = { ground: 'Na ziemi', sky: 'Skybase' };
export const SKY_HEIGHTS = [20, 40, 80, 150, 300, 500];
