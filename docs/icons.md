# Ikony przedmiotów

Każdy przedmiot w Untmatice (klocki, rekwizyty, surowce w oknie Materiały, ładunki w kalkulatorze raidu) ma mieć ikonę z gry, zapisaną w `public/unturned/items/<id>.png`. Nie używamy ikon robionych przez nas: żadnych przefarbowanych ikon innych przedmiotów, renderów z three.js ani ikon zastępczych. Szary kwadrat z nazwą w aplikacji to tylko zabezpieczenie na wypadek zerwanego połączenia.

## Skąd gra bierze ikony

Gra nie ma gotowych plików ikon. Tworzy je sama w `ItemTool.getIcon` / `captureIcon` (U3-SDK, `Assets/Runtime/Assembly-CSharp/Unturned/Tools/ItemTool.cs`):

- kamera ortograficzna ustawiona w miejscu obiektu `Icon` z prefabu przedmiotu,
- render na przezroczystym tle, rozmiar `size_x * 50` na `size_y * 50` pikseli,
- bez mgły, z białym światłem otoczenia.

## Źródło 1: zbiór UnturnedImages

[SilKsPlugins/UnturnedImages](https://github.com/SilKsPlugins/UnturnedImages), gałąź `images`, plik `vanilla/items/<id>.png`. Te ikony zostały wyrenderowane przez grę, a przez CDN są dostępne pod adresem `https://cdn.jsdelivr.net/gh/SilKsPlugins/UnturnedImages@images/vanilla/items/<id>.png`.

Skrypt eksportu pobiera je sam: najpierw z CDN, a gdy ten zwróci błąd, prosto z GitHuba.

## Źródło 2: ikony wygenerowane we własnej grze

Najnowszych przedmiotów (z nowszych aktualizacji rzemiosła: stosy materiałów, warsztaty, nowe uprawy, ceglane podłogi, dachy i schody, trójkątne otwory) nie ma jeszcze w UnturnedImages. Trzeba je wyrenderować w grze tym samym `ItemTool`.

Repozytorium UnturnedImages ma do tego moduł klienta w `tools/UnturnedImages.Module`:

- `UnturnedImages.module` z `"Role": "Client"`,
- ładuje `UnturnedImages.Module.Bootstrapper.dll`.

Instalacja i uruchomienie (do potwierdzenia, bo README tego nie opisuje):

1. Sklonuj repozytorium i zbuduj projekty `tools/UnturnedImages.Module` oraz `tools/UnturnedImages.Module.Bootstrapper`, np. `dotnet build -c Release`. Ścieżki do bibliotek gry ustaw w plikach `.csproj`, jeśli tego wymagają.
2. Skopiuj `UnturnedImages.module` i zbudowane biblioteki do `Unturned/Modules/UnturnedImages/`.
3. Uruchom grę. Moduł dodaje własny interfejs (`UI/UIManager`) i narzędzia `CustomImageTool` / `CustomVehicleTool`. Tam będzie eksport ikon i folder, do którego zapisuje pliki.

Nie potwierdziłem jeszcze, którym przyciskiem albo komendą moduł zapisuje pliki ani w jakim folderze je zostawia. README repozytorium tego nie opisuje. Trzeba to sprawdzić w kodzie `tools/UnturnedImages.Module/UI` i `Images`, albo po prostu uruchomić moduł.

## Dołączanie ikon do projektu

Gdy masz folder z plikami `<id>.png` z gry:

```powershell
python scripts/export_game_data.py --icons --icons-dir="C:\ścieżka\do\ikon"
```

Zamiast opcji `--icons-dir` możesz ustawić zmienną środowiskową `UNTURNED_ICONS`.

Krok ikon:

1. kopiuje pliki z tego folderu do `public/unturned/items/`,
2. dociąga brakujące z UnturnedImages,
3. sprawdza wszystkie ID: struktury, rekwizyty, surowce z przepisów, ładunki, łóżko i wyburzanie.

Jeśli któryś przedmiot nie ma ikony, wypisuje listę i kończy się błędem. Dzięki temu nowy rekwizyt nie przejdzie bez ikony. Ten sam krok sprawdzania odpala się na końcu pełnego `npm run export:game`.

## Brakujące ikony (stan na 2026-10-23)

52 ID, wszystkie spoza zbioru UnturnedImages:

| Grupa | ID |
| --- | --- |
| Hanuberry (owoc, nasiona) | 571, 574 |
| Stosy materiałów | 1900–1915 |
| Warsztat i rzemiosło | 1916–1924, 1927, 1928 |
| Surowce rzemiosła | 1926 (glina), 1932, 1934 (grzyby), 1940, 1944, 1948 (taro, ryż, trzcina) |
| Nasiona | 1933, 1935, 1941, 1945, 1949 |
| Ceglane struktury | 1979–1986 |
| Trójkątne otwory | 1987–1990 |
