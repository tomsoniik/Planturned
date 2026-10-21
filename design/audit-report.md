# Audyt: Untmatica (base-planner-unturned.vercel.app)

Data: 2026-10-21. Sprawdzone strony: `/`, `/builder` (Moje projekty), `/changelog`. Panel `/admin` i edytor bazy (`/builder/[id]`) poza zakresem.
Metoda: Chrome przez DevTools na produkcji, desktop 1440x900 i mobile 375x812, automatyczne sprawdzenia (nagłówki, alty, nazwy przycisków, meta, poziomy scroll, konsola, transfer) + ręczna ocena zrzutów + kontrast policzony wzorem WCAG.
Nie sprawdzone: Lighthouse (brak narzędzia), odtwarzanie filmu w tle (headless Chrome nie gra YouTube), działanie na prawdziwym telefonie.

## Podsumowanie

Strona jest technicznie czysta: zero błędów w konsoli, brak poziomego scrolla, jeden H1 na stronę, obrazki z altami, poprawne meta i favicon, szybkie ładowanie (0,4-0,9 s, około 720 KB strony głównej). Hero w 5 sekund mówi, co to jest i co kliknąć. Największa słabość to treść strony głównej: pokazuje tylko gotową bazę w 3D, a nie to, co narzędzie robi (rysowanie w 2D, prawdziwe mapy, limity z gry, eksport dla ekipy), więc nowa osoba nie wie, czym Untmatica różni się od budowania "na oko" w grze. Do poprawy jest też kontrast drobnego szarego tekstu, brak obrazka przy udostępnianiu linku (Discord) i ukryte linki w menu na telefonie.

## Ocena ogólna

| Kategoria | Ocena | Komentarz |
| --- | --- | --- |
| Pierwsze wrażenie | 7/10 | Jasny nagłówek i CTA. Tło (zwiastun gry) jest efektowne, ale nie pokazuje produktu. |
| Hierarchia i układ | 7/10 | Czytelny hero, ale strona główna kończy się po jednym ekranie. Scena 3D to duży pusty prostokąt z małą bazą. |
| Typografia | 8/10 | Geist + Geist Mono, dobra skala, nagłówki w 2 liniach. |
| Kolory i spójność | 8/10 | Jeden akcent (zieleń), spójny ciemny motyw na wszystkich stronach. |
| CTA | 8/10 | Jedno główne CTA, wyraźne. "Nowy projekt" jest dwa razy na ekranie (pasek + hero), akceptowalne. |
| Treści | 5/10 | Konkretne, bez ogólników, ale za mało: brak opisu funkcji, zrzutów planera 2D, map. |
| Responsywność | 7/10 | Bez poziomego scrolla, układy się składają. Na telefonie znikają linki w pasku. |
| Dostępność | 6/10 | Alty i nazwy są, focus jest. Kontrast drobnego tekstu poniżej AA, małe cele kliknięcia w linkach. |
| Wydajność i technika | 8/10 | 0 błędów konsoli, szybki load. Film z YouTube to dodatkowy ciężar na 3 stronach, także na telefonie. |
| Zaufanie | 5/10 | Changelog pokazuje, że projekt żyje, GitHub w stopce. Brak zrzutów, opinii społeczności, Discorda, autora. |

## Problemy krytyczne

Brak. Nic nie blokuje korzystania ze strony.

## Problemy ważne

1. **[WAŻNY] Strona główna nie pokazuje, co narzędzie umie** → Nowa osoba widzi jedno zdanie i bazę 3D. Nie wie o planerze 2D, prawdziwych mapach 1:1, limitach z gry (wysokość, tlen, strefy zakazu), promieniu łóżka, eksporcie dla ekipy. To są główne powody, żeby użyć Untmatiki zamiast budować w grze → Pod hero dodać 3-4 sekcje funkcji z prawdziwymi zrzutami z aplikacji (planer 2D, sandbox na mapie, limity, eksport), każda z jednym zdaniem korzyści. Treści są już w README.

2. **[WAŻNY] Brak obrazka przy udostępnianiu linku** → Link wklejony na Discordzie lub Twitterze pokaże sam tekst, bez obrazka (brak `og:image`, karta `summary`). Dla narzędzia, które żyje z poleceń w ekipach, to strata kliknięć → Ustawić obrazek 1200x630 (logo + zrzut bazy) w panelu `/admin` (Linki i SEO) albo dodać `opengraph-image` w kodzie.

