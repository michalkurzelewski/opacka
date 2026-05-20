# Opacka - założenia projektu

## Cel

Mała aplikacja mobilna/webowa do szybkiego sprawdzania najbliższych odjazdów tramwajów z przystanku Opacka w Gdańsku. Główna potrzeba: po jednym kliknięciu na telefonie zobaczyć, za ile minut przyjedzie tramwaj w każdą z dwóch stron.

## Użytkownik i scenariusz

Użytkownik otwiera skrót na telefonie, najlepiej z ekranu głównego, i od razu widzi aktualne odjazdy. Aplikacja ma być szybka, prosta i bez logowania. Priorytetem jest czytelność w biegu, a nie rozbudowany planer podróży.

## Zakres pierwszej wersji

- Pokazanie odjazdów dla dwóch słupków przystanku Opacka.
- Rozróżnienie dwóch kierunków jazdy.
- Wyświetlenie linii, kierunku, czasu do odjazdu oraz statusu danych: realtime albo rozkładowe.
- Automatyczne odświeżanie danych co około 20-30 sekund.
- Widok zoptymalizowany na telefon.
- Możliwość dodania na ekran główny telefonu jako PWA.

## Dane źródłowe

Pierwotne linki ZTM:

- https://ztm.gda.pl/rozklady/rozklad-006_20260417-36-1-dzien-20260520.html
- https://ztm.gda.pl/rozklady/rozklad-006_20260417-7-2-dzien-20260520.html

Analiza requestów strony pokazała dwa sposoby pobierania danych:

1. Endpoint używany przez widżet strony ZTM:
   - `https://ztm.gda.pl/rozklady/pobierz_SIP2.php?n[0]=2047&sn=...`
   - `https://ztm.gda.pl/rozklady/pobierz_SIP2.php?n[0]=2048&sn=...`
   - zwraca gotowy fragment HTML tablicy odjazdów.

2. Oficjalne otwarte dane ZTM/TRISTAR:
   - `https://ckan2.multimediagdansk.pl/departures?stopId=2047`
   - `https://ckan2.multimediagdansk.pl/departures?stopId=2048`
   - zwracają czysty JSON z listą odjazdów.

Preferowanym źródłem danych jest oficjalny endpoint JSON z otwartych danych, bo jest stabilniejszy dla aplikacji, opisany w dokumentacji i ma nagłówki pozwalające na pobieranie bezpośrednio z przeglądarki.

## Przystanki

- `2047` - Opacka, kierunek w stronę Jelitkowa/Zaspy.
- `2048` - Opacka 02, kierunek m.in. Strzyża PKM / Nowe Ogrody / Łostowice Świętokrzyska.

Nazwy kierunków należy jeszcze potwierdzić w aplikacji na podstawie danych produkcyjnych i finalnego układu UI.

## Rekomendowane wdrożenie

Najprostsza ścieżka: statyczna aplikacja PWA hostowana na GitHub Pages, Netlify albo Cloudflare Pages.

Rekomendacja na start: GitHub Pages, jeśli repozytorium będzie na GitHubie. Daje najprostszy model utrzymania: kod w repo, automatyczne publikowanie, jeden publiczny adres URL, który można dodać do ekranu głównego telefonu.

Alternatywa: Cloudflare Pages, jeśli zależy nam na łatwym dodaniu funkcji proxy/cache w przyszłości. Na ten moment proxy nie jest potrzebne, bo oficjalne API ma CORS (`Access-Control-Allow-Origin: *`) oraz cache około 20 sekund.

Status z 2026-05-20: aplikacja została przygotowana i wypchnięta do repozytorium, ale GitHub odmówił włączenia Pages dla prywatnego repozytorium komunikatem, że obecny plan nie wspiera GitHub Pages dla tego repo. Do wyboru są: zmiana repozytorium na publiczne, przejście na plan GitHub wspierający Pages dla prywatnych repozytoriów albo wdrożenie tej samej statycznej aplikacji przez Cloudflare Pages/Netlify.

## Decyzje

- Budujemy małą aplikację webową/PWA zamiast natywnej aplikacji mobilnej.
- Pierwsza wersja nie potrzebuje backendu.
- Dane pobieramy z oficjalnego API `ckan2.multimediagdansk.pl/departures`.
- Aplikacja ma być użyteczna od razu po otwarciu, bez dodatkowej nawigacji.
- Preferowany hosting: GitHub Pages z katalogu głównego repozytorium, o ile repozytorium/plan GitHub na to pozwoli.
