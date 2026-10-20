<p align="center">
  <img src="public/art/zombie.png" width="64" alt="" style="image-rendering: pixelated">
</p>

<h1 align="center">Planturned</h1>

<p align="center">
  Planer baz do <b>Unturned</b>. Rysujesz bazę w 2D, potem chodzisz po niej w 3D na prawdziwej mapie z gry.
  <br>
  <a href="https://base-planner-unturned.vercel.app"><b>Otwórz w przeglądarce</b></a>
</p>

<p align="center"><a href="README.md">English</a> · <b>Polski</b> · <a href="https://base-planner-unturned.vercel.app/changelog">Changelog</a></p>

<p align="center">
  <img src="docs/demo.gif" alt="Demo: nowy projekt, podłogi, ściany, okna, drzwi, filary i dach w 2D, potem baza w 3D w dzień, o zmierzchu i w nocy" width="100%">
</p>

Nagranie pokazuje prawdziwą sesję w aplikacji: nowy projekt, 6 podłóg, ściany z oknami i drzwiami, filary w narożnikach, dach nad parterem i przejście do widoku 3D (dzień, zmierzch, noc).

## Co potrafi

- **Plan 2D jak w grze.** Podłogi, ściany, filary, dachy, schody i rampy z pięciu materiałów (klon, brzoza, sosna, metal, cegła). Ściany i filary same przyklejają się do krawędzi i narożników, kolizja jest widoczna od razu. Plan zajmuje cały ekran: na dole pasek 9 slotów, a `E` otwiera okno ze wszystkimi klockami (najpierw Wszystko, potem filtry kategorii) i dokiem materiałów.
- **Piętra.** Do czterech poziomów; niższe widać pod spodem jako tło.
- **Widok 3D jak w grze.** Oryginalne modele struktur z plików Unturned. Pełny ekran z paskiem 9 slotów i ekwipunkiem (`E`), latanie albo chodzenie, stawianie i wyburzanie z celownika.
- **Komendy na czacie.** `T` albo `/` otwiera czat: `/time night`, `/sky 150`, `/tp <x> <z>`, `/give metal_wall 3` i inne (`/help`). `Esc` otwiera menu ze sceną, mapą i klawiszami.
- **Prawdziwe mapy jako sandbox.** Russia, Washington, PEI, Germany, Yukon i inne: teren, satelita, budynki i drzewa w skali 1:1, oświetlenie z plików mapy. Start na spawnie z gry, budowanie gdziekolwiek: na ziemi i w powietrzu naraz. `M` pokazuje mapę z twoją pozycją, `Ctrl C` / `Ctrl V` w 3D kopiuje bazę w inne miejsce.
- **Limity z gry.** Maksymalna wysokość budowania, granica tlenu i strefy zakazu budowy dla każdej mapy ([docs/sky-limits.md](docs/sky-limits.md)).
- **Zasięg claimu łóżka.** Okrąg pokazuje, gdzie nikt spoza grupy nic nie postawi.
- **Bez konta.** Projekty zostają w przeglądarce. Bazę eksportujesz do pliku `.baseplan.json` i wysyłasz ekipie.
- **Własne klawisze.** Wybór elementów, wyburzanie, łóżko, obrót, piętra i ruch w 3D do zmiany w zakładce Skróty.
- **Polski i angielski.** Przełącznik PL / EN w menu i w edytorze; bez wyboru język bierze się z przeglądarki.

## Sterowanie

Klawisze można zmienić w zakładce **Skróty** w oknie pod `E` (zapis w przeglądarce). Domyślne:

| Klawisz | Plan 2D | Widok 3D |
| --- | --- | --- |
| `1`-`9` | slot paska | slot paska (kółko: następny slot) |
| `E` | okno: wszystkie klocki, budowle, kolor i skróty | ekwipunek: elementy do slotów paska |
| `T`, `/` | | czat z komendami, `/help` pokazuje listę |
| `M` | | mapa z twoją pozycją, klik teleportuje |
| `Ctrl C` / `Ctrl V` | kopiuj / wklej | kopiuj całą bazę / wklej w celowniku |
| `X` / `B` | wyburzanie / łóżko | wyburzanie / łóżko |
| `R` | obrót | obrót |
| `LPM` | postaw, zaznacz, przeciągnij | postaw albo wyburz w celowniku |
| `PPM`, kółko | przesuwanie, przybliżenie | |
| `PgUp` / `PgDn` | piętro wyżej / niżej | |
| `Shift` + klik | zaznacz kilka | |
| `Ctrl C` / `Ctrl V` | kopiuj / wklej (podgląd pod kursorem) | |
| `Ctrl Z` / `Ctrl Y` | cofnij / ponów | |
| `W A S D`, `Spacja`, `Q` | | ruch, w górę, w dół |
| `F` | | latanie albo chodzenie |
| `Esc` | odłóż element | menu: scena, mapa, klawisze, widok 2D |

