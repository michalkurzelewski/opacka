# Codex context - Odjazdy

## Jak pracować z projektem

Na początku kolejnych sesji przeczytaj:

1. `ZALOZENIA_PROJEKTU.md` - kontekst produktowy dla użytkownika.
2. `CODEX_CONTEXT.md` - techniczny i operacyjny kontekst dla Codexa.

Po istotnych decyzjach aktualizuj oba pliki: pierwszy ludzkim językiem, drugi zwięźle technicznie.

## Cel techniczny

Mała statyczna aplikacja webowa/PWA do sprawdzania odjazdów z kilku ulubionych przystanków w Gdańsku. Ma działać dobrze na telefonie, być szybka po otwarciu i nadawać się do dodania na ekran główny.

## Architektura

- Bez bundlera i backendu: czysty `index.html`, `styles.css`, `app.js`.
- `app.js` ma domyślną konfigurację `DEFAULT_STOP_GROUPS` oraz wczytuje pełny katalog ze `stops.json`.
- Każdy element listy wybranych grup to zakładka dla jednego zespołu przystanków.
- Wewnątrz zakładki są słupki z osobnymi endpointami `departures?stopId=...`.
- Service worker cache'uje tylko pliki aplikacji, nie cache'uje odpowiedzi API ZTM.
- `stop-preferences.mjs` zawiera testowalną logikę odczytu wyboru użytkownika i normalizacji wyszukiwania.
- `stop-preferences.mjs` obsługuje również walidację ustawień słupków oraz atomowy zapis szkicu edycji kolejności, aliasów i widoczności.
- `scripts/update-stops-snapshot.mjs` generuje statyczny katalog; uruchamiać go świadomie, gdy zostanie ustalona polityka aktualizacji. Po zmianie snapshotu trzeba też podbić `CACHE_NAME` w `sw.js`, aby zainstalowane PWA pobrały nową wersję.

## Źródło danych

Oficjalne API:

- `https://ckan2.multimediagdansk.pl/departures?stopId={stopId}`

Nagłówki sprawdzone 2026-05-20:

- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *`
- `Cache-Control: max-age=20`

Frontend może wykonywać `fetch` bez backendu/proxy.

## Struktura danych JSON

Odpowiedź:

- `lastUpdate` - timestamp UTC aktualizacji danych.
- `departures` - posortowana lista odjazdów.

Istotne pola odjazdu:

- `routeShortName` - numer linii.
- `headsign` - kierunek.
- `estimatedTime` - prognozowany albo rozkładowy czas odjazdu, ISO-8601 UTC.
- `theoreticalTime` - czas rozkładowy, ISO-8601 UTC.
- `status` - `REALTIME` albo `SCHEDULED`.
- `delayInSeconds` - liczba sekund opóźnienia/przyspieszenia albo `null`.

## Skonfigurowane przystanki

Opacka:

- `2048` - Opacka 02; kierunki m.in. centrum/Wrzeszcz.
- `2047` - Opacka; kierunki m.in. Jelitkowo/Zaspa.
- `1665`, `1666` - słupki autobusowe Opacka, dołączane do domyślnej grupy ze snapshotu.

Płowce:

- `1330` - Płowce 01; kierunki m.in. Muzeum II Wojny Światowej / Dworzec Główny.
- `1331` - Płowce 02; kierunki m.in. Jasień PKM / Oliwa / Port Lotniczy.

Źródło dla Płowce: strona ZTM zespołu przystanków `https://ztm.gda.pl/rozklady/przystanek-264.html` oraz linki użytkownika do linii 130 z dnia 2026-05-20.

## Własne przystanki użytkownika

