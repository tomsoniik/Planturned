/*
  Oświetlenie mapy jak w Unturned (LevelLighting.updateLighting): dane z Environment/Lighting.dat
  (scripts/export_game_data.py -> meta.lighting). Pora dnia gry to liczba 0..1: dzień trwa od 0 do `bias`,
  w przejściach (`transition`) kolory mieszają się między świtem, południem, zmierzchem i północą.
*/
import * as THREE from 'three';
import type { TimeOfDay } from './scene';

type Rgb = [number, number, number];

export interface LightingTime {
  colors: {
    sun: Rgb;
    fog: Rgb;
    skySky: Rgb;
    skyEquator: Rgb;
    skyGround: Rgb;
    ambientSky: Rgb;
    ambientEquator: Rgb;
    ambientGround: Rgb;
  };
  intensity: number;
  fog: number;
  shadows: number;
}

export interface MapLighting {
  azimuth: number;
  bias: number;
  fade: number;
  /** Świt, południe, zmierzch, północ (ELightingTime). */
  times: LightingTime[];
}

/** Wynik dla sceny three.js: kolory liniowe, kierunek światła słońca w układzie sceny. */
export interface ResolvedLighting {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  shadows: number;
  ambientSky: THREE.Color;
  ambientEquator: THREE.Color;
  ambientGround: THREE.Color;
  skySky: THREE.Color;
  skyEquator: THREE.Color;
  skyGround: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
}

const color = (c: Rgb) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

/**
 * Pora dnia plannera -> czas gry: dzień to słońce ok. 54° nad horyzontem (czyste południe),
 * zmierzch to słońce nisko w przejściu do zmierzchu, noc to środek nocy.
 */
function gameTime(l: MapLighting, time: TimeOfDay) {
  const transition = l.bias < 1 - l.bias ? (l.bias / 2) * l.fade : ((1 - l.bias) / 2) * l.fade;
  if (time === 'day') return { t: l.bias * 0.3, transition };
  if (time === 'dusk') return { t: l.bias - transition * 0.3, transition };
  return { t: l.bias + (1 - l.bias) / 2, transition };
}

/** Odtworzenie LevelLighting.updateLighting dla jednej chwili (bez pogody i lokalnych stref). */
export function resolveLighting(l: MapLighting, time: TimeOfDay): ResolvedLighting {
  const { t, transition } = gameTime(l, time);
  const { bias } = l;
  let pitch: number;
  let from = -1, to = 1, k = 0;
  if (t < bias) {
    pitch = (t / bias) * 180;
    if (t < transition) [from, to, k] = [0, 1, t / transition];
    else if (t < bias - transition) [from, to] = [-1, 1];
    else [from, to, k] = [1, 2, (t - bias + transition) / transition];
  } else {
    pitch = 180 + ((t - bias) / (1 - bias)) * 180;
    if (t < bias + transition) [from, to, k] = [2, 3, (t - bias) / transition];
    else if (t < 1 - transition) [from, to] = [-1, 3];
    else [from, to, k] = [3, 0, (t - 1 + transition) / transition];
  }
  const b = l.times[to];
  const a = from < 0 ? b : l.times[from];
  const mix = (key: keyof LightingTime['colors']) => color(a.colors[key]).lerp(color(b.colors[key]), from < 0 ? 0 : k);
  const num = (key: 'intensity' | 'fog' | 'shadows') => (from < 0 ? b[key] : a[key] + (b[key] - a[key]) * k);

  // sun.rotation = Quaternion.Euler(pitch, azimuth, 0): kierunek świecenia (forward) w Unity, potem odbicie osi Z
  const p = THREE.MathUtils.degToRad(pitch), y = THREE.MathUtils.degToRad(l.azimuth);
  const sunDir = new THREE.Vector3(Math.cos(p) * Math.sin(y), -Math.sin(p), -Math.cos(p) * Math.cos(y)).normalize();
  const fog = num('fog');
  return {
    sunDir,
    sunColor: mix('sun'),
    sunIntensity: num('intensity'),
    shadows: num('shadows'),
    ambientSky: mix('ambientSky'),
    ambientEquator: mix('ambientEquator'),
    ambientGround: mix('ambientGround'),
    skySky: mix('skySky'),
    skyEquator: mix('skyEquator'),
    skyGround: mix('skyGround'),
    fogColor: mix('fog'),
    // RenderSettings.fogDensity = intensywność^3 * 0.025 (mgła wykładnicza kwadratowa)
    fogDensity: fog ** 3 * 0.025,
  };
}
