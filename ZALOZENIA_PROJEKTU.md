# Odjazdy - założenia projektu

## Cel

Mała aplikacja mobilna/webowa do szybkiego sprawdzania najbliższych odjazdów z wybranych przystanków w Gdańsku. Główna potrzeba: po jednym kliknięciu na telefonie zobaczyć, za ile minut przyjedzie najbliższy tramwaj albo autobus.

## Użytkownik i scenariusz

Użytkownik otwiera skrót na telefonie, najlepiej z ekranu głównego, wybiera potrzebny przystanek zakładką i od razu widzi aktualne odjazdy. Aplikacja ma być szybka, prosta i bez logowania. Priorytetem jest czytelność w biegu, a nie rozbudowany planer podróży.

## Zakres aktualnej wersji

- Zakładki dla wielu zespołów przystanków.
- Skonfigurowane przystanki: Opacka i Płowce.
- W każdej zakładce pokazanie słupków/kierunków danego przystanku.
- Wyświetlenie linii, kierunku, czasu do odjazdu oraz statusu danych: realtime albo rozkładowe.
- Automatyczne odświeżanie danych co około 30 sekund.
- Widok zoptymalizowany na telefon.
- Możliwość dodania na ekran główny telefonu jako PWA.
- Wyszukiwanie i dodawanie własnych zespołów przystankowych jako zakładek.
- Usuwanie niepotrzebnych zakładek; wybór jest zapisywany lokalnie w danej przeglądarce.
- Opacka i Płowce są dodawane domyślnie przy pierwszym uruchomieniu.
- Każdy słupek można zwinąć, przesunąć wcześniej lub później w zakładce i nadać mu własny alias.
- Alias, kolejność i stan zwinięcia są zapamiętywane lokalnie; zwinięte słupki nie są odpytywane o odjazdy.

## Dane źródłowe

Preferowanym źródłem danych jest oficjalny endpoint JSON z otwartych danych ZTM/TRISTAR:

- `https://ckan2.multimediagdansk.pl/departures?stopId={stopId}`

Ten endpoint ma CORS pozwalający na pobieranie bezpośrednio z przeglądarki, więc aplikacja nie potrzebuje backendu.

## Przystanki

Opacka:

- `2047` - Opacka, kierunek m.in. Jelitkowo/Zaspa.
- `2048` - Opacka 02, kierunek m.in. centrum/Wrzeszcz.
- `1665` i `1666` - słupki autobusowe Opacka, dołączane z pełnego katalogu ZTM.

Płowce:

- `1330` - Płowce 01, kierunek m.in. Muzeum II Wojny Światowej / Dworzec Główny.
- `1331` - Płowce 02, kierunek m.in. Jasień PKM / Oliwa / Port Lotniczy.

Płowce dodane na podstawie linków użytkownika do rozkładów ZTM linii 130 oraz strony zespołu przystanków Płowce.

## Rekomendowane wdrożenie

Statyczna aplikacja PWA hostowana na GitHub Pages z katalogu głównego repozytorium.

Status z 2026-05-20: aplikacja jest opublikowana pod adresem `https://michalkurzelewski.github.io/opacka/`.

## Decyzje

- Budujemy małą aplikację webową/PWA zamiast natywnej aplikacji mobilnej.
- Aplikacja nie potrzebuje backendu.
- Dane pobieramy z oficjalnego API `ckan2.multimediagdansk.pl/departures`.
- Przystanki są grupowane jako zakładki, a słupki przystankowe jako panele wewnątrz aktywnej zakładki.
- Pełna lista dostępna w wyszukiwarce jest statycznym snapshotem oficjalnej listy ZTM zapisanym w `stops.json`.
- Ustawienia użytkownika zapisujemy w `localStorage`; nie są synchronizowane między urządzeniami.
- Automatycznie odświeżamy wyłącznie przystanki należące do aktualnie otwartej zakładki.
- W nagłówku słupka pokazujemy tylko jego nazwę albo alias; dodatkowe opisy typu „Słupek” i „Najbliższe odjazdy” zostały usunięte.
