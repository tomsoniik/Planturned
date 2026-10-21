# Konkurencja: Untmatica

Sprawdzone 2026-10-21 (wyszukiwarka + sprawdzenie, czy strony działają). Dedykowanego plannera baz do Unturned w sieci nie znaleziono.

## 1. Housing Planner w samej grze (Unturned 3.22.12.0)

Narzędzie dodane do gry w lipcu 2022: szybkie stawianie konstrukcji w trybie planowania.
Źródło: https://unturned-servers.net/blog/378/322120-update-notes/

- **Co robi dobrze:** jest w grze, prawdziwa fizyka i modele, zero dodatkowych narzędzi.
- **Słabości:** trzeba odpalić grę i serwer/singleplayer, nie ma widoku z góry jak plan, nie da się wysłać projektu ekipie jako pliku, nie pokazuje limitów mapy (wysokość, tlen, strefy zakazu) przed budową.
- **Czym się różnimy:** działamy w przeglądarce bez gry, plan 2D jak rzut architektoniczny, plik `.baseplan.json` dla ekipy, limity mapy i promień łóżka widoczne od razu.

## 2. Rust Planner (Facepunch, 2015)

Oficjalny planner 2D do Rusta: plan bazy bez wchodzenia na serwer, koszt surowców, zapis po zalogowaniu i współdzielenie z kolegą.
Źródło: https://rust.facepunch.com/news/community-update-42 i https://rust.facepunch.com/news/community-update-49 (stan dzisiejszy niepotwierdzony).

- **Co robi dobrze:** koszt surowców przy planie, współdzielenie projektu, tryb offline.
- **Czym się różnimy:** inna gra; my mamy 3D na prawdziwej mapie i zasady budowania Unturned. Warto rozważyć **koszt surowców** jako przyszłą funkcję.

## 3. xGamingServer, narzędzia do Rusta

https://xgamingserver.com/tools/rust (działa): kalkulatory utrzymania (upkeep) i rozpadu (decay).

- **Co robi dobrze:** jedna konkretna odpowiedź na jedno pytanie gracza ("ile mnie kosztuje baza").
- **Czym się różnimy:** u nas pełny planer. Wniosek: na stronie głównej mówić o **konkretnych pytaniach gracza** (czy zmieszczę bazę pod limitem wysokości? gdzie nikt nie postawi mi niczego obok łóżka?).

## 4. RustBaseDesign

https://rustbasedesign.onrender.com/ (sprawdzone: 404, nie działa): biblioteka gotowych projektów baz z filtrami (wielkość ekipy, koszt).

- **Co robiło dobrze:** gotowe wzory do skopiowania.
- **Wniosek dla nas:** galeria przykładowych baz do wczytania to dobry pomysł na później (mamy już "Przykładowa baza 4x3" na stronie głównej).

## Podsumowanie pozycji

Untmatica to jedyne znalezione narzędzie do planowania baz w Unturned poza samą grą. Przewagi do pokazania na stronie: przeglądarka zamiast gry, plan 2D + 3D na prawdziwej mapie, limity z gry, plik dla ekipy, bez konta.
