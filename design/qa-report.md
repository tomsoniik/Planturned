# QA: Untmatica

Ostatnia runda: 2026-10-22. Wersja lokalna (dev server), jeszcze niewdrożona.
Strony: `/`, `/builder`, `/changelog`, `/admin` (ekran logowania). Szerokości: 375, 768, 1024, 1440.
Metoda: Chrome przez DevTools (automatyczne sprawdzenia + zrzuty), `tsc`, `eslint`, curl dla linków i obrazów, kontrast liczony wzorem WCAG.

## Stan etapu 5

| Sekcja z wireframe | Stan |
| --- | --- |
| 1. Hero | zbudowana (niższa scena, kamera bliżej, tokeny) |
| 2. Od szkicu do bazy na mapie | **zbudowana w rundzie 2** (3 kroki z prawdziwymi zrzutami z aplikacji) |
| 3. Zasady z gry (4 kafelki) | **zbudowana w rundzie 3** (prawdziwe podglądy 6 map, skala 1024 m / 524,8 m z plików map, kadr z okręgiem łóżka, klawisze i komenda) |
| 4. Bez konta (pas z faktami) | **zbudowana w rundzie 3** (4 fakty + najnowsza wersja z CMS) |
| 5. Końcowe CTA | **zbudowana w rundzie 3** |

Poza wireframe: changelog przebudowany (post u góry + lista wszystkich wersji, adres `?v=`, przyciski Nowsza/Starsza bez przewijania).

## Checklista (runda 2)

| Punkt | Wynik | Jak sprawdzone |
| --- | --- | --- |
| Zgodność z guardrails | OK | nowy CSS sekcji tylko na tokenach (0 kolorów, promieni i rozmiarów na sztywno); kolory błędu/ostrzeżenia w panelu jako tokeny |
| 375 / 768 / 1024 / 1440, brak poziomego scrolla | OK | 16 kombinacji strona x szerokość |
| Linki i przyciski | OK | wewnętrzne 200, logowanie 307, zewnętrzne 200; changelog: przyciski Nowsza/Starsza nie przewijają strony (pozycja 260 px przed i po), wiersz listy przewija do posta |
| Hover / focus / active | OK | globalny `:focus-visible`; nowe elementy to linki i obrazy bez własnych `outline: none` |
| Kontrast AA | OK | `--faint` 5,6:1, `--muted` 7,7:1, tekst 16,4:1 |
| Jeden H1, kolejność nagłówków, alty | OK | strona główna: H1 → H2 "Od szkicu do bazy na mapie" → 3x H3; 0 obrazków bez alt (zrzuty mają opisowe alty PL/EN) |
| Formularze | OK | błędny plik na liście projektów: komunikat, lista działa (runda 1); bez zmian w formularzach |
| Konsola | OK | 0 błędów na 16 kombinacjach |
| Obrazki i fonty | OK | zrzuty WebP: 29 KB, 21 KB, 5 KB, `loading="lazy"`, wymiary podane; OG 258 KB; fonty `next/font` |
| Literówki, placeholdery | OK | brak `[DO UZUPEŁNIENIA]`; teksty PL i EN sekcji sprawdzone na stronie w obu językach |
| Meta | OK | osobne tytuły stron, opis, favicon, `og:image` + `summary_large_image` na każdej stronie |
| Cele kliknięcia min. 24 px | OK | 0 zgłoszeń (runda 1: 7, poprawione) |
| TypeScript, ESLint | OK dla zmienionych plików | `tsc` bez błędów; 4 stare błędy ESLint w `Builder3D.tsx` (edytor, poza zakresem) |

## Poprawione (runda 1)

1. [WAŻNY] Obrazek przy udostępnianiu: `public/og.png`, karta `summary_large_image`, `metadataBase`.
2. [WAŻNY] Menu na telefonie: linki i PL/EN pod przyciskiem, wiersze 49 px, pełne tło.
3. [WAŻNY] Film na telefonie: tylko poster.
4. [DROBNY] Cele kliknięcia 24 px, tytuł "Moje projekty", tokeny kolorów w panelu.

## Poprawione (runda 2)

1. [WAŻNY, z audytu] Strona główna nie pokazywała, co narzędzie robi: dodana sekcja "Od szkicu do bazy na mapie" z prawdziwymi zrzutami (planer 2D na Washington, Sandbox 3D z obiektami mapy, lista projektów z eksportem).
2. [DROBNY, z audytu] Długi changelog: 4964 → 1656 px na desktopie, 7985 → 1728 px na telefonie.

## Runda 3 (2026-10-22, przed deployem)

- 16 kombinacji strona x szerokość: 0 problemów (poziomy scroll, konsola, alty, nazwy, cele kliknięcia, 1 H1).
- Nagłówki strony głównej: H1 → H2 "Od szkicu…" (3x H3) → H2 "Wiesz, co przejdzie…" (4x H3) → H2 końcowe CTA.
- Obrazy nowych sekcji wczytują się (`complete`, pełna szerokość); mapy 4-19 KB, kadr łóżka 12 KB.
- Poprawione w trakcie: kolor linii limitu (czerwień zarezerwowana dla błędów), liczba formatowana w języku strony, karta CTA wyrównana do kontenera, mniejsze klawisze na 375 px.

## Co zostało

| Priorytet | Problem | Uwagi |
| --- | --- | --- |
| DROBNY | Brak `canonical` | per strona przez `alternates.canonical` |
| DROBNY | 4 błędy ESLint w `Builder3D.tsx` | kod edytora sprzed tej pracy |
| INFO | Waga strony w dev 4-8 MB | tryb deweloperski; sprawdzić po deployu (przed zmianami produkcja: ok. 720 KB) |
| INFO | Odtwarzanie filmu, logowanie GitHub, zapis w panelu | do ręcznego sprawdzenia na produkcji |
