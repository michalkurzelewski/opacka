const OFFICIAL_DEPARTURES_ORIGIN = "https://ckan2.multimediagdansk.pl";
const DEPARTURES_PATH = "/departures";
const CORS_PROXY_ORIGIN = "https://corsproxy.nl";
const PROXY_COOLDOWN_MS = 5 * 60 * 1000;
const proxyPreferredUntilByFetch = new WeakMap();

function requestOptions() {
  return {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  };
}

function buildProxyEndpoint(endpoint) {
  const url = new URL(endpoint);
  const parameterNames = [...url.searchParams.keys()];
  const stopIds = url.searchParams.getAll("stopId");
  const isOfficialEndpoint =
    url.origin === OFFICIAL_DEPARTURES_ORIGIN &&
    url.pathname === DEPARTURES_PATH &&
    !url.username &&
    !url.password &&
    !url.hash &&
    parameterNames.length === 1 &&
    parameterNames[0] === "stopId" &&
    stopIds.length === 1 &&
    /^\d+$/.test(stopIds[0]);

  if (!isOfficialEndpoint) {
    throw new Error("Nieobsługiwany endpoint odjazdów.");
  }

  return `${CORS_PROXY_ORIGIN}/https/ckan2.multimediagdansk.pl/departures?stopId=${encodeURIComponent(stopIds[0])}`;
}

export async function fetchDepartures(endpoint, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const proxyEndpoint = buildProxyEndpoint(endpoint);
  let response;

  if ((proxyPreferredUntilByFetch.get(fetchImpl) || 0) > now()) {
    response = await fetchImpl(proxyEndpoint, requestOptions());
  } else {
    try {
      response = await fetchImpl(endpoint, requestOptions());
      proxyPreferredUntilByFetch.delete(fetchImpl);
    } catch (error) {
      if (!(error instanceof TypeError) && error?.name !== "TypeError") {
        throw error;
      }

      proxyPreferredUntilByFetch.set(fetchImpl, now() + PROXY_COOLDOWN_MS);
      response = await fetchImpl(proxyEndpoint, requestOptions());
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.departures)) {
    throw new Error("Nieoczekiwany format danych odjazdów.");
  }

  return payload;
}
