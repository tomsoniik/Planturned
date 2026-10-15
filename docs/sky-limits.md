# Limity wysokości (sky limits) w Unturned

Źródło: kod gry z [U3-SDK](https://github.com/SmartlyDressedGames/U3-SDK) oraz pliki map z lokalnej instalacji.
Wartości per mapa liczy `scripts/export_game_data.py` i zapisuje w `public/maps/<Mapa>/meta.json`.

## Reguły z kodu gry

| Reguła | Gdzie w kodzie | Wartość |
| --- | --- | --- |
| Twardy limit budowania | `Level.isPointWithinValidHeight` (Level.cs) | wysokość świata od -1024 do 1024 m |
| Sprawdzenie przy stawianiu | `UseableHousingUtils.IsPendingPositionValid` | poza limitem gra pokazuje komunikat BOUNDS |
| Strefy zakazu budowy | `PlayerClipVolume` w `Level.hierarchy`, `PlayerClipVolumeManager.IsPositionInsideAnyVolume` | prostopadłościany (pozycja, obrót, skala) |
| Tlen na wysokości | `PlayerLife.SimulateOxygenFrame` przy `Use_Legacy_Oxygen_Height` (domyślnie `true` w LevelInfo.cs) | oddychanie = lerp(1, -1, (y - woda) / (1024 - woda)); poniżej zera tlen spada |
| Granica tlenu | jw. | y = woda + (1024 - woda) / 2 |
| Poziom wody | `Environment/Lighting.dat`, float na offsecie 18 × 256 (Level.TERRAIN) | 1.0 oznacza brak morza |

Wysokość świata to oś Y gry. Teren mapy leży w zakresie 0-256 m (Level.TERRAIN).

## Mapy z instalacji (eksport 2026-10-11)

| Mapa | Rozmiar | Woda | Tlen ograniczony | Tlen spada od | Strefy zakazu (PlayerClipVolume) |
| --- | --- | --- | --- | --- | --- |
| Alpha Valley | 1024 m | 17,9 m | tak | 521 m | 0 |
| Germany | 4096 m | 25,6 m | nie (`Use_Legacy_Oxygen_Height: false`) | brak | 19 (ściany na granicy mapy, wysokość 2048 m) |
| Monolith | 1024 m | 25,6 m | tak | 524,8 m | 0 |
| PEI | 2048 m | 25,6 m | tak | 524,8 m | 0 |
| Russia | 4096 m | 25,6 m | tak | 524,8 m | 0 |
| Tutorial | 1024 m | 25,6 m | tak | 524,8 m | 0 |
| Washington | 2048 m | 25,6 m | tak | 524,8 m | 0 |
| Yukon | 2048 m | brak | tak | 512 m (woda = 0) | 0 |

Na każdej mapie twardy limit budowania wynosi 1024 m wysokości świata.

## Jak to działa w plannerze (tylko widok 3D)

- Czerwona płaszczyzna: twardy limit 1024 m. Elementów ponad nim nie da się postawić.
- Pomarańczowa płaszczyzna: granica tlenu (jeśli mapa ją ma). Stawiać wolno, panel ostrzega.
- Strefy PlayerClipVolume blokują stawianie w ich wnętrzu.
- Skybase: wysokość zawieszenia jest przycinana tak, żeby platforma nie przekroczyła limitu mapy.
- Bez mapy z gry (łąka) planner przyjmuje teren na 0 m, wodę na 0 m: limit 1024 m, tlen od 512 m.
