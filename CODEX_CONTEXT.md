# Codex context - Opacka

## Jak pracować z projektem

Na początku kolejnych sesji przeczytaj:

1. `ZALOZENIA_PROJEKTU.md` - kontekst produktowy dla użytkownika.
2. `CODEX_CONTEXT.md` - techniczny i operacyjny kontekst dla Codexa.

Po istotnych decyzjach aktualizuj oba pliki: pierwszy ludzkim językiem, drugi zwięźle technicznie.

## Cel techniczny

Zbudować bardzo małą aplikację webową/PWA do sprawdzania odjazdów z przystanku Opacka. Ma działać świetnie na telefonie i dać się dodać do ekranu głównego.

## Źródła danych

Oficjalne API:

- `https://ckan2.multimediagdansk.pl/departures?stopId=2047`
- `https://ckan2.multimediagdansk.pl/departures?stopId=2048`

Nagłówki sprawdzone 2026-05-20:

- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *`
- `Cache-Control: max-age=20`

Wniosek: frontend może wykonywać `fetch` bez własnego backendu/proxy.

Endpoint używany przez widget ZTM:

- `https://ztm.gda.pl/rozklady/pobierz_SIP2.php?n[0]=2047&sn=dd711a880f8d5c87fe3948607a0dc7da&t=&l=`
- `https://ztm.gda.pl/rozklady/pobierz_SIP2.php?n[0]=2048&sn=dd711a880f8d5c87fe3948607a0dc7da&t=&l=`

Zwraca HTML tablicy SIP, nie preferować jako głównego źródła. Może być użyteczne jako punkt porównawczy UI.

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
- `vehicleCode`, `vehicleId` - dostępne zwykle tylko dla realtime.

Uwaga: PowerShell `Invoke-WebRequest` pokazał błędnie zakodowane polskie znaki w konsoli (`StrzyÅ¼a`), ale endpoint deklaruje JSON i w przeglądarce/fetch powinien być dekodowany jako UTF-8. Przy implementacji zweryfikować w UI.

## Przystanki

- `2047` - Opacka w jedną stronę; przykładowe kierunki z requestu: `Jelitkowo`, `Zaspa`.
- `2048` - Opacka 02; przykładowe kierunki z requestu: `Strzyża PKM`, `Nowe Ogrody`, `Łostowice Świętokrzyska`.

Pierwotne strony ZTM:

- `https://ztm.gda.pl/rozklady/rozklad-006_20260417-36-1-dzien-20260520.html`
- `https://ztm.gda.pl/rozklady/rozklad-006_20260417-7-2-dzien-20260520.html`

W stopce stron znaleziono wywołania `poll('pobierz_SIP2.php?n[0]=2047...','SIP')` i `poll('pobierz_SIP2.php?n[0]=2048...','SIP')`.

## Preferowana architektura

Start: statyczna aplikacja PWA, bez backendu.

Proponowany stack, jeśli nie pojawią się inne wymagania:

- Vite + TypeScript albo czysty HTML/CSS/JS, zależnie od tego, jak mały ma być projekt.
- Service worker i manifest PWA.
- Jeden ekran z dwoma panelami kierunków.
- `fetch` do obu endpointów równolegle.
- Odświeżanie co 20-30 sekund, z widocznym czasem ostatniej aktualizacji.

## Wdrożenie

Najprościej: GitHub Pages, Netlify albo Cloudflare Pages.

Preferencja techniczna na start: statyczny hosting bez serverless, bo CORS działa. Cloudflare Pages zostawić jako wygodną opcję, jeśli później będzie potrzebny proxy/cache albo własny endpoint.

Aktualna decyzja: GitHub Pages z root gałęzi repozytorium, jeśli będzie dostępne dla repo.

2026-05-20: próba `gh api --method POST repos/michalkurzelewski/opacka/pages -f source[branch]=master -f source[path]=/` zakończyła się HTTP 422: `Your current plan does not support GitHub Pages for this repository.` Repo jest prywatne. Nie zmieniać widoczności repo bez wyraźnej zgody użytkownika. Najbliższe opcje: upublicznić repo, użyć planu GitHub z Pages dla prywatnych repo albo wdrożyć statyczną aplikację przez Cloudflare Pages/Netlify.

## Pliki aplikacji

- `index.html` - główny ekran.
- `styles.css` - responsywny styl mobile-first.
- `app.js` - pobieranie danych, renderowanie, auto-refresh.
- `manifest.webmanifest` - PWA manifest.
- `sw.js` - service worker cache'ujący pliki aplikacji, ale nie cache'ujący odpowiedzi API ZTM.
- `icon.svg` - ikona aplikacji.
- `.nojekyll` - wyłączenie przetwarzania Jekyll na GitHub Pages.

## UX notatki

- Widok ma być natychmiastowy: żadnej strony startowej.
- Duże czasy do odjazdu, czytelne numery linii.
- Dwa kierunki obok siebie na desktopie, jeden pod drugim na telefonie.
- Wyróżnić odjazdy w ciągu najbliższych kilku minut.
- Oznaczać `SCHEDULED` jako dane rozkładowe, żeby było jasne, że to nie realtime.
