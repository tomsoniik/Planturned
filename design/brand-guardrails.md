# Brand guardrails: Untmatica

Status: projekt do akceptacji (2026-10-21). Tokeny w kodzie: `src/app/globals.css` (`:root`). Ten plik i tokeny muszą się zgadzać 1:1.
Motyw: **tylko ciemny**. Edytor jest ciemnym płótnem, strona i edytor mają jeden wygląd.

## 1. Kolory

Kontrast liczony wzorem WCAG 2.1 dla tekstu na danym tle.

| Token | HEX | Rola | Kontrast (na czym) |
| --- | --- | --- | --- |
| `--bg` | #0B100C | Tło strony | - |
| `--surface` | #111813 | Karty, panele | - |
| `--surface-2` | #172019 | Pola, hover na ciemnym, karty w karcie | - |
| `--surface-3` | #202B22 | Aktywna zakładka, klawisze, ikona w kafelku | - |
| `--canvas` | #0E140F | Płótno planu 2D i miniatury | - |
| `--line` | rgb(214 236 205 / 0.08) | Obramowanie domyślne, podziały | - |
| `--line-strong` | rgb(214 236 205 / 0.16) | Obramowanie kart na filmie, pól, przycisków ghost | - |
| `--text` | #E9EFE4 | Tekst główny | 16,4:1 na `--bg`, 12,5:1 na `--surface-3` |
| `--muted` | #9AA894 | Tekst drugorzędny, opisy | 7,7:1 na `--bg`, 7,2:1 na `--surface`, 5,9:1 na `--surface-3` |
| `--faint` | **#808F78** (było #66745F) | Drobny tekst pomocniczy: daty, podpisy, drobny druk | 5,6:1 na `--bg`, 5,3:1 na `--surface`, 4,9:1 na `--surface-2`. **Nie używać na `--surface-3`** (4,3:1) |
| `--accent` | #8DC46F | Akcent: CTA, numery wersji, aktywne stany, focus | 9,4:1 na `--bg` (jako tekst) |
| `--accent-hover` | #A2D486 | CTA po najechaniu | - |
| `--accent-ink` | #0D1A08 | Tekst na przycisku w kolorze akcentu | 8,8:1 na `--accent`, 10,5:1 na `--accent-hover` |
| `--accent-soft` | rgb(141 196 111 / 0.13) | Tło etykiet ("Najnowsza", "Panel"), włączone przełączniki | - |
| `--danger` | #E5484D | Tylko akcje niszczące i błędy | 4,9:1 na `--bg` jako tekst. **Biały tekst na `--danger` ma 3,9:1: nie robić przycisków z białym napisem na czerwonym tle** |
| sukces | = `--accent` | Komunikat "Zapisano" | jak akcent |
| `--danger-text` | #F2A7A9 | Tekst błędu na czerwonawym tle komunikatu (panel admina, formularze) | - |
| `--warn-text` / `--warn-rgb` | #ECD29A na rgb(229 180 72 / 0.08) | Ostrzeżenie: tylko panel admina (brak bazy) | - |

**Warstwa nad filmem w tle** (jedyne uzasadnione półprzezroczyste tło): `rgb(17 24 19 / 0.72-0.80)` + `backdrop-filter: blur(12px)`. Służy czytelności nad ruchomym obrazem, nie dekoracji.

## 2. Typografia

- **Font tekstu i nagłówków:** Geist (`--font-sans`), przez `next/font`.
- **Font techniczny:** Geist Mono (`--font-mono`): numery wersji, liczby w licznikach, klawisze (`kbd`), kody.
- **Grubości:** 400 tekst, 500 przyciski i etykiety, 600 nagłówki. Bez 700+.
- **Najmniejszy tekst na stronach:** 12 px. Wyjątek: HUD edytora 3D i nasadki klawiszy (11 px).