## Technologie

[Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript, [three.js](https://threejs.org) z React Three Fiber i Drei, Zustand, Phosphor Icons. Hosting: [Vercel](https://vercel.com).

## Uruchomienie lokalne

```bash
npm install
npm run export:game   # jednorazowo: dane z lokalnej instalacji gry
npm run dev           # http://localhost:3000
```

Bez eksportu aplikacja też działa: struktury są wtedy prostymi bryłami, a okno wyboru mapy pokazuje instrukcję.

## Dane z gry

`npm run export:game` uruchamia `scripts/export_game_data.py`. Skrypt sam znajduje Unturned w bibliotekach Steam.
Ścieżkę można też podać ręcznie: `python scripts/export_game_data.py "D:\Steam\steamapps\common\Unturned"`.

Wymagania: Python 3.10+ oraz `pip install UnityPy numpy pillow`. Same tekstury terenu i drogi: `python scripts/export_game_data.py --terrain`. Same modele obiektów i drzew: `--scenery`.

Co powstaje (pliki gry, tylko do użytku lokalnego, są w `.gitignore`):

| Ścieżka | Źródło w grze |
| --- | --- |
| `public/game/structures.json` | modele 3D, kolory i wytrzymałość struktur (`Bundles/core.masterbundle`, `Bundles/Items/Structures/*.dat`) |
| `public/unturned/items/<id>.png` | ikony z [SilKsPlugins/UnturnedImages](https://github.com/SilksPlugins/UnturnedImages) (folder vanilla); brakujące są generowane z ikon tego samego kształtu |
| `public/maps/<Mapa>/height.bin` | wysokości terenu (`Maps/<Mapa>/Landscape/Heightmaps`, co 4 m) |
| `public/maps/<Mapa>/tiles/*.jpg` | satelita z gry (`Maps/<Mapa>/Map.png`) |
| `public/maps/<Mapa>/meta.json` | rozmiar mapy (`Level.dat`), poziom wody (`Environment/Lighting.dat`), limity wysokości i strefy zakazu budowy (`Level.hierarchy`) |
| `public/maps/<Mapa>/scene.json` | budynki, obiekty i drzewa 1:1 (`Level/Objects.dat`, `Terrain/Trees.dat`) |
| `public/game/scenery/<guid>.json` | modele obiektów i drzew (LOD0, kolory palety) |
| `public/maps/<Mapa>/splat_N.png`, `public/game/terrain/*.png` | tekstury podłoża i ich wagi co 4 m (`Landscape/Splatmaps`, materiały terenu z `Level.hierarchy`) |
| `public/maps/<Mapa>/roads.json`, `roads/*.png` | drogi odtworzone z `Environment/Paths.dat`, `Roads.dat`, `Roads.unity3d` |

Wymiary są zgodne z modelami gry: podłoga 6 × 6 m, poziom 4,5 m, ściana 5,6 × 4,25 m. W planie 1 m = 10 jednostek.

## Struktura

```
src/app/          strony: start, lista projektów, edytor /builder/[id]
src/components/   edytor 3D, wybór mapy, teren i obiekty
src/lib/          logika budowania, teren, modele z gry, projekty, tłumaczenia (i18n.ts)
src/store/        stan aplikacji (Zustand)
scripts/          eksport danych z instalacji gry
docs/             notatki o mechanice gry, nagranie demo
```

## Autor

**tomson** ([@tomsoniik](https://github.com/tomsoniik), [debskitomal@gmail.com](mailto:debskitomal@gmail.com))

Unturned to znak towarowy Smartly Dressed Games. Projekt fanowski, niezwiązany z twórcami gry. Dane z gry nie są częścią repozytorium; wyjątek to tło strony głównej w `public/art` (ekran ładowania z gry Washington Landscape, autor: Phobia) i znak zombie.
