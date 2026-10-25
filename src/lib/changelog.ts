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
    version: '0.23.0',
    date: '2026-10-24',
    title: { pl: 'Drabiny, niebo i nowe menu', en: 'Ladders, sky and a new menu' },
    changes: [
      {
        pl: 'Drabina przyczepia się do otworu w dachu, kwadratowego i trójkątnego: staje przy krawędzi otworu i sięga od podłogi pod klapę. R wybiera krawędź. Bez otworu w pobliżu stawia się jak dotąd.',
        en: 'A ladder attaches to a roof hole, square or triangular: it stands at the edge of the opening and reaches from the floor up to the hatch. R picks the edge. Away from a hole it places like before.',
      },
      {
        pl: 'Po drabinie można się wspinać jak w grze: podejdź przodem i trzymaj W (4,5 m/s), S schodzi, spacja zeskakuje. Na górze otworu postać sama podciąga się na dach.',
        en: 'You can climb ladders like in the game: walk up facing one and hold W (4.5 m/s), S climbs down, Space lets go. At the top of a hole you pull yourself up onto the roof.',
      },
      {
        pl: 'Bramy otwierają się jak brama garażowa (unoszą się do góry), a okiennice i drzwi podwójne rozchylają dwa skrzydła na boki. Zwykłe drzwi dalej obracają się na zawiasie.',
        en: 'Gates open like a garage door (they lift up), while shutters and double doors swing two leaves apart. Regular doors still turn on their hinge.',
      },
      {
        pl: 'Klapę można postawić także w trójkątnym dachu z otworem.',
        en: 'Hatches now also fit the triangular roof hole.',
      },
      {
        pl: 'Na mapach z gry jest prawdziwe niebo: słońce z poświatą tam, skąd pada światło, płynące chmury, a nocą księżyc.',
        en: 'Game maps now have a real sky: a sun with a glow where the light comes from, drifting clouds and a moon at night.',
      },
      {
        pl: 'Rekwizyty ograniczone do tego, co liczy się przy bazie: drzwi, bramy, okiennice, szyby, drabiny, skrzynie, szafki, szafy, łóżka, flaga claimu i wieżyczki. Reszta zniknęła z planera i z zapisanych projektów.',
        en: 'Props are trimmed to what matters for a base: doors, gates, shutters, glass, ladders, crates, lockers, wardrobes, beds, the claim flag and sentries. Everything else is gone from the planner and from saved projects.',
      },
      {
        pl: 'Interfejs w Sandboxie wygląda jak w Unturned: zdrowie i tlen jako paski z ikonami w lewym dolnym rogu, biały celownik z kropką, podpowiedź otwierania drzwi tuż pod celownikiem z nazwą przedmiotu, czat w lewym górnym rogu. Zniknęły przezroczyste płaszczyzny limitu wysokości i tlenu na niebie (limity dalej działają przy stawianiu).',
        en: 'The Sandbox HUD now looks like Unturned: health and oxygen as bars with icons in the bottom-left corner, a white crosshair with a dot, the open-door prompt right under the crosshair with the item name, chat in the top-left corner. The see-through height and oxygen limit planes in the sky are gone (the limits still apply when placing).',
      },
      {
        pl: 'Drzewa nie tracą liści z daleka: na kartach graficznych z dystansu zostawały same pnie, bo przezroczystość liści znikała w mniejszych teksturach.',
        en: 'Trees keep their leaves at a distance: on graphics cards only trunks were left far away, because leaf transparency faded out in the smaller textures.',
      },
      {
        pl: 'Nowe menu pod Esc: zaczyna się od zakładki Jak grać ze wszystkimi ważnymi klawiszami i wskazówkami, każda zakładka mówi jednym zdaniem, do czego służy. Zakładka Budowle zniknęła z menu (lista baz dalej jest w Plannerze).',
        en: 'New Esc menu: it opens on a How to play tab with every key that matters and a few tips, and each tab says in one line what it is for. The Builds tab is gone from the menu (the base list is still in the Planner).',
      },
    ],
  },
  {
    version: '0.22.0',
    date: '2026-10-23',
    title: { pl: 'Drzwi bez szpary i prawdziwe szyby', en: 'Doors without gaps and proper glass' },
    changes: [
      {
        pl: 'Szyby stawia się tylko w ścianie z oknem, tak jak w grze (jedna na okno). Są przezroczyste i widać je z obu stron, a lustro weneckie z jednej strony jest ciemnym lustrem, z drugiej przepuszcza widok (R zmienia stronę). Szyby blokują przejście z obu stron.',
        en: 'Glass only goes into a window wall, like in the game (one per window). It is see-through and visible from both sides, and one-way glass is a dark mirror on one side and clear on the other (R flips it). Glass blocks you from both sides.',
      },
      {
        pl: 'Szyby mają poprawne przepisy w oknie Materiały.',
        en: 'Glass panes now have the correct recipes in the Materials window.',
      },
      {
        pl: 'Drzwi, bramy, drzwi podwójne i okiennice stoją w otworze dokładnie jak w grze: w tym samym punkcie ściany, w którym gra je osadza, więc nad drzwiami nie ma już prześwitu. Drzwi postawione wcześniej poprawiają się same po otwarciu projektu.',
        en: 'Doors, gates, double doors and shutters sit in the opening exactly like in the game, at the same point of the wall where the game mounts them, so there is no more gap above the door. Doors placed earlier fix themselves when you open the project.',
      },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-10-23',
    title: { pl: 'Dźwięki jak w grze i jeden układ ekwipunku', en: 'Game-accurate sounds and one inventory layout' },
    changes: [
      {
        pl: 'Każde drzwi, brama, okiennica i klapa gra dźwięk z własnego modelu w grze: drzwi więzienne i do skarbca brzmią ciężko i metalicznie, reszta ma klamkę, tak jak w Unturned. Otwierają się tyle, co w grze (skarbiec wolniej).',
        en: 'Every door, gate, shutter and hatch plays the sound from its own game model: jail and vault doors sound heavy and metallic, the rest use the door handle, just like in Unturned. They open as fast as in the game (the vault door slower).',
      },
      {
        pl: 'Dźwięk dochodzi z miejsca drzwi i cichnie z odległością (do 8 m, jak w grze), szybkie wciskanie F nie nakłada go na siebie, a w tle karty jest wyciszony. Głośność i wyciszenie są w menu Esc > Ustawienia.',
        en: 'Sound comes from the door and fades with distance (up to 8 m, as in the game), mashing F does not stack it, and it goes quiet while the tab is in the background. Volume and mute are in Esc > Settings.',
      },
      {
        pl: 'Ekwipunek w Sandboxie ma ten sam układ co okno klocków w Plannerze: Podłogi, Ściany, Dachy, Filary, Schody, Klapy, Łóżko, w każdej wiersz to część, a kolumny to materiały od klonu do cegły. Filtr kategorii łączy się z materiałem, a wyszukiwarka zna nazwy polskie i angielskie oraz materiały.',
        en: 'The Sandbox inventory now matches the Planner pieces window: Floors, Walls, Roofs, Pillars, Stairs, Hatches, Bed, each with one row per part and one column per material from maple to brick. The category filter combines with the material, and search knows Polish and English names and materials.',
      },
      {
        pl: 'Rekwizyty zaczynają się od drzwi, bram, futryn, okiennic, skrzyń i łóżek, a w grupie idą materiałem, potem alfabetycznie. Ikony mają stały rozmiar i ładują się w miarę przewijania.',
        en: 'Props start with doors, gates, frames, shutters, crates and beds, sorted by material and then alphabetically. Icons keep a fixed size and load as you scroll.',
      },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-10-23',
    title: { pl: 'Materiały, raid i zdjęcia bazy', en: 'Materials, raiding and base screenshots' },
    changes: [
      {
        pl: 'Nowa zakładka Materiały (okno klocków w Plannerze i menu Esc w Sandboxie): ile desek, kłód, blach, cegieł i reszty trzeba zebrać na cały projekt albo jedną bazę, według przepisów z gry. Przycisk kopiuje listę jako tekst dla ekipy.',
        en: 'New Materials tab (pieces window in the Planner and the Esc menu in Sandbox): how many planks, logs, sheets, bricks and the rest you need for the whole project or one base, from the game recipes. A button copies the list as text for your team.',
      },
      {
        pl: 'Kalkulator raidu: element pod celownikiem w Sandboxie (i zaznaczony w Plannerze) pokazuje HP i ile ładunków precyzyjnych, burzących, rakiet i granatów go niszczy, według obrażeń z plików gry.',
        en: 'Raid calculator: the piece under your crosshair in Sandbox (or selected in the Planner) shows its HP and how many precision charges, demolition charges, rockets and grenades destroy it, using the damage values from the game files.',
      },
      {
        pl: 'Menu Esc ma sekcję Ustawienia: czułość myszy, pole widzenia, odwrócenie osi Y, głośność i wyciszenie.',
        en: 'The Esc menu has a Settings section: mouse sensitivity, field of view, invert Y, volume and mute.',
      },
      {
        pl: 'F2 albo /screenshot zapisuje zdjęcie sceny bez HUD-u (PNG z nazwą projektu i datą).',
        en: 'F2 or /screenshot saves a picture of the scene without the HUD (PNG named after the project and date).',
      },
      {
        pl: 'Widok z orbity: /orbit albo przycisk przy bazie na liście Budowle. Kamera krąży wokół bazy (przeciąganie myszą, kółko przybliża), klawisz latania wraca do gracza. Na telefonie i tablecie Sandbox od razu pokazuje bazę z orbity, sterowaną palcami.',
        en: 'Orbit view: /orbit or the button next to a base in the Builds list. The camera circles the base (drag with the mouse, the wheel zooms), the fly key takes you back. On phones and tablets Sandbox opens in orbit view with touch controls.',
      },
      {
        pl: 'Usunięcie ściany z otworem usuwa też drzwi, bramę albo okiennicę, które w niej stały.',
        en: 'Removing a wall with an opening also removes the door, gate or shutter that was in it.',
      },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-10-23',
    title: { pl: 'Pewniejsze chodzenie w Sandboxie', en: 'Sturdier walking in Sandbox' },
    changes: [
      {
        pl: 'Postać ma pełną szerokość: nie przechodzi już przez rogi ścian, cienkie filary i słupki, a przy ścianie ślizga się wzdłuż niej. Zamykane drzwi wypychają postać z przejścia.',
        en: 'Your character now has its full width: no more slipping through wall corners, thin pillars or posts, and you slide along walls. A closing door pushes you out of the doorway.',
      },
      {
        pl: 'Skok kończy się na suficie zamiast przelatywać przez dach, a z kucania czy czołgania wstaniesz tylko tam, gdzie jest miejsce nad głową.',
        en: 'Jumping stops at the ceiling instead of passing through the roof, and you can only stand up from crouching or prone where there is room above your head.',
      },
      {
        pl: 'Po śmierci odradzasz się przy łóżku (najbliższym miejsca śmierci), a bez łóżka jak dotąd na starcie.',
        en: 'After dying you respawn at your bed (the one closest to where you died), or at the start point if there is no bed.',
      },
      {
        pl: 'Duże bazy chodzą płynniej: kolizje liczą tylko to, co jest blisko postaci. Na ekranach retina i 4K scena rysuje się w niższej gęstości, gdy brakuje płynności, a daleki teren mniej migocze.',
        en: 'Large bases run smoother: collisions only check what is near you. On retina and 4K screens the scene drops its pixel density when frames slow down, and distant terrain flickers less.',
      },
      {
        pl: 'Gdy karta graficzna przerwie rysowanie (np. po uśpieniu komputera), zamiast czarnego ekranu pojawia się przycisk Wczytaj ponownie.',
        en: 'If the graphics card stops drawing (for example after sleep), you get a Reload button instead of a black screen.',
      },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-10-23',
    title: { pl: 'Drzwi z animacją i dźwiękiem', en: 'Doors with animation and sound' },
    changes: [
      {
        pl: 'Drzwi, bramy, okiennice i klapy obracają się płynnie na zawiasie zamiast przeskakiwać, a kolizja podąża za skrzydłem.',
        en: 'Doors, gates, shutters and hatches swing smoothly on their hinge instead of snapping, and collision follows the moving panel.',
      },
      {
        pl: 'Otwieranie i zamykanie gra oryginalny dźwięk klamki z Unturned.',
        en: 'Opening and closing plays the original door handle sound from Unturned.',
      },
      {
        pl: 'Rekwizyty w ekwipunku są w 21 grupach (drzwi, bramy, futryny, płyty, skrzynie, meble, uprawy, pułapki...), w każdej materiały po kolei: klon, brzoza, sosna, metal. W wersji polskiej mają polskie nazwy, a wyszukiwarka zna też angielskie.',
        en: 'Props in the inventory are split into 21 groups (doors, gates, frames, plates, crates, furniture, farming, traps...), each listing materials in order: maple, birch, pine, metal. Duplicate game names such as triangle plates now have their own names.',
      },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-10-22',
    title: { pl: 'Drzwi i klapy, które się otwierają', en: 'Doors and hatches that open' },
    changes: [
      {
        pl: 'Drzwi, bramy, okiennice i klapy otwierasz i zamykasz klawiszem F, patrząc na nie z bliska (do 4 m). Zamknięte blokują przejście, otwarte nie. Stan zapisuje się w projekcie.',
        en: 'Press F while looking at a door, gate, shutter or hatch up close (up to 4 m) to open or close it. Closed ones block the way, open ones let you through. The state is saved in the project.',
      },
      {
        pl: 'Drzwi stawia się tylko w otworze: drzwi w ścianie z drzwiami, brama w ścianie garażowej, okiennica w oknie. Celownik przyciąga je do najbliższego wolnego otworu, R zmienia stronę otwierania.',
        en: 'Doors go only into an opening: a door into a doorway, a gate into a garage wall, a shutter into a window. The crosshair snaps them to the nearest free opening, R flips the side they open to.',
      },
      {
        pl: 'Latanie w Sandboxie jest teraz pod V, bo F służy do otwierania.',
        en: 'Flying in Sandbox is now on V, since F opens things.',
      },
      {
        pl: 'Ekwipunek mieści się w oknie na każdym ekranie, a lista przewija się w środku, więc widać wszystkie rekwizyty.',
        en: 'The inventory fits the window on any screen and the list scrolls inside it, so every prop is reachable.',
      },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-10-22',
    title: { pl: 'Rekwizyty z gry', en: 'Props from the game' },
    changes: [
      {
        pl: 'W Sandboxie ekwipunek (E) ma zakładkę Rekwizyty: 290 przedmiotów, które w Unturned stawia się jak barykady, każdy do zdobycia w grze (przepis, łupy albo handlarz). Skrzynie, drzwi i bramy, meble, światła, uprawy, pułapki, łóżka i pojazdy, z oryginalnymi modelami i HP.',
        en: 'In Sandbox the inventory (E) has a Props tab: 290 items placed like barricades in Unturned, each obtainable in the game (recipe, loot or trader). Crates, doors and gates, furniture, lights, farms, traps, beds and vehicles, with original models and HP.',
      },
      {
        pl: 'Rekwizyt stawiasz na dowolnej powierzchni pod celownikiem, obrót jak gracz, R obraca o 90°. W planie 2D widać jego obrys w prawdziwym rozmiarze.',
        en: 'A prop goes on any surface under the crosshair, facing like the player, R rotates by 90°. The 2D plan shows its outline at real size.',
      },
      {
        pl: 'Wszystkie łóżka i flaga claimu pokazują zasięg claimu. Wybór elementu z ekwipunku od razu trafia do ręki.',
        en: 'Every bed and the claim flag show the claim radius. Picking a piece in the inventory puts it in your hand right away.',
      },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-10-22',
    title: { pl: 'Funkcje w jednym oknie', en: 'Features in one window' },
    changes: [
      {
        pl: 'Na stronie głównej funkcje są w jednym oknie zamiast dwóch długich sekcji: wybierasz z listy albo przesuwasz palcem, obraz i opis zmieniają się w miejscu. Okno samo przełącza się co 7 sekund, dopóki go nie ruszysz.',
        en: 'The home page shows features in one window instead of two long sections: pick from the list or swipe, the image and text change in place. The window moves on by itself every 7 seconds until you touch it.',
      },
      {
        pl: 'Zrzuty z aplikacji w wersji angielskiej mają angielski interfejs.',
        en: 'App screenshots on the English page show the English interface.',
      },
      {
        pl: 'Podtytuł na stronie głównej jest czytelny także na jasnych klatkach filmu. Lista projektów i changelog mają nieruchomy kadr zamiast filmu, więc ładują się szybciej.',
        en: 'The home page subtitle stays readable on bright frames of the video. The project list and changelog use a still frame instead of the video, so they load faster.',
      },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-10-22',
    title: { pl: 'Nowa strona główna i panel', en: 'New home page and admin panel' },
    changes: [
      {
        pl: 'Strona główna pokazuje, co potrafi planer: rysowanie w 2D, Sandbox na mapie i plik dla ekipy, prawdziwe mapy, limity wysokości i tlenu, zasięg łóżka, sterowanie jak w grze. Zrzuty pochodzą z aplikacji.',
        en: 'The home page shows what the planner does: drawing in 2D, Sandbox on a map and a file for your crew, real maps, height and oxygen limits, bed claim radius, controls like in the game. Screenshots come from the app.',
      },
      {
        pl: 'W tle strony głównej, listy projektów i changeloga leci zwiastun Unturned z YouTube. Na telefonie zostaje sam kadr.',
        en: 'The Unturned trailer from YouTube plays behind the home page, project list and changelog. Phones get a still frame.',
      },
      {
        pl: 'Changelog: u góry jedna wersja, pod nią lista wszystkich. Każda wersja ma swój link, przyciski Nowsza / Starsza nie przewijają strony.',
        en: 'Changelog: one version on top, the full list below. Every version has its own link, Newer / Older buttons do not scroll the page.',
      },
      {
        pl: 'Moje projekty: kafelek Nowy projekt na początku siatki, plik .baseplan.json można upuścić w dowolnym miejscu strony.',
        en: 'My projects: a New project tile first in the grid, a .baseplan.json file can be dropped anywhere on the page.',
      },
      {
        pl: 'Na telefonie linki i język są w menu pod przyciskiem. Link wysłany na Discordzie pokazuje obrazek z logo.',
        en: 'On phones, links and language sit in a menu behind a button. A link shared on Discord shows an image with the logo.',
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-10-21',
    title: { pl: 'Untmatica', en: 'Untmatica' },
    changes: [
      {
        pl: 'Nowa nazwa: Untmatica, ukłon w stronę Litematiki. Najpierw plan, potem budowa.',
        en: 'New name: Untmatica, a nod to Litematica. Plan first, then build.',
      },
      {
        pl: 'Nowy znak i ikona karty: kostka bazy, w połowie gotowa, w połowie jako hologram.',
        en: 'New mark and tab icon: a base cube, half built and half a hologram.',
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-10-21',
    title: { pl: 'Planner i Sandbox', en: 'Planner and Sandbox' },
    changes: [
      {
        pl: '2D to teraz Planner, 3D to Sandbox. Przełącznik z ikonami siedzi na środku u góry, w Sandboxie wracasz przez menu (Esc, Planner).',
        en: '2D is now Planner, 3D is Sandbox. The switch with icons sits at the top center; in Sandbox you go back from the menu (Esc, Planner).',
      },
      {
        pl: 'Planner bez górnego paska: plan na cały ekran i pływające wyspy. Lewa: powrót i nazwa projektu z menu (zmiana nazwy, eksport, wyczyść). Prawa: cofnij, ponów, mapa, satelita, łóżka i menu z językiem i skrótami.',
        en: 'Planner without the top bar: the plan fills the screen with floating islands. Left: back and the project name with a menu (rename, export, clear). Right: undo, redo, map, satellite, beds and a menu with language and keys.',
      },
      {
        pl: 'Piętra w pionowym pasku po prawej, jak przyciski w windzie, najwyższe u góry. Plus dodaje kolejne piętro.',
        en: 'Floors in a vertical rail on the right, like elevator buttons, highest on top. Plus adds the next floor.',
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-10-21',
    title: { pl: 'Nowe skróty i menu', en: 'New keys and menu' },
    changes: [
      {
        pl: 'Skróty w kartach: Budowanie, Plan 2D, Ruch w 3D, Widok 3D i stałe skróty. Sloty to rząd klawiszy jak pasek w grze, ruch to układ WASD. Klawisze wyglądają jak nasadki klawiatury.',
        en: 'Keys in cards: Building, 2D plan, 3D movement, 3D view and fixed shortcuts. Slots are a row of keys like the game hotbar, movement is a WASD layout. Keys look like keyboard keycaps.',
      },
      {
        pl: 'Przy zmianie klawisza u góry trzyma się pasek "Naciśnij nowy klawisz dla: ..." z przyciskiem Anuluj. Reset wszystkich pokazuje, ile klawiszy zmieniłeś.',
        en: 'While changing a key, a bar stays on top: "Press a new key for: ..." with a Cancel button. Reset all shows how many keys you changed.',
      },
      {
        pl: 'Menu pauzy w 3D z ikonami sekcji, jasnym przyciskiem Wróć do gry i ustawieniami sceny w wierszach z przełącznikiem.',
        en: 'The 3D pause menu has section icons, a bright Back to game button and scene settings as rows with a switch.',
      },
      {
        pl: 'Pozostałe skróty (myszka, Esc, Ctrl) mają zwykłe nazwy jak reszta: Kopiuj, Wklej, Cofnij, Przesuń plan.',
        en: 'Other shortcuts (mouse, Esc, Ctrl) have plain names like the rest: Copy, Paste, Undo, Pan the plan.',
      },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-10-20',
    title: { pl: 'Materiały jako filtry', en: 'Materials as filters' },
    changes: [
      {
        pl: 'Bez osobnego doku materiałów. Klon, Brzoza, Sosna, Metal i Cegła to filtry w tym samym pasku co kategorie i łączą się z nimi (np. Ściany + Metal). Każdy klocek ma własny kafelek w swoim materiale, z HP.',
        en: 'No separate material dock. Maple, Birch, Pine, Metal and Brick are filters in the same rail as the categories and combine with them (e.g. Walls + Metal). Every piece has its own tile in its material, with HP.',
      },
      {
        pl: 'Wszystko pokazuje każdą część w pięciu materiałach obok siebie. Wyszukiwarka zna też materiały ("metal").',
        en: 'All shows each part in the five materials side by side. Search also knows materials ("metal").',
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-10-20',
    title: { pl: 'Klocki w oknie zamiast panelu', en: 'Pieces in a window instead of a side panel' },
    changes: [
      {
        pl: 'Plan 2D zajmuje cały ekran. Na dole pasek: sloty 1-9, materiał i wyburzanie. E (albo przycisk na pasku) otwiera okno z klockami: najpierw Wszystko, potem filtry Podłogi, Ściany, Dachy, Filary, Schody, Klapy, Łóżko.',
        en: 'The 2D plan takes the whole screen. The bar at the bottom holds slots 1-9, the material and demolish. E (or the bar button) opens the pieces window: All first, then filters for Floors, Walls, Roofs, Pillars, Stairs, Hatches, Bed.',
      },
      {
        pl: 'Klocek wybrany w oknie trafia do wybranego slotu, jak w ekwipunku gry. PPM na slocie go czyści.',
        en: 'A piece picked in the window goes into the selected slot, like the game inventory. RMB on a slot clears it.',
      },
      {
        pl: 'Ikony Phosphor zamiast napisów i obrazków kategorii. Budowle, kolor i skróty są zakładkami tego samego okna.',
        en: 'Phosphor icons instead of labels and category pictures. Builds, color and keys are tabs of the same window.',
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-10-20',
    title: { pl: 'Nowy przybornik 2D', en: 'New 2D toolbox' },
    changes: [
      {
        pl: 'Przybornik z kategoriami w pionowym pasku: Podłogi, Ściany, Dachy, Filary, Schody, Klapy, Narzędzia. Materiał wybierasz przy elemencie, ikonami z gry (kłoda, blacha, cegły), zamiast kolorowych próbek.',
        en: 'A toolbox with categories in a side rail: Floors, Walls, Roofs, Pillars, Stairs, Hatches, Tools. You pick the material next to each piece with game icons (log, sheet metal, bricks) instead of color swatches.',
      },
      {
        pl: 'Wybór mapy przy nowym projekcie (podgląd każdej mapy) i z górnego paska. Zakładka Teren zniknęła, satelita pod planem to przełącznik obok.',
        en: 'Pick the map when creating a project (with a preview of each map) and from the top bar. The Terrain tab is gone; the satellite under the plan is a toggle next to it.',
      },
    ],
  },
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
      {
        pl: 'Przenoszenie bazy w 3D: celujesz w bazę i wciskasz G. Cała połączona baza wisi w celowniku, R obraca, klik odkłada, Esc wraca na stare miejsce.',
        en: 'Moving a base in 3D: aim at it and press G. The whole connected base hangs at the crosshair, R rotates, a click drops it, Esc puts it back.',
      },
      {
        pl: 'Budowle: lista baz w projekcie (zakładka w 2D i w menu Esc) z liczbą elementów i wysokością. W 2D przybliża i zaznacza, w 3D przenosi albo teleportuje, w obu usuwa.',
        en: 'Builds: a list of the bases in the project (a tab in 2D and in the Esc menu) with piece counts and height. In 2D it zooms and selects, in 3D it moves or teleports, both can delete.',
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
