/*
  Surowce z przepisów (okno Materiały): klucz to ID przedmiotu z gry, tak jak w BuildItem.costs.
  Nazwy angielskie z eksportu gry (public/game/resources.json, npm run export:game -- --recipes),
  polskie z tej listy albo z katalogu rekwizytów (gdy składnikiem jest inny rekwizyt, np. śpiwór).
*/
import { create } from 'zustand';
import { iconUrl } from './builder';
import type { Lang } from './i18n';
import { propEntry } from './propCatalog';

const PL: Record<number, string> = {
  28: 'Przenośny kanister', 37: 'Kłoda brzozowa', 38: 'Patyk brzozowy', 39: 'Kłoda klonowa', 40: 'Patyk klonowy',
  41: 'Kłoda sosnowa', 42: 'Patyk sosnowy', 61: 'Deska klonowa', 62: 'Deska brzozowa', 63: 'Deska sosnowa',
  64: 'Lina', 65: 'Drut', 66: 'Materiał', 67: 'Złom', 68: 'Blacha', 69: 'Taśma', 70: 'Klej', 71: 'Gwoździe',
  72: 'Puszka', 73: 'Surowe materiały wybuchowe', 74: 'Cegły', 75: 'Chemikalia', 115: 'Surowe ameberry',
  235: 'Bluza ghillie', 1354: 'Bluza ghillie', 1492: 'Bluza ghillie',
  255: 'Niebieska flara', 256: 'Zielona flara', 257: 'Pomarańczowa flara', 258: 'Fioletowa flara', 259: 'Czerwona flara', 260: 'Żółta flara',
  269: 'Szczepionka', 270: 'Surowe jazzberry', 271: 'Surowe rainberry', 272: 'Surowe viriberry', 273: 'Surowe gloomberry',
  274: 'Surowe mayberry', 275: 'Surowe crimberry', 285: 'Sztaba metalu', 329: 'Marchew', 332: 'Nawóz', 335: 'Kukurydza',
  338: 'Sałata', 340: 'Pomidor', 342: 'Ziemniak', 344: 'Pszenica', 571: 'Surowe hanuberry', 1008: 'Dalmierz', 1046: 'Dynia',
  1100: 'Granat przylepny', 1159: 'Syrop klonowy', 1176: 'GPS', 1178: 'Butla do nurkowania', 1240: 'Detonator',
  1242: 'Prowizoryczny granat', 1450: 'Akumulator samochodowy', 1451: 'Opona', 1694: 'Kawałki laski cukrowej',
  1926: 'Glina', 1932: 'Brązowy grzyb', 1934: 'Muchomor', 1940: 'Taro', 1944: 'Ryż', 1948: 'Trzcina cukrowa',
};

interface ResourcesState {
  names: Record<string, string>;
}

export const useResources = create<ResourcesState>(() => ({ names: {} }));

let loading: Promise<void> | null = null;

/** Angielskie nazwy surowców z eksportu gry, wczytywane raz. */
export function loadResources() {
  loading ??= fetch('/game/resources.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
    .then((names) => useResources.setState({ names }))
    .catch(() => undefined);
  return loading;
}

export function resourceName(id: string, lang: Lang, names: Record<string, string>) {
  const n = Number(id);
  if (lang === 'pl') {
    const pl = PL[n] ?? propEntry(n)?.pl;
    if (pl) return pl;
  }
  return names[id] ?? propEntry(n)?.en ?? `#${id}`;
}

export const resourceIcon = (id: string) => iconUrl(Number(id));
