# Odjazdy

Mała aplikacja PWA do szybkiego sprawdzania odjazdów z wybranych przystanków w Gdańsku.

Przy pierwszym uruchomieniu skonfigurowane są zakładki dla przystanków Opacka i Płowce. Kolejne zespoły przystankowe można wyszukać i dodać przyciskiem „Moje przystanki”; wybór jest przechowywany lokalnie w przeglądarce.

Ponowne naciśnięcie aktywnej zakładki otwiera edytor, w którym można zmieniać kolejność słupków, ukrywać je i nadawać im własne aliasy. Te ustawienia również pozostają zapisane w danej przeglądarce.

Źródło danych: `https://ckan2.multimediagdansk.pl/departures`. Aplikacja odpytuje je
bezpośrednio, a przy błędzie sieciowym przeglądarki korzysta z ograniczonego do tego
endpointu proxy CORS. Podczas działania fallbacku operator proxy widzi publiczny numer
przystanku oraz standardowe metadane połączenia; aplikacja nie wysyła cookies ani referrera.