- Przy pierwszym uruchomieniu wybrane są Opacka i Płowce.
- Identyfikatory wybranych zespołów są zapisane w `localStorage` pod kluczem `selectedStopGroups`.
- Aliasy słupków, widoczność i kolejność są zapisane w `localStorage` pod kluczem `stopSettings`. Dla zgodności wstecznej lista ukrytych słupków nadal używa wewnętrznego pola `collapsed`.
- Użytkownik może wyszukiwać zespoły po nazwie, strefie lub numerze słupka oraz dodawać i usuwać zakładki.
- Ponowne naciśnięcie aktywnej zakładki otwiera modal edycji. Zmiany kolejności, aliasów i widoczności są szkicem aż do naciśnięcia „Zapisz zmiany”.
- Kolejność można zmieniać przyciskami lub przez HTML drag and drop; przyciski pozostają obsługiwanym wariantem mobilnym.
- Ukryte słupki nie są renderowane na ekranie głównym ani odpytywane o odjazdy, lecz pozostają dostępne w modalnym edytorze.
- Usunięcie całej zakładki jest dostępne zarówno w edytorze po potwierdzeniu, jak i w oknie „Moje przystanki”.
- Snapshot `stops.json` został wygenerowany 2026-07-15 z oficjalnego zasobu „Lista przystanków ZTM w Gdańsku”.
- Konfiguracja jest lokalna dla przeglądarki i nie synchronizuje się między urządzeniami.

## UX notatki

- Widok startowy jest użytkowy, bez landing page.
- Górne zakładki przełączają zespół przystanków.
- Ponowne naciśnięcie aktywnej zakładki otwiera jej edytor; dostępny opis ARIA i `title` objaśniają tę interakcję.
- Karty słupków na ekranie głównym nie zawierają żadnych kontrolek edycji.
- W aktywnej zakładce słupki pokazują się obok siebie na desktopie i jeden pod drugim na telefonie.
- Odjazdy w ciągu kilku minut są wyróżnione kolorem.
- `SCHEDULED` jest opisane jako `rozkład`, żeby było jasne, że to nie realtime.
- Po pierwszym poprawnym pobraniu nagłówek widoku stale pokazuje czas pochodzenia ostatnich danych i przycisk odświeżania; trwające odświeżanie sygnalizuje animacja ikony bez usuwania czasu.
- Zakładki nie pokazują liczby słupków; przycisk dodawania przystanku jest ostatnim elementem ich wiersza.

## Wdrożenie

GitHub Pages z katalogu głównego repozytorium.

Publiczny adres aplikacji: `https://michalkurzelewski.github.io/opacka/`.

## Lokalna weryfikacja przez Codexa

W Codex Desktop lokalny Browser potrafi blokować wejście na `http://127.0.0.1:...`, `http://localhost:...` albo `file://...` dla tej aplikacji. Nie zaczynać weryfikacji od Browsera, bo to prowadzi do fałszywego tropu.

Najprostsza ścieżka weryfikacji po zmianach:

1. Sprawdź składnię:
   - `node --check app.js`
   - `node --check sw.js`
2. Sprawdź, czy statyczny serwer odpowiada, uruchamiając go tylko na czas jednej komendy:
   - `$job = Start-Job -ScriptBlock { Set-Location 'C:\Users\micku\RiderProjects\opacka'; python -m http.server 4173 --bind 127.0.0.1 }; Start-Sleep -Seconds 2; try { (Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing).StatusCode } finally { Stop-Job $job; Remove-Job $job }`
   - oczekiwany wynik: `200`.
3. Dla nowych słupków potwierdź endpoint API bezpośrednio:
   - `Invoke-RestMethod -Uri 'https://ckan2.multimediagdansk.pl/departures?stopId=1330' | Select-Object -ExpandProperty departures | Select-Object -First 1 routeShortName,headsign,status`
   - analogicznie dla innych `stopId`.
4. Sprawdź porządek zmian:
   - `git diff --check`
   - `git status --short`

Jeśli potrzebna jest wizualna weryfikacja UI, najrozsądniej poprosić użytkownika o otwarcie lokalnego adresu w zwykłej przeglądarce albo zweryfikować po publikacji na GitHub Pages. Nie obchodzić blokady Browsera alternatywnymi kanałami automatyzacji przeglądarki.
