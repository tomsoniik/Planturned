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
    version: '0.8.0',
    date: '2026-10-20',
    title: { pl: 'Dachy jak w grze i /skybase', en: 'Roofs like in the game and /skybase' },
    changes: [
      {
        pl: 'Dach (też z otworem, schody i rampa) przyczepia się tylko do krawędzi podłogi, dachu albo góry pełnej ściany, jak w Unturned. Same filary albo murek nie wystarczą, w powietrzu ani na gołym terenie się nie da.',
        en: 'A roof (also holes, stairs and ramps) only attaches to the edge of a floor, a roof or the top of a full wall, like in Unturned. Pillars alone or a rampart are not enough, and it cannot float or sit on bare ground.',
      },
      {
        pl: 'Podłogi i dachy w 3D przyczepiają się do krawędzi tak jak w grze, także do krawędzi ścian.',
        en: 'In 3D floors and roofs snap to edges the way the game does, including wall edges.',
      },
      {
        pl: '/skybase: teleport na wysokość, gdzie pod limitem mapy mieści się jedno piętro, i dach startowy pod tobą, od którego budujesz dalej.',
        en: '/skybase: teleports you to the height where one floor fits under the map limit and puts a starter roof under you to build from.',
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-20',
    title: { pl: 'Sandbox na całej mapie', en: 'Sandbox on the whole map' },
    changes: [
      {
        pl: 'Start na spawnie z gry zamiast wybierania miejsca. Budujesz gdziekolwiek na mapie, na ziemi i w powietrzu naraz, bez trybu Na ziemi / Skybase.',
        en: 'You start at a game spawn instead of picking a spot. Build anywhere on the map, on the ground and in the sky at once, with no On ground / Skybase mode.',
      },
      {
        pl: 'Stawianie jak w grze: wolna podłoga ląduje na terenie w miejscu celownika i obraca się z kamerą, bez globalnej siatki. Dachy w powietrzu stawiasz na wysokości pod kamerą (/sky 150).',
        en: 'Placing like in the game: a free floor lands on the ground at the crosshair and turns with the camera, with no global grid. Roofs in the air go at the height below the camera (/sky 150).',
      },
      {
        pl: 'Ctrl C kopiuje w 3D całą bazę (albo zaznaczenie), Ctrl V pokazuje ją w celowniku, R obraca, klik wstawia w dowolnym miejscu mapy.',
        en: 'In 3D Ctrl C copies the whole base (or the selection), Ctrl V shows it at the crosshair, R rotates, a click places it anywhere on the map.',
      },
      {
        pl: 'Mapa pod M: twoja pozycja i kierunek, baza, spawny z gry. Klik teleportuje. Ta sama mapa jest w menu Esc.',
        en: 'Map on M: your position and heading, the base, game spawns. A click teleports. The same map is in the Esc menu.',
      },
      {
        pl: 'Oświetlenie z plików mapy (Lighting.dat): kolory słońca, nieba, otoczenia i mgły oraz siła cienia dla każdej pory dnia. Budowle nie rzucają cienia, jak w Unturned.',
        en: 'Lighting from the map files (Lighting.dat): sun, sky, ambient and fog colors and shadow strength for each time of day. Structures cast no shadows, like in Unturned.',
      },
      {
        pl: 'Nowe komendy: /spawn, a /sky i /ground przenoszą kamerę na wysokość nad terenem. Stare skybase\'y same przechodzą na swoją wysokość.',
        en: 'New command /spawn; /sky and /ground move the camera to a height above the ground. Old skybases move to their height on their own.',
      },
      {
        pl: 'Plan 2D liczy piętra od najniższego poziomu z elementami i otwiera się na nim, więc skybase po przeniesieniu na swoją wysokość dalej jest widoczny.',
        en: 'The 2D plan counts floors from the lowest level with pieces and opens on it, so a skybase moved to its height stays visible.',
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-20',
    title: { pl: 'Widok 3D jak w grze', en: '3D view like in the game' },
    changes: [
      {
        pl: 'Widok 3D na cały ekran: bez górnego paska i przybornika.',
        en: 'Full-screen 3D view: no top bar or toolbox.',
      },
      {
        pl: 'Pasek 9 slotów u dołu ekranu, osobny dla każdego projektu. Puste sloty nie są widoczne, klawisze 1-9 i kółko myszy wybierają slot.',
        en: 'A 9-slot hotbar at the bottom, saved per project. Empty slots stay hidden, keys 1-9 and the mouse wheel pick a slot.',
      },
      {
        pl: 'Ekwipunek pod E: kliknij element albo najedź i wciśnij 1-9, żeby włożyć go do slotu. Sloty można przeciągać, PPM czyści slot.',
        en: 'Inventory on E: click a piece or hover it and press 1-9 to put it in a slot. Slots can be dragged, RMB clears a slot.',
      },
      {
        pl: 'Czat z komendami pod T albo /: /time, /sky, /ground, /fly, /walk, /tp, /pos, /beds, /give, /2d, /undo, /redo, /clear. Tab podpowiada, /help pokazuje listę.',
        en: 'Chat with commands on T or /: /time, /sky, /ground, /fly, /walk, /tp, /pos, /beds, /give, /2d, /undo, /redo, /clear. Tab completes, /help lists them.',
      },
      {
        pl: 'Menu pod Esc zamiast przełączników: pora dnia, skybase i wysokość, mapa, klawisze, powrót do 2D i eksport.',
        en: 'An Esc menu instead of toggles: time of day, skybase and height, map, keys, back to 2D and export.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-20',
    title: { pl: 'Drzewa z gry i płynniejsze 3D', en: 'Game trees and smoother 3D' },
    changes: [
      {
        pl: 'Drzewa i krzaki na mapach mają liście z tekstur gry zamiast brązowych brył. Siatki płotów i uprawy też są ażurowe jak w Unturned.',
        en: 'Map trees and bushes now have leaves from the game textures instead of brown blobs. Fence meshes and crops are see-through like in Unturned.',
      },
      {
        pl: 'Teren w 3D sięga ponad 500 m od kamery i idzie za nią: można odejść daleko od bazy, a ziemia, drogi i obiekty mapy doczytują się po drodze.',
        en: 'The 3D ground reaches over 500 m from the camera and follows it: walk far from the base and the ground, roads and map objects load along the way.',
      },
      {
        pl: 'Teren doczytuje się kawałkami po 128 m, kilka na klatkę, bez zacięć przy ruchu po mapie.',
        en: 'The ground streams in 128 m tiles, a few per frame, with no stutter while moving across the map.',
      },
      {
        pl: 'Rzeźba terenu dokładnie z siatki wysokości gry, bez wygładzania.',
        en: 'Terrain shape taken exactly from the game heightmap, no smoothing.',
      },
      {
        pl: 'Duże bazy w 3D rysują się dużo szybciej: elementy jednego typu idą jednym wywołaniem karty graficznej.',
        en: 'Large bases render much faster in 3D: pieces of the same type are drawn in a single GPU call.',
      },
      {
        pl: 'Na liściach drzew nie da się już stanąć ani o nie zahaczyć, kolizję ma tylko pień, jak w grze.',
        en: 'Tree leaves no longer block you or hold you up; only the trunk collides, like in the game.',
      },
    ],
  },
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
