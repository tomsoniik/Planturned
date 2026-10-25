/*
  Wczytywanie tekstur z gry z zabezpieczeniem: gdy pliku nie ma albo sieć zawiedzie, materiał dostaje
  kolor zastępczy zbliżony do oryginału zamiast czarnej albo białej plamy. Z ?debug w adresie
  jeden wpis w konsoli na plik (bez powtórek co klatkę).
*/
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const reported = new Set<string>();

function report(url: string) {
  if (reported.has(url) || typeof window === 'undefined' || !window.location.search.includes('debug')) return;
  reported.add(url);
  console.warn(`[untmatica] brak tekstury: ${url}`);
}

/**
 * Jak TextureLoader.load, ale przy błędzie woła onLoad z teksturą w kolorze `fallback`.
 * Zwraca od razu obiekt tekstury (jak three.js): po błędzie dostaje on obraz koloru zastępczego.
 */
export function loadTexture(url: string, fallback: string, onLoad?: (tex: THREE.Texture) => void) {
  const tex = loader.load(url, onLoad, undefined, () => {
    report(url);
    // obraz 1x1 w kolorze zastępczym w miejsce nieudanego pliku
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, 1, 1);
    }
    tex.image = canvas as unknown as HTMLImageElement;
    tex.needsUpdate = true;
    onLoad?.(tex);
  });
  return tex;
}
