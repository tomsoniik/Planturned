/*
  Rekwizyty w planerze: tylko to, co liczy się przy bazie (drzwi, bramy, okiennice, szyby, drabiny,
  skrzynie, szafki, szafy, łóżka z claimem i wieżyczki). Klucz: ID przedmiotu z gry.
  Kolejność wpisów = kolejność kafelków (materiały zawsze klon, brzoza, sosna, metal).
  Angielska nazwa zostaje z eksportu gry; `en` tylko tam, gdzie gra ma kilka przedmiotów o tej samej nazwie.
  Przedmiot spoza listy nie trafia do planera (eksport gry też go pomija: KEEP_PROPS w scripts/export_game_data.py).
*/

export const PROP_GROUPS = ['doors', 'gates', 'shutters', 'glass', 'ladders', 'storage', 'beds', 'sentries'] as const;
export type PropGroup = (typeof PROP_GROUPS)[number];

export interface PropEntry {
  group: PropGroup;
  order: number;
  pl: string;
  en?: string;
}

type Row = [id: number, pl: string, en?: string];

const CATALOG: Record<PropGroup, Row[]> = {
  doors: [
    [281, 'Klonowe drzwi'], [282, 'Brzozowe drzwi'], [283, 'Sosnowe drzwi'], [378, 'Metalowe drzwi'],
    [284, 'Drzwi więzienne'], [286, 'Drzwi do skarbca'],
  ],
  gates: [
    [451, 'Klonowa brama'], [455, 'Brzozowa brama'], [456, 'Sosnowa brama'], [457, 'Metalowa brama'],
    [1235, 'Klonowe drzwi podwójne'], [1236, 'Brzozowe drzwi podwójne'], [1237, 'Sosnowe drzwi podwójne'], [1238, 'Metalowe drzwi podwójne'],
  ],
  shutters: [
    [1223, 'Klonowa okiennica'], [1224, 'Brzozowa okiennica'], [1225, 'Sosnowa okiennica'], [1226, 'Metalowa okiennica'],
  ],
  glass: [
    [1297, 'Krucha szyba'], [1298, 'Szyba kuloodporna'], [1299, 'Lustro weneckie'],
  ],
  ladders: [
    [325, 'Klonowa drabina'], [326, 'Brzozowa drabina'], [327, 'Sosnowa drabina'], [379, 'Metalowa drabina'],
  ],
  storage: [
    [366, 'Klonowa skrzynia'], [367, 'Brzozowa skrzynia'], [368, 'Sosnowa skrzynia'], [328, 'Szafka metalowa'],
    [1278, 'Klonowa szafa'], [1279, 'Brzozowa szafa'], [1280, 'Sosnowa szafa'], [1281, 'Metalowa szafa'],
  ],
  beds: [
    [1158, 'Flaga claimu'],
    [294, 'Biały śpiwór'], [288, 'Czarny śpiwór'], [289, 'Niebieski śpiwór'], [290, 'Zielony śpiwór'],
    [295, 'Żółty śpiwór'], [291, 'Pomarańczowy śpiwór'], [293, 'Czerwony śpiwór'], [292, 'Fioletowy śpiwór'],
    [1243, 'Łóżko polowe'], [1309, 'Niebieskie łóżko polowe'], [1310, 'Zielone łóżko polowe'], [1314, 'Żółte łóżko polowe'],
    [1311, 'Pomarańczowe łóżko polowe'], [1313, 'Czerwone łóżko polowe'], [1312, 'Fioletowe łóżko polowe'],
  ],
  sentries: [
    [1372, 'Przyjazna wieżyczka'], [1244, 'Neutralna wieżyczka'], [1373, 'Wroga wieżyczka'],
  ],
};

const BY_ID = new Map<number, PropEntry>();
for (const group of PROP_GROUPS) {
  CATALOG[group].forEach(([id, pl, en], i) => BY_ID.set(id, { group, order: PROP_GROUPS.indexOf(group) * 1000 + i, pl, en }));
}

export const propEntry = (gameId: number): PropEntry | undefined => BY_ID.get(gameId);

/** ID wszystkich rekwizytów z katalogu. */
export const PROP_IDS = [...BY_ID.keys()];
