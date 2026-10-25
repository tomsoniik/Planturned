/*
  Dźwięki z gry: każdy przedmiot gra klip ze swojego AudioSource w prefabie (jak InteractableDoor w grze),
  z jego głośnością, tonem i zasięgiem. Dane: public/game/sounds.json + public/game/sounds/<klip>.wav
  (npm run export:game -- --sounds). Bez eksportu dźwięków po prostu nie ma.
  Web Audio: dźwięk przestrzenny (słuchacz = kamera), plik dekodowany raz i trzymany w pamięci.
*/
import { create } from 'zustand';
import { useSettings3D } from './settings3d';

export interface ItemSound {
  clip?: string;
  volume?: number;
  pitch?: number;
  /** Zasięg w metrach: do `min` pełna głośność, za `max` cisza. */
  min?: number;
  max?: number;
  /** Unity AudioRolloffMode: 0 logarytmiczny, 1 liniowy. */
  rolloff?: number;
  /** Długość animacji otwierania i zamykania (s). */
  open?: number;
  close?: number;
}

/** Długość animacji Open/Close drzwi w grze, gdy eksport jej nie podał. */
export const DEFAULT_SWING = 0.633;

export const useSoundTable = create<{ table: Record<string, ItemSound> }>(() => ({ table: {} }));

let tableLoading: Promise<void> | null = null;
export function loadSoundTable() {
  tableLoading ??= fetch('/game/sounds.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, ItemSound>>) : {}))
    .then((table) => useSoundTable.setState({ table }))
    .catch(() => undefined);
  return tableLoading;
}

export const itemSound = (gameId: number | undefined) => (gameId === undefined ? undefined : useSoundTable.getState().table[gameId]);

// --- Web Audio ---

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
/** Ostatni dźwięk danego elementu: nowy go przerywa, jak AudioSource.Play() w grze. */
const playing = new Map<string, AudioBufferSourceNode>();

/** Głośność główna z ustawień; wyciszenie także, gdy karta jest w tle. */
function applyVolume() {
  if (!master || !ctx) return;
  const s = useSettings3D.getState();
  const hidden = typeof document !== 'undefined' && document.hidden;
  master.gain.setTargetAtTime(s.muted || hidden ? 0 : s.volume, ctx.currentTime, 0.05);
}

function context() {
  if (!ctx && typeof window !== 'undefined' && 'AudioContext' in window) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
    useSettings3D.subscribe(applyVolume);
    document.addEventListener('visibilitychange', applyVolume);
  }
  return ctx;
}

/** Przeglądarka startuje dźwięk dopiero po geście: wołać przy pierwszym kliknięciu w scenę. */
export function resumeAudio() {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

function load(clip: string) {
  let p = buffers.get(clip);
  if (!p) {
    const c = context();
    p = c
      ? fetch(`/game/sounds/${clip}.wav`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
          .then((data) => c.decodeAudioData(data))
          .catch(() => null)
      : Promise.resolve(null);
    buffers.set(clip, p);
  }
  return p;
}

/** Wczytuje klipy przedmiotów zawczasu, żeby pierwsze otwarcie nie czekało na sieć. */
export function preloadItemSounds(gameIds: Iterable<number>) {
  const table = useSoundTable.getState().table;
  for (const id of gameIds) {
    const clip = table[id]?.clip;
    if (clip) void load(clip);
  }
}

/** Słuchacz w miejscu kamery (wołane co klatkę). */
export function setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number) {
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    const t = ctx.currentTime;
    l.positionX.setValueAtTime(px, t);
    l.positionY.setValueAtTime(py, t);
    l.positionZ.setValueAtTime(pz, t);
    l.forwardX.setValueAtTime(fx, t);
    l.forwardY.setValueAtTime(fy, t);
    l.forwardZ.setValueAtTime(fz, t);
  } else {
    l.setPosition(px, py, pz);
    l.setOrientation(fx, fy, fz, 0, 1, 0);
  }
}

/**
 * Dźwięk przedmiotu z gry w punkcie sceny. `key` to id elementu: szybkie powtórki z tego samego źródła
 * przerywają poprzedni dźwięk zamiast grać kilka naraz. Przedmiot bez AudioSource w grze jest cichy.
 */
export function playItemSound(gameId: number | undefined, key: string, x: number, y: number, z: number) {
  const s = itemSound(gameId);
  const c = context();
  if (!s?.clip || !c || !master) return;
  if (c.state === 'suspended') void c.resume();
  void load(s.clip).then((buffer) => {
    if (!buffer || !master) return;
    playing.get(key)?.stop();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = s.pitch ?? 1;
    const gain = c.createGain();
    gain.gain.value = s.volume ?? 1;
    const panner = c.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = s.rolloff === 1 ? 'linear' : 'inverse';
    panner.refDistance = s.min ?? 1;
    panner.maxDistance = s.max ?? 500;
    panner.rolloffFactor = 1;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else {
      panner.setPosition(x, y, z);
    }
    src.connect(gain).connect(panner).connect(master);
    src.onended = () => {
      if (playing.get(key) === src) playing.delete(key);
    };
    playing.set(key, src);
    src.start();
  });
}
