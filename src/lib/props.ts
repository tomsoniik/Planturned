import { create } from 'zustand';
import { iconUrl, propItemId, registerBuildItems, type BuildItem } from './builder';
import { propEntry } from './propCatalog';

/*
  Rekwizyty: przedmioty z Unturned stawiane jak barykady (Useable Barricade), tylko te z katalogu (propCatalog).
  Klapy są strukturami. Lista z eksportu gry: public/game/props.json (npm run export:game, flaga --props).
  Siatki osobno w public/game/props/<id>.json, wczytywane dopiero gdy rekwizyt jest na mapie albo w ręku (gameModels).
*/

/** Kategorie z eksportu (scripts/export_game_data.py); w ekwipunku grupy i kolejność daje propCatalog. */
type PropCategory = 'walls' | 'doors' | 'storage' | 'defense' | 'beds';

interface RawProp {
  id: number;
  name: string | null;
  build: string;
  category: PropCategory;
  health: number | null;
  color?: string;
  /** Pierwszy przepis z gry (bez narzędzi); null = tylko z łupów albo od handlarza */
  recipe?: { inputs: { id: number | null; amount: number }[]; yields: number } | null;
  armor?: 'low' | 'high' | null;
  /** Drzwi, bramy, okiennice: pivot nad spodem modelu (m). */
  pivot?: number;
  /** [[minX, minY, minZ], [maxX, maxY, maxZ]] w metrach; brak = brak modelu w eksporcie */
  bounds?: [[number, number, number], [number, number, number]];
}

/** Grupa, kolejność i nazwy z propCatalog; przedmiotów spoza katalogu nie ma w planerze. */
function toItems(list: RawProp[]): BuildItem[] {
  return list
    .filter((p) => p.bounds && p.name && propEntry(p.id))
    .map((p) => {
      const [min, max] = p.bounds!;
      const entry = propEntry(p.id)!;
      return {
        order: entry.order,
        item: {
          id: propItemId(p.id),
          name: entry.en ?? p.name!,
          namePl: entry.pl,
          shape: 'prop' as const,
          gameId: p.id,
          icon: iconUrl(p.id),
          color: p.color ?? '#8a8a8a',
          costs: Object.fromEntries((p.recipe?.inputs ?? []).filter((i) => i.id !== null).map((i) => [String(i.id), i.amount])),
          craftYield: p.recipe?.yields ?? 1,
          noRecipe: !p.recipe,
          armor: p.armor ?? undefined,
          pivot: p.pivot,
          health: p.health ?? undefined,
          category: entry.group,
          size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as [number, number, number],
          claim: p.build === 'Bed' || p.build === 'Claim',
          build: p.build,
        } satisfies BuildItem,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((e) => e.item);
}

interface PropsState {
  items: BuildItem[];
  ready: boolean;
}

export const usePropsStore = create<PropsState>(() => ({ items: [], ready: false }));

let promise: Promise<BuildItem[]> | null = null;

/** Wczytuje listę raz; bez eksportu gry zwraca pustą listę (ekwipunek pokazuje wtedy tylko budowle). */
export function loadProps(): Promise<BuildItem[]> {
  if (!promise) {
    promise = fetch('/game/props.json')
      .then((r) => (r.ok ? (r.json() as Promise<RawProp[]>) : []))
      .then((list) => {
        const items = toItems(list);
        registerBuildItems(items);
        usePropsStore.setState({ items, ready: true });
        return items;
      })
      .catch(() => {
        usePropsStore.setState({ ready: true });
        return [];
      });
  }
  return promise;
}
