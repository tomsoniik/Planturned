# Wireframe: strona główna Untmatica

Status: do akceptacji (2026-10-21). Podgląd szarych bloków: `design/wireframe.html`.
Zakres: tylko strona główna (`/`). Lista projektów i changelog zostają jak są.

## Główny cel strony

**Kliknięcie "Nowy projekt"** (start planowania bazy). Każda sekcja albo wyjaśnia, po co to robić, albo usuwa wątpliwość, która przed tym powstrzymuje.

Grupa docelowa: gracze Unturned (solo i ekipy), którzy budują bazy na serwerach, szczególnie skybase i bazy pod raidy.

## Sekcje

### 1. Pasek nawigacji (bez zmian)
- **Cel:** dostęp do projektów, changelogu, języka i szybki start.
- Logo + "Moje projekty", "Changelog", PL/EN, przycisk "Nowy projekt".
- Zmiana z audytu: na telefonie linki w menu (ikona), żeby changelog był osiągalny.

### 2. Hero (zostaje, drobne poprawki)
- **Cel:** w 5 sekund: co to jest, dla kogo, co kliknąć.
- **Nagłówek (H1):** "Zaplanuj bazę, zanim ją postawisz."
- **Treść:** "Planer baz do Unturned. Rysujesz w 2D, potem chodzisz po bazie w 3D na prawdziwej mapie z gry."
- **Wizual:** obracana baza 3D pod tekstem, tło: zwiastun gry. Poprawka z audytu: przybliżyć kamerę albo obniżyć scenę (16:6), żeby baza nie ginęła w pustym polu.
- **CTA:** "Nowy projekt" (główne), "Moje projekty" (drugorzędne).

### 3. Jak to działa (NOWA)
- **Cel:** pokazać narzędzie w akcji, zanim ktoś kliknie. Odpowiada na pytanie "a co tam właściwie robię?".
- **Nagłówek (H2):** "Od szkicu do bazy na mapie"
- **Układ:** tytuł po lewej przyklejony przy przewijaniu, po prawej 3 kroki jeden pod drugim, każdy ze zrzutem z aplikacji. Na telefonie: tytuł, potem kroki w kolumnie.
- **Kroki (nazwa = czynność, bez numeracji "Krok 1"):**
  1. **Narysuj w 2D.** "Podłogi, ściany, filary i dachy z pięciu materiałów. Ściany same łapią krawędzie, kolizję widać od razu." Wizual: zrzut planera 2D z piętrami.
  2. **Przejdź się w 3D.** "Oryginalne modele z gry na prawdziwej mapie. Chodzisz albo latasz, stawiasz i burzysz z celownika." Wizual: zrzut Sandboxu na mapie.
  3. **Wyślij ekipie.** "Eksportujesz bazę do pliku .baseplan.json. Ekipa wczytuje go jednym kliknięciem." Wizual: zrzut listy projektów z kafelkiem "Wczytaj plik" albo okno eksportu.
- **CTA:** brak (cel: zrozumienie).

### 4. Zasady z gry (NOWA)
- **Cel:** różnica względem Housing Plannera w grze: tu widzisz limity i problemy, zanim zbierzesz surowce.
- **Nagłówek (H2):** "Wiesz, co przejdzie w grze, zanim postawisz pierwszą ścianę"
- **Układ:** nierówna siatka 4 kafelków (1 duży na 2 rzędy + 3 mniejsze). Dokładnie 4 pola, bez pustych.
  1. **(duży) Prawdziwe mapy 1:1.** "Russia, Washington, PEI, Germany, Yukon i inne: teren, satelita, budynki i drzewa w skali gry." Wizual: zrzut mapy z satelitą i bazą.
  2. **Limity mapy.** "Maksymalna wysokość budowania (1024 m), granica tlenu i strefy zakazu budowy dla każdej mapy." Wizual: zrzut skybase z linią limitu albo prosty schemat wysokości ze zrzutu.
  3. **Zasięg łóżka.** "Okrąg pokazuje, gdzie nikt spoza grupy nic nie postawi." Wizual: zrzut planu z okręgiem claimu.
  4. **Sterowanie jak w grze.** "Pasek 1-9, ekwipunek pod E, komendy /time, /tp, /give. Klawisze ustawisz po swojemu." Wizual: zrzut paska slotów albo czatu z komendą.
- **CTA:** brak.

### 5. Bez konta (NOWA, wąski pas)
- **Cel:** zdjąć obawy: "muszę się rejestrować? ile to kosztuje? czy to żyje?"
- **Układ:** jeden pas, po lewej krótka lista faktów z ikonami w jednym rzędzie (nie karty), po prawej ostatnia wersja z changelogu.
- **Fakty:** "Działa w przeglądarce", "Bez konta i za darmo", "Projekty zostają u ciebie", "Polski i angielski".
- **Ostatnia aktualizacja:** numer i data najnowszej wersji z CMS (np. "0.13.0, 21 października 2026") + link "Zobacz changelog". Dane prawdziwe, czytane z panelu, nie wpisane na sztywno.
- **CTA:** link do changelogu (drugorzędny).

### 6. Końcowe CTA (NOWA)
- **Cel:** domknięcie dla tych, którzy przewinęli całą stronę.
- **Nagłówek (H2):** "Następna baza zaczyna się od planu"
- **Treść:** brak albo jedno krótkie zdanie.
- **Wizual:** tło spokojne (bez filmu), ewentualnie kadr z planu 2D w tle pod ciemną warstwą.
- **CTA:** "Nowy projekt" (ta sama etykieta co w hero, jedna intencja = jedna nazwa).

### 7. Stopka (bez zmian)
- Marka + hasło, linki (stałe + z CMS), drobny druk ze źródłem filmu.

## Sprawdzenie celu

Hero (start) → Jak to działa (zrozumienie) → Zasady z gry (przewaga) → Bez konta (brak przeszkód) → Końcowe CTA (start). Każda sekcja prowadzi do "Nowy projekt". Nie ma sekcji opinii, liczb ani logotypów, bo nie mamy prawdziwych danych.

## Do uzupełnienia przed etapem 5

- [DO UZUPEŁNIENIA: zrzuty z aplikacji] 7 zrzutów: planer 2D, Sandbox na mapie, eksport/wczytanie pliku, mapa z satelitą, skybase z limitem, okrąg łóżka, pasek slotów lub czat. Mogę je zrobić z aplikacji sam (headless Chrome), ale 3D na mapie wychodzi lepiej z prawdziwej karty graficznej: jeśli masz własne zrzuty, użyjemy ich.
- Kolejność i treść tekstów do akceptacji (teksty PL, wersje EN przygotuję w etapie 5).
