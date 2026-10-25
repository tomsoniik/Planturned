/*
  Ruch postaci w trybie chodzenia, według kodu gry (PlayerMovement.cs, PlayerStance.cs, PlayerLook.cs, PlayerLife.cs).
  Wartości dla gracza bez umiejętności i ubrań, przy domyślnych ustawieniach serwera.
*/

export type Stance = 'stand' | 'sprint' | 'crouch' | 'prone' | 'swim';

/** PlayerMovement: SPEED_* (m/s). */
export const SPEED: Record<Stance, number> = { stand: 4.5, sprint: 7, crouch: 2.5, prone: 1.5, swim: 3 };
/** PlayerMovement.SPEED_CLIMB: wspinanie po drabinie (m/s). */
export const CLIMB_SPEED = 4.5;
/** Drabina łapie, gdy jest do 0,75 m przed postacią (PlayerStance: promień do przodu). */
export const LADDER_REACH = 0.75;
/** Pływanie: prędkość pływania * 1.5. */
export const SWIM_MULTIPLIER = 1.5;

/** PlayerLook: HEIGHT_LOOK_* (wysokość oczu nad stopami, m); zmiana płynna lerp(.., 4 * dt). */
export const EYES: Record<Stance, number> = { stand: 1.75, sprint: 1.75, crouch: 1.2, prone: 0.35, swim: 1.75 };
export const EYES_LERP = 4;

/** Physics.gravity.y * 3 i maksymalna prędkość spadania. */
export const GRAVITY = 9.81 * 3;
export const TERMINAL_VELOCITY = 100;
/** JUMP: prędkość pionowa skoku (szczyt ok. 0.83 m); SWIM: wynurzanie spacją pod wodą. */
export const JUMP_SPEED = 7;
export const SWIM_UP_SPEED = 3;
/** W powietrzu: przyspieszenie 8 * prędkość, wyhamowanie 2 m/s^2 (AirStrafing). */
export const AIR_ACCEL = 8;
export const AIR_DECEL = 2;

/** Max_Walkable_Slope (domyślnie 59°) i zsuwanie 16 m/s^2 po stromym zboczu. */
export const MAX_SLOPE_DEG = 59;
export const SLIDE_ACCEL = 16;

/** PlayerStance.RADIUS i HEIGHT_* (wysokość postaci). */
export const RADIUS = 0.4;
export const HEIGHT: Record<Stance, number> = { stand: 2, sprint: 2, crouch: 1.2, prone: 0.8, swim: 2 };

/** Pływanie zaczyna się, gdy punkt 1.25 m nad stopami jest pod wodą; na powierzchni ciało 1.275 m pod lustrem wody. */
export const SWIM_BODY_DEPTH = 1.25;
export const SWIM_SURFACE_OFFSET = 1.275;

/** PlayerLife.onLanded: obrażenia przy uderzeniu szybszym niż 22 m/s, wartość = min(101, |v|); łamie nogi. */
export const FALL_DAMAGE_SPEED = 22;
export const FALL_DAMAGE_MAX = 101;

/** PlayerInput.RATE: tik symulacji gracza (s). Tlen i duszenie liczone w tikach. */
export const TICK = 0.08;
/** Pułap świata (Level.HEIGHT) używany przy tlenie na wysokości. */
export const LEVEL_HEIGHT = 1024;

export interface Vitals {
  health: number;
  oxygen: number;
  legsBroken: boolean;
}

export interface OxygenState {
  lastBreath: number;
  lastSuffocate: number;
}

/**
 * PlayerLife.SimulateOxygenFrame dla jednego tiku. `breath` to wynik z [-1, 1]:
 * 1 = pełny oddech, < 0 = dusi się (pod wodą -1, na wysokości lerp(1, -1, t)).
 */
export function oxygenTick(tick: number, breath: number, v: Vitals, s: OxygenState) {
  if (breath > 0) {
    if (v.oxygen < 100 && tick - s.lastBreath > 1 + Math.ceil(10 * (1 - breath))) {
      s.lastBreath = tick;
      v.oxygen = Math.min(100, v.oxygen + 1);
    }
  } else if (breath < 0) {
    if (v.oxygen > 0) {
      const period = 1 + Math.ceil((breath + 1) * 10);
      if (tick - s.lastSuffocate > period) {
        s.lastSuffocate = tick;
        v.oxygen = Math.max(0, v.oxygen - 1);
      }
    } else if (tick - s.lastSuffocate > 10) {
      s.lastSuffocate = tick;
      v.health = Math.max(0, v.health - 10);
    }
  }
}

/** Oddech na danej wysokości świata (Use_Legacy_Oxygen_Height). */
export function breathAtHeight(worldY: number, waterLevel: number, legacyOxygen: boolean) {
  if (!legacyOxygen) return 1;
  const t = Math.min(1, Math.max(0, (worldY - waterLevel) / (LEVEL_HEIGHT - waterLevel)));
  return 1 + (-1 - 1) * t;
}