3. **[WAŻNY] Kontrast drobnego szarego tekstu poniżej WCAG AA** → Kolor `--faint` (#66745f) ma 3,87:1 na tle strony i 3,63:1 na kartach, a minimum to 4,5:1. Dotyczy: podpisu pod sceną 3D, dat w changelogu, drobnego druku w stopce (12-13 px). Słabiej widzący i ekrany w słońcu tego nie przeczytają → Rozjaśnić `--faint` do około #7d8c75 (sprawdzić, że wychodzi min. 4,5:1) albo użyć `--muted` (7,7:1) dla tekstu, który trzeba przeczytać.

4. **[WAŻNY] Na telefonie znikają linki "Moje projekty" i "Changelog" z paska** → Na 375 px w pasku zostaje tylko logo, PL/EN i "Nowy projekt". Do changelogu można dojść tylko przez stopkę, a z listy projektów (bez stopki) wcale → Dodać menu (ikona) na telefonie albo pokazać "Moje projekty" jako ikonę. Na liście projektów dodać stopkę.

5. **[WAŻNY] Film z YouTube ładuje się na każdej z 3 stron, także na telefonie** → Skrypty i strumień YouTube to zwykle ponad 1 MB i praca procesora na każdej stronie, na telefonie zjada dane i baterię. Na liście projektów i w changelogu film nie wnosi treści → Na telefonach (np. poniżej 768 px) pokazywać tylko poster. Rozważyć film tylko na stronie głównej, a na pozostałych sam poster.

## Problemy drobne

1. **[DROBNY] Scena 3D: mała baza w dużym pustym polu** → Na desktopie baza zajmuje około 1/3 szerokości sceny, reszta to ciemna ziemia → Przybliżyć kamerę na stronie głównej albo zmniejszyć wysokość sceny (np. 16:6).
2. **[DROBNY] Tło hero nie mówi o produkcie** → Postacie ze zwiastuna stoją za nagłówkiem. Klimat gry jest, produktu nie → Ok jako tło, ale zrzuty z aplikacji powinny pojawić się zaraz pod hero (patrz problem ważny 1).
3. **[DROBNY] Małe cele kliknięcia** → Linki w pasku i stopce mają 22 px wysokości, link "Film w tle na YouTube" 16 px (WCAG 2.2 zaleca min. 24 px) → Dodać pionowy padding 4-6 px.
4. **[DROBNY] Lista projektów ma tytuł karty jak strona główna** → `Untmatica - planer baz do Unturned` zamiast `Moje projekty - Untmatica` → Dodać `generateMetadata` jak w changelogu.
5. **[DROBNY] Długi changelog na telefonie** → 14 wersji rozwiniętych, prawie 8000 px przewijania → Rozwinięte 3 najnowsze, starsze zwinięte (rozwiń po kliknięciu).
6. **[DROBNY] Brak `canonical`** → Przy kilku adresach Vercela Google może indeksować duplikaty → Ustawić `metadataBase` i `alternates.canonical`.

## Quick wins (poprawki do zrobienia w 1 dzień)

- Rozjaśnić `--faint` do min. 4,5:1 (jedna zmienna w `globals.css`).
- Obrazek OG 1200x630 i karta `summary_large_image`.
- Tytuł strony "Moje projekty".
- Poster zamiast filmu na telefonie.
- Padding linków w pasku i stopce do 24 px wysokości.
- Menu na telefonie (albo chociaż link do changelogu w pasku).

## Rekomendacje na redesign

Strona główna jest dobrym hero bez reszty strony. Zamiast przebudowy od zera warto dobudować pod hero:
1. Sekcję "Jak to działa" w 3 krokach z prawdziwymi zrzutami: rysujesz w 2D, sprawdzasz w 3D na mapie, wysyłasz plik ekipie.
2. Sekcję funkcji w nierównej siatce: prawdziwe mapy, limity z gry, promień łóżka, sterowanie jak w grze.
3. Pas zaufania: changelog (ostatnia wersja i data), GitHub, ewentualnie Discord, gdy powstanie.
4. Końcowe CTA "Nowy projekt" przed stopką.

Zrzuty powinny pochodzić z samej aplikacji, bez makiet z divów i bez wymyślonych liczb.