| Poziom | Token | Mobile | Desktop | Interlinia | Tracking |
| --- | --- | --- | --- | --- | --- |
| Display (H1 strony głównej) | `--text-display` | 38 px | 64 px | 1,04 | -0,04em |
| H1 podstron | `--text-h1` | 36 px | 48 px | 1,05 | -0,035em |
| H2 sekcji | `--text-h2` | 28 px | 40 px | 1,1 | -0,03em |
| H3 (tytuł karty) | `--text-h3` | 20 px | 20 px | 1,3 | -0,015em |
| H4 | `--text-h4` | 17 px | 17 px | 1,35 | -0,01em |
| Lead (podtytuł hero) | `--text-lead` | 16 px | 18 px | 1,55 | 0 |
| Body | `--text-body` | 15 px | 15-16 px | 1,6 | 0 |
| UI (przyciski, linki, pola) | `--text-ui` | 14 px | 14 px | 1,4 | 0 |
| Small | `--text-small` | 13 px | 13 px | 1,5 | 0 |
| Micro (drobny druk, etykiety) | `--text-micro` | 12 px | 12 px | 1,5 | 0 |

Nagłówki max 2 linie na desktopie (`text-wrap: balance`), opisy max 65 znaków w linii.

## 3. Odstępy

- **Skala:** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 (tokeny `--space-1` ... `--space-10`). Nowy kod używa tylko tych wartości. Wyjątek: 2 px i 6 px wewnątrz drobnych kontrolek (klawisze, ikony).
- **Między sekcjami strony głównej:** 96 px desktop / 64 px mobile.
- **Odstęp hero od góry:** 112 px desktop / 96 px mobile (pasek 64 px nachodzi na hero).
- **Kontener:** `.wrap`, max 1240 px, margines boczny 24 px (desktop) / 16 px (mobile). Tekst ciągły max 68ch.
- **Odstęp kart w siatce:** 12 px.

## 4. Promienie, cienie, obramowania

- **Promienie:** `--r-sm` 6 px (przyciski, pola, klawisze, etykiety), `--r-md` 8 px (karty, panele, scena 3D, kafelki). Koło (50%) tylko dla avatarów i kropek stanu. Innych wartości w nowym kodzie nie używać (stare 4, 10, 12 px do ujednolicenia przy okazji).
- **Obramowania:** 1 px. `--line` domyślnie, `--line-strong` dla kart nad filmem i elementów interaktywnych. Przerywana (dashed) **tylko** dla kafelków "utwórz" i "upuść plik".
- **Cienie:** tylko dla elementów, które naprawdę unoszą się nad treścią: scena 3D na stronie głównej, menu rozwijane, powiadomienia. Wzór: `0 30px 60px rgb(4 8 5 / 0.5)`, opcjonalnie zielony cień pod sceną `0 40px 120px -40px rgb(141 196 111 / 0.22)`. Karty i przyciski bez cieni.

## 5. Komponenty

| Komponent | Wygląd | Hover | Focus | Active | Disabled |
| --- | --- | --- | --- | --- | --- |
| Przycisk główny `.btn.btn-primary` | tło `--accent`, tekst `--accent-ink`, 40 px (lg 48 px), `--r-sm`, 14/15 px, 500 | tło `--accent-hover` | obrys 2 px `--accent`, odstęp 2 px | `scale(0.98)` | opacity 0,5, kursor `not-allowed`, bez hover |
| Przycisk drugorzędny `.btn.btn-ghost` | przezroczysty, obrys `--line-strong`, tekst `--text` | tło `--surface-2` | jak wyżej | `scale(0.98)` | jak wyżej |
| Przycisk ikonowy `.icon-btn` | 34x34, przezroczysty, ikona `--muted` | tło `--surface-2`, ikona `--text` | jak wyżej | - | jak wyżej. Wariant `.danger`: hover czerwony |
| Link w tekście | `--muted`, podkreślenie `--line-strong`, odstęp 3 px | `--text` | jak wyżej | - | - |
| Link w pasku / stopce | `--muted`, bez podkreślenia, min. 24 px wysokości | `--text` | jak wyżej | - | - |
| Karta | `--surface` (nad filmem: warstwa z sekcji 1), obrys `--line-strong`, `--r-md`, padding 24-32 px | obrys jaśniejszy (0,28) | - | - | - |
| Kafelek "utwórz / upuść" | jak karta, obrys przerywany; wariant "utwórz" z zielonym odcieniem i ikoną w zielonym kwadracie | jaśniejsze tło i obrys | jak przycisk | `scale(0.99)` | - |
| Pole `.input` | 36 px, `--surface-2`, obrys `--line-strong`, `--r-sm`, 14 px | - | obrys `--accent` | - | opacity 0,5 |
| Nawigacja | 64 px wysokości, logo + linki + PL/EN + przycisk główny; nad filmem przezroczysta z gradientem, na zwykłych stronach `rgb(11 16 12 / 0.84)` + blur. Na mobile linki w menu (do zrobienia, audyt) | - | - | - | - |
| Etykieta | `--accent-soft`, tekst `--accent`, 12 px, 500, `--r-sm` | - | - | - | - |

