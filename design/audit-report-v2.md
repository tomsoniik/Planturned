# Audyt: Untmatica po przebudowie (base-planner-unturned.vercel.app)

Data: 2026-10-22. Wersja produkcyjna po deployu `e5407e9`. Poprzedni audyt (przed przebudową): `audit-report.md`.
Strony: `/`, `/builder`, `/changelog`. Panel `/admin` i edytor bazy poza zakresem (wymagają logowania / projektu).
Metoda: Chrome przez DevTools na produkcji (desktop 1440, laptop 1024, tablet 768, mobile 375), automatyczne sprawdzenia (nagłówki, alty, nazwy, cele kliknięcia, poziomy scroll, konsola, transfer), zrzuty całej strony, kontrast liczony wzorem WCAG (dla tekstu na filmie: piksele tła spod tekstu na zrzutach), curl dla `robots.txt`, `sitemap.xml`, nagłówków.
Nie sprawdzone: Lighthouse (brak narzędzia), odtwarzanie filmu (headless Chrome nie gra YouTube), logowanie i zapis w panelu.

## Podsumowanie

Strona po przebudowie robi to, czego brakowało: w kilka sekund mówi, co to jest, a pod hero pokazuje, jak działa narzędzie, na prawdziwych zrzutach i prawdziwych danych z gry (mapy, limit 1024 m, granica tlenu, zasięg łóżka). Technicznie jest czysto: zero błędów konsoli, brak poziomego scrolla w 4 szerokościach, jeden H1 i poprawna kolejność nagłówków, strona główna ok. 780 KB i ładowanie poniżej sekundy. Najważniejsze do poprawy: podtytuł w hero traci czytelność, gdy za nim przelatuje jasny fragment filmu, film spowalnia listę projektów, a zrzuty z aplikacji są tylko po polsku i wyglądają słabiej niż sama gra (renderowane bez karty graficznej). Brakuje też śladu społeczności (np. Discorda), który przekonałby nowego gracza.

## Ocena ogólna

| Kategoria | Przed (21.10) | Teraz | Komentarz |
| --- | --- | --- | --- |
| Pierwsze wrażenie | 7 | 8 | Jasny nagłówek, CTA i obracana baza; film daje klimat gry |
| Hierarchia i układ | 7 | 8 | Logiczna kolejność: hero, jak to działa, zasady z gry, bez konta, CTA. Kafelek map ma pustą przestrzeń |
| Typografia | 8 | 8 | Geist + Geist Mono, skala z tokenów, nagłówki max 2-3 linie |
| Kolory i spójność | 8 | 8 | Jeden akcent, ciemny motyw na wszystkich stronach |
| CTA | 8 | 9 | "Nowy projekt" w pasku, hero i na końcu, jedna nazwa dla jednej intencji |
| Treści | 5 | 8 | Konkretne funkcje i prawdziwe liczby z plików gry, zero ogólników |
| Responsywność | 7 | 9 | Menu na telefonie, siatki składają się do 1 kolumny, brak poziomego scrolla |
| Dostępność | 6 | 7 | Alty, nazwy, cele 24 px, focus OK; kontrast tekstu na filmie zmienny |
| Wydajność i technika | 8 | 8 | 780 KB / 0,5-1 s na głównej; film spowalnia podstrony; brak robots i sitemap |
| Zaufanie | 5 | 6 | Aktualny changelog na stronie, GitHub; brak społeczności i informacji o autorze |

## Problemy krytyczne

Brak.

## Problemy ważne

1. **[WAŻNY] Podtytuł w hero traci kontrast na jasnych klatkach filmu** → Mediana tła pod tekstem daje 5,8:1, ale w najjaśniejszych 5% (np. biała czapka postaci w zwiastunie) kontrast spada do ok. 2:1 (desktop 2,2:1, telefon 1,9:1, minimum to 4,5:1). Ktoś trafi na moment, gdy podtytuł znika → Mocniejsza ciemna warstwa pod blokiem tekstu (np. radialna 0,7 zamiast 0,5) albo podtytuł w kolorze `--text` z delikatnym cieniem tekstu. Cel: min. 4,5:1 także na jasnych klatkach.

2. **[WAŻNY] Film w tle spowalnia listę projektów i changelog** → Na desktopie `/builder` kończy ładowanie po 3,4 s, na telefonie (bez filmu) po 0,45 s. Na liście projektów gracz chce od razu pracować, a w changelogu czytać; ruch w tle nic tam nie wnosi → Film tylko na stronie głównej, na podstronach nieruchomy kadr (poster).

3. **[WAŻNY] Zrzuty w "Jak to działa" są słabsze od samej aplikacji i tylko po polsku** → Satelita w planerze jest rozmyta (przybliżenie 144%), Sandbox ma szare niebo i płaskie światło (zrzut z programowego renderera, bez karty graficznej), trzeci zrzut ma dużo pustego miejsca. Angielska wersja strony pokazuje polski interfejs ("Baza w parku", "Parter"). To pierwsze zdjęcia produktu, jakie widzi gracz → Nowe zrzuty na prawdziwej karcie graficznej (pora dnia z cieniami, ostra satelita w 100%), trzeci kadr bliżej karty i przycisku eksportu, osobny komplet zrzutów z angielskim interfejsem dla wersji EN.

