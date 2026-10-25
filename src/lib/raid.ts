/*
  Kalkulator raidu: ile ładunków trzeba, żeby zniszczyć element (HP z gry / obrażenia ładunku).
  Obrażenia z plików .dat (Structure_Damage, Barricade_Damage), eksport: npm run export:game -- --recipes
  (public/game/explosives.json). Bez eksportu działają wartości z gry wpisane niżej.
*/
import { create } from 'zustand';
import type { BuildItem } from './builder';

export interface Explosive {
  id: number;
  structure: number;
  barricade: number;
}

/** Ładunek precyzyjny, burzący, rakieta (z wyrzutni), granat przylepny, granat odłamkowy: wartości z gry. */
const BUILT_IN: Explosive[] = [
  { id: 1393, structure: 2000, barricade: 2000 },
  { id: 1241, structure: 1000, barricade: 1000 },
  { id: 519, structure: 1000, barricade: 1000 },
  { id: 1100, structure: 100, barricade: 100 },
  { id: 254, structure: 50, barricade: 50 },
];

/*
  Pancerz (Armor_Tier): elementy z "Metal" albo "Brick" w nazwie są w grze High, reszta Low,
  chyba że plik .dat mówi inaczej (np. Armor_Tier Low przy stosie blach). Nie mam pewności, jakie mnożniki
  obrażeń od wybuchu daje domyślny serwer dla obu poziomów, więc zostają tu, w jednym miejscu: 1 = obrażenia z pliku.
  Gdy sprawdzisz w grze, że np. metal dostaje połowę, wpisz high: 0.5.
*/
export const ARMOR_MULTIPLIER = { low: 1, high: 1 };

export type ArmorTier = keyof typeof ARMOR_MULTIPLIER;

export function armorTier(def: BuildItem): ArmorTier {
  if (def.armor) return def.armor;
  if (def.material === 'metal' || def.material === 'brick') return 'high';
  return /metal|brick/i.test(def.name) ? 'high' : 'low';
}

/** Struktury (płyty, ściany, filary, schody) liczą Structure_Damage, a barykady (rekwizyty, klapy, łóżko) Barricade_Damage. */
const isStructure = (def: BuildItem) => !!def.part && def.part !== 'hatch';

export const useExplosives = create<{ list: Explosive[] }>(() => ({ list: BUILT_IN }));

let loading: Promise<void> | null = null;
export function loadExplosives() {
  loading ??= fetch('/game/explosives.json')
    .then((r) => (r.ok ? (r.json() as Promise<Explosive[]>) : null))
    .then((list) => {
      if (list?.length) useExplosives.setState({ list });
    })
    .catch(() => undefined);
  return loading;
}

/** Ile sztuk każdego ładunku niszczy element (pomija ładunki, które go nie ruszają). */
export function raidCost(def: BuildItem, list: Explosive[]) {
  if (!def.health) return [];
  const mult = ARMOR_MULTIPLIER[armorTier(def)];
  return list
    .map((e) => ({ id: e.id, damage: (isStructure(def) ? e.structure : e.barricade) * mult }))
    .filter((e) => e.damage > 0)
    .map((e) => ({ id: e.id, count: Math.ceil(def.health! / e.damage) }));
}
