/*
  Historia zmian widoczna na /changelog. Nowa wersja na górze.
  Każdy wpis ma tekst PL i EN obok siebie, żeby przy dopisywaniu nie zgubić tłumaczenia.
*/
import type { Lang } from './i18n';

type Text = Record<Lang, string>;

export interface Release {
  version: string;
  /** RRRR-MM-DD */
  date: string;
  title: Text;
  changes: Text[];
}

export const CHANGELOG: Release[] = [
  {
    version: '0.4.0',
    date: '2026-10-19',
    title: { pl: 'Teren, drogi i ruch jak w grze', en: 'Ground, roads and movement like in the game' },
    changes: [
      {
        pl: 'Chodzenie w 3D według zasad z Unturned: prędkości chodu, biegu, kucania i czołgania, skok, grawitacja, zsuwanie się ze stromych zboczy, pływanie.',
        en: '3D walking follows the Unturned rules: walk, sprint, crouch and prone speeds, jump, gravity, sliding off steep slopes, swimming.',
      },
      {
        pl: 'Zdrowie i tlen przy chodzeniu: obrażenia i złamane nogi po upadku z wysokości, tlen pod wodą i wysoko nad mapą.',
        en: 'Health and oxygen while walking: fall damage and broken legs, oxygen underwater and high above the map.',
      },
      {
        pl: 'Nowe klawisze: kucanie (C) i czołganie (Z), do zmiany w zakładce Skróty.',
        en: 'New keys: crouch (C) and prone (Z), rebindable in the Keys tab.',
      },
      {
        pl: 'Zasady budowania z gry: ściana wymaga filarów na obu końcach (murek słupków), zakaz budowy w strefach bezpiecznych, przy punktach odrodzenia i pod ziemią, podłoga musi mieć grunt najwyżej 10 m pod sobą.',
        en: 'Building rules from the game: walls need pillars at both ends (ramparts need posts), no building in safezones, near spawn points or underground, floors need ground within 10 m below.',
      },
      {
        pl: 'W 3D ziemia ma prawdziwe tekstury z gry (trawa, ziemia, żwir, piasek, śnieg) mieszane tak jak w Unturned. Ostra z bliska, bez rozmytych plam z mapy satelitarnej.',
        en: 'In 3D the ground uses the real game textures (grass, dirt, gravel, sand, snow) blended like in Unturned. Sharp up close, no blurry blotches from the satellite map.',
      },
      {
        pl: 'Drogi odtworzone z plików mapy: asfalt z pasami, ścieżki, tory i autostrady, na tej samej wysokości co teren.',
        en: 'Roads rebuilt from the map files: asphalt with lane markings, trails, tracks and highways, following the terrain.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-19',
    title: { pl: 'Płynny plan 2D i własne klawisze', en: 'Smooth 2D plan and custom keys' },
    changes: [
      {
        pl: 'Plan 2D rysuje się na jednym płótnie. Przesuwanie i przybliżanie dużych baz nie przycina, nawet przy kilkunastu tysiącach elementów.',
        en: 'The 2D plan is drawn on a single canvas. Panning and zooming large bases stays smooth, even with tens of thousands of pieces.',
      },
      {
        pl: 'Zaznaczony trójkąt ma teraz widoczną obwódkę.',
        en: 'Selected triangles now show an outline.',
      },
      {
        pl: 'Klawisze do zmiany w zakładce Skróty: wybór elementów 1-9, wyburzanie, łóżko, obrót, piętra i ruch w 3D. Zajęty klawisz zamienia się miejscami z poprzednim.',
        en: 'Rebindable keys in the Keys tab: toolbox pieces 1-9, demolish, bed, rotate, floors and 3D movement. Picking a taken key swaps the two.',
      },
      {
        pl: 'Nowa strona ze zmianami.',
        en: 'New changelog page.',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-15',
    title: { pl: 'Planturned', en: 'Planturned' },
    changes: [
      {
        pl: 'Nowa nazwa i wygląd: zieleń, tło z ekranu ładowania gry, znak zombie.',
        en: 'New name and look: green palette, an in-game loading screen as the background, the zombie mark.',
      },
      {
        pl: 'Przybornik od nowa: elementy pogrupowane w trzy kolumny, materiał jako próbki, pasek z wybranym elementem.',
        en: 'Rebuilt toolbox: pieces grouped in three columns, materials as swatches, a bar with the selected piece.',
      },
      {
        pl: 'Wersja angielska i przełącznik PL / EN.',
        en: 'English version and a PL / EN switch.',
      },
      {
        pl: 'Prostszy widok 3D: zamiast paska i panelu pomocy jedna etykieta z trzymanym elementem.',
        en: 'Simpler 3D view: one label with the held piece instead of the hotbar and help panel.',
      },
      {
        pl: 'Usunięta zakładka kosztów.',
        en: 'Removed the costs tab.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-15',
    title: { pl: 'Pierwsza wersja', en: 'First release' },
    changes: [
      {
        pl: 'Plan 2D ze snapowaniem ścian i filarów, piętra, kopiowanie i wklejanie.',
        en: '2D plan with wall and pillar snapping, floors, copy and paste.',
      },
      {
        pl: 'Widok 3D z modelami struktur z plików gry, latanie i chodzenie, pora dnia.',
        en: '3D view with structure models from the game files, flying and walking, time of day.',
      },
      {
        pl: 'Mapy z gry: teren, satelita, budynki i drzewa 1:1, skybase oraz limity wysokości i tlenu.',
        en: 'Game maps: terrain, satellite, buildings and trees 1:1, skybases, height and oxygen limits.',
      },
      {
        pl: 'Zasięg claimu łóżka, eksport i import pliku .baseplan.json.',
        en: 'Bed claim radius, .baseplan.json export and import.',
      },
    ],
  },
];