Focus zawsze widoczny (`:focus-visible`, 2 px `--accent`). Animacje tylko `transform` i `opacity`, krzywa `--ease`, 0,2-0,8 s; przy `prefers-reduced-motion` wyłączone.

## 6. Ton komunikacji

1. **Mów jak gracz do gracza, na "ty".** Krótko i konkretnie.
2. **Nazywaj rzeczy jak w grze:** skybase, łóżko, claim, raid, filar, ściana, mapa Washington. Bez tłumaczenia na język biura.
3. **Najpierw korzyść, potem funkcja.** "Sprawdź, czy baza zmieści się pod limitem wysokości", a nie "Zaawansowany moduł walidacji".
4. **Bez marketingowych ozdobników i wymyślonych liczb.** Żadnych "rewolucyjnych", "nowej generacji", "tysięcy graczy".
5. **Komunikaty w aplikacji mówią, co się stało i co zrobić.** "Ten plik nie wygląda na projekt bazy", a nie "Błąd 400".

- Dobrze: "Narysuj bazę w 2D, potem przejdź się po niej w 3D na prawdziwej mapie."
- Źle: "Odkryj innowacyjne rozwiązanie do planowania nowej generacji dla wymagających graczy."

## 7. Zdjęcia, ikony, ilustracje

- **Zrzuty:** tylko prawdziwe zrzuty z aplikacji (planer 2D, sandbox 3D, mapy). Bez makiet z divów i bez wymyślonego UI.
- **Klimat gry:** oficjalny zwiastun Unturned z YouTube jako tło (embed, film zostaje na YouTube), ustawiany w `/admin`. Zawsze pod ciemną warstwą.
- **Grafiki z gry w repo:** tylko te, które da się legalnie użyć; źródło podpisane w stopce lub README.
- **Ikony:** Phosphor, waga `bold`, 16 px (przyciski), 18-20 px (kafelki), jedna rodzina w całym projekcie.
- **Znak:** kostka pół-blok, pół-hologram (`public/art/logo-mark.png`), favicon `src/app/icon.png`.
- **Unikać:** zdjęć stockowych, obrazków AI z zombie, emoji, ilustracji kreskówkowych, neonowych poświat.

## 8. Konkurencja (skrót)

Szczegóły w `competitors.md`. Jedynym realnym konkurentem jest Housing Planner w samej grze. Odróżniamy się: przeglądarka zamiast gry, plan 2D + 3D na prawdziwej mapie, limity z gry przed budową, plik dla ekipy, bez konta.

## 9. NIE RÓB

- Jasnego motywu i sekcji, które nagle zmieniają tło na jasne.
- Drugiego koloru akcentu (niebieskiego, fioletowego, pomarańczowego). Czerwony tylko dla błędów i usuwania.
- Gradientów w tekście, neonowych poświat, fioletu.
- Przycisków z białym tekstem na czerwonym tle (za słaby kontrast).
- `--faint` na `--surface-3` i tekstu mniejszego niż 12 px na stronach.
- Trzech identycznych kart w rzędzie jako domyślnej sekcji funkcji.
- Wymyślonych liczb graczy, opinii, logotypów "partnerów".
- Pobierania i hostowania cudzych filmów; tylko embed.
- Ikon z innych bibliotek niż Phosphor i ręcznie rysowanych ikon SVG.
- Promieni innych niż 6 i 8 px w nowym kodzie.
