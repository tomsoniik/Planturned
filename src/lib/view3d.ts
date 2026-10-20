/*
  Wspólny stan widoku 3D dla strony edytora i sceny (Builder3D jest ładowany dynamicznie, więc nie dzielą modułu).
  Nakładka: ekwipunek, czat albo menu pauzy; gdy jest otwarta, scena nie reaguje na klawisze ani kliknięcia.
*/
import { create } from 'zustand';

export type Overlay = 'none' | 'inventory' | 'chat' | 'menu' | 'map';

interface View3DState {
  overlay: Overlay;
  /** Kiedy nakładka się zmieniła (performance.now): Esc tuż po otwarciu menu nie zamyka go od razu. */
  changedAt: number;
  setOverlay: (o: Overlay) => void;
}

export const useView3D = create<View3DState>((set) => ({
  overlay: 'none',
  changedAt: 0,
  setOverlay: (overlay) => set({ overlay, changedAt: performance.now() }),
}));

// --- Kursor (pointer lock) ---

let container: HTMLElement | null = null;

/** Builder3D zgłasza swój kontener, żeby nakładki mogły oddać i odebrać kursor. */
export function registerContainer(el: HTMLElement | null) {
  container = el;
}

/** Przejęcie kursora po zamknięciu nakładki. Bez gestu użytkownika przeglądarka odmówi: wtedy zostaje klik w scenę. */
export function lockPointer() {
  if (!container || document.pointerLockElement === container) return;
  try {
    const res = container.requestPointerLock() as unknown as Promise<void> | undefined;
    res?.catch?.(() => {});
  } catch {
    // odmowa: podpowiedź "kliknij w scenę" zostaje na ekranie
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

// --- Komendy do sceny (z czatu) ---

export type SceneCommand =
  | { kind: 'tp'; x: number; z: number }
  | { kind: 'fly'; on: boolean }
  /** Kamera na tej wysokości nad terenem (m). */
  | { kind: 'height'; above: number }
  /** Dach startowy skybase'a pod graczem, piętro pod limitem budowania mapy. */
  | { kind: 'skybase'; itemId: string };

/** Pozycja kamery w układzie świata gry (x, wysokość, z) i obrót (yaw sceny, rad) albo null, gdy scena nie działa. */
export type CameraProbe = () => [number, number, number, number] | null;

const listeners = new Set<(c: SceneCommand) => void>();
let probe: CameraProbe = () => null;

export function sendSceneCommand(c: SceneCommand) {
  listeners.forEach((fn) => fn(c));
  return listeners.size > 0;
}

export function onSceneCommand(fn: (c: SceneCommand) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function registerCameraProbe(fn: CameraProbe | null) {
  probe = fn ?? (() => null);
}

export function cameraPosition() {
  return probe();
}