4. **[WAŻNY] Brak śladu społeczności i autora** → Nowy gracz nie widzi, że ktoś z tego korzysta ani kto za tym stoi (autor tylko jako "tomson" w drobnym druku). Liczb i opinii nie wolno wymyślać → [DO UZUPEŁNIENIA: link do Discorda / serwera / kanału, jeśli istnieje] w pasku "Bez konta" i w stopce; krótka linijka o autorze (np. "Robi to tomson, gracz Unturned") z linkiem do GitHuba.

## Problemy drobne

1. **[DROBNY] Brak `robots.txt`, `sitemap.xml` i `favicon.ico`** (404) → Google i część przeglądarek o nie pyta → `app/robots.ts`, `app/sitemap.ts` (/, /builder, /changelog), `app/favicon.ico` z obecnej ikony.
2. **[DROBNY] Brak `canonical`** → Kilka adresów Vercela może być indeksowanych jak duplikaty → `alternates.canonical` per strona.
3. **[DROBNY] Pusta przestrzeń w kafelku map** → Na desktopie kafelek zajmuje 2 rzędy, miniatury są u góry, opis na dole, środek pusty → Większe miniatury (2 kolumny) albo mapy wyśrodkowane w pionie.
4. **[DROBNY] Ucięty tytuł wersji w pasku "Bez konta"** → "Nowa strona główna i panel, 22 paźdz…" → Tytuł i data w osobnych liniach, bez wielokropka.
5. **[DROBNY] Pas "Bez konta" ma etykietę dla czytnika ekranu złożoną z 4 faktów** → Czytnik odczyta długi ciąg zamiast nazwy sekcji → Ukryty nagłówek H2 "Bez konta" (`sr-only`) zamiast `aria-label`.
6. **[DROBNY] Lista projektów nie ma stopki** → Na stronie głównej i w changelogu jest, na liście projektów nie → Dodać `SiteFooter` albo świadomie zostawić (strona robocza) i zapisać to w guardrails.

## Quick wins (poprawki do zrobienia w 1 dzień)

- Mocniejsza warstwa pod tekstem hero (jedna reguła CSS w `HeroVideo.module.css`).
- Film tylko na stronie głównej (prop w `HeroVideo`, na podstronach sam poster).
- `robots.ts`, `sitemap.ts`, `favicon.ico`, `canonical`.
- Tytuł wersji w dwóch liniach i `sr-only` H2 w pasku "Bez konta".
- Większe miniatury w kafelku map.

## Rekomendacje na kolejny krok

1. **Zrzuty na prawdziwej karcie graficznej, w dwóch językach.** Największy wpływ na wrażenie: pokazujemy grę, więc zrzuty muszą wyglądać jak gra. Zrobić je w Twojej przeglądarce (np. pora dnia "Zmierzch", ten sam park w Washington) i podmienić w `public/home`, osobno dla PL i EN.
2. **Społeczność.** Jeśli powstanie Discord albo kanał, dodać go jako link w panelu `/admin` (Linki i SEO) i jako jeden fakt w pasku "Bez konta". Gdy pojawią się prawdziwe opinie graczy, krótka sekcja z 2-3 cytatami (z nickiem i serwerem) przed końcowym CTA.
3. **Galeria przykładowych baz.** Pomysł z konkurencji (RustBaseDesign): 3-4 gotowe bazy do wczytania jednym kliknięciem (skybase, baza na wyspie, bunkier). Daje szybki start bez rysowania od zera.

## Status poprawek (2026-10-22, po audycie)

| Problem | Stan | Dowód |
| --- | --- | --- |
| [WAŻNY] Kontrast podtytułu na filmie | poprawione | mocniejsza warstwa pod tekstem + jaśniejszy podtytuł z cieniem; jasne tło (95. percentyl) daje teraz 6,8-8,9:1 (było 4,2-6,1:1) |
| [WAŻNY] Film spowalnia podstrony | poprawione | lista projektów i changelog: tylko kadr (`still`); `/builder` desktop 0,64 s (było 3,4 s na produkcji) |
| [WAŻNY] Zrzuty słabe i tylko PL | częściowo | komplet PL i EN w 16:10 (interfejs w języku strony), eksport pokazany w menu projektu; zrzuty nadal z programowego renderera, lepsze wymagają prawdziwej karty graficznej |
| [WAŻNY] Brak społeczności i autora | otwarte | [DO UZUPEŁNIENIA: link do Discorda / kanału], bez wymyślania |
| [DROBNY] robots, sitemap, favicon.ico | poprawione | `/robots.txt`, `/sitemap.xml`, `/favicon.ico` zwracają 200 |
| [DROBNY] canonical | poprawione | `/`, `/builder`, `/changelog` mają `<link rel="canonical">` |
| [DROBNY] Pusta przestrzeń w kafelku map | nieaktualne | sekcja zastąpiona oknem funkcji |
| [DROBNY] Ucięty tytuł wersji | poprawione | tytuł w osobnej linii, bez wielokropka |
| [DROBNY] Etykieta pasa "Bez konta" | poprawione | ukryty nagłówek H2 zamiast `aria-label` z listą |
| [DROBNY] Brak stopki na liście projektów | poprawione | `SiteFooter` pod listą |

Dodatkowo na prośbę: "Jak to działa" i "Zasady z gry" połączone w jedno okno (7 funkcji, zakładki, strzałki, klawiatura, przesunięcie palcem, automat co 7 s z paskiem postępu, wyłączany ręczną zmianą i przy ograniczonych animacjach). Sekcja ma 622 px zamiast ok. 2600 px.
