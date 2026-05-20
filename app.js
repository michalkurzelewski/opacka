const STOPS = [
  {
    id: "2048",
    label: "Opacka 02",
    endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=2048",
  },
  {
    id: "2047",
    label: "Opacka",
    endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=2047",
  },
];

const refreshButton = document.querySelector("#refreshButton");
const statusText = document.querySelector("#statusText");
const updatedText = document.querySelector("#updatedText");
const formatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

async function fetchStop(stop) {
  const response = await fetch(stop.endpoint, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Nie udało się pobrać danych dla ${stop.label}.`);
  }

  return response.json();
}

function minutesUntil(isoDate) {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / 60000);
}

function formatDepartureTime(departure) {
  const minutes = minutesUntil(departure.estimatedTime);

  if (minutes <= 0) {
    return "teraz";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return formatter.format(new Date(departure.estimatedTime));
}

function formatDelay(seconds) {
  if (seconds === null || seconds === undefined || Math.abs(seconds) < 30) {
    return "";
  }

  const minutes = Math.round(Math.abs(seconds) / 60);
  return seconds > 0 ? `+${minutes} min` : `-${minutes} min`;
}

function renderStop(stop, data) {
  const list = document.querySelector(`#departures-${stop.id}`);
  const upcoming = data.departures
    .filter((departure) => minutesUntil(departure.estimatedTime) >= -1)
    .slice(0, 8);

  if (!upcoming.length) {
    list.innerHTML = `<li class="empty-state">Brak najbliższych odjazdów.</li>`;
    return;
  }

  list.innerHTML = upcoming.map(renderDeparture).join("");
}

function renderDeparture(departure) {
  const minutes = minutesUntil(departure.estimatedTime);
  const statusLabel = departure.status === "REALTIME" ? "na żywo" : "rozkład";
  const statusClass = departure.status === "REALTIME" ? "" : "scheduled";
  const delay = formatDelay(departure.delayInSeconds);
  const time = formatDepartureTime(departure);
  const scheduled = formatter.format(new Date(departure.theoreticalTime));

  return `
    <li class="departure ${minutes <= 4 ? "soon" : ""}">
      <span class="line-badge">${escapeHtml(departure.routeShortName)}</span>
      <span class="destination">
        <strong>${escapeHtml(departure.headsign)}</strong>
        <span class="meta">
          <span class="status-tag ${statusClass}">${statusLabel}</span>
          <span>${scheduled}</span>
          ${delay ? `<span>${delay}</span>` : ""}
        </span>
      </span>
      <span class="time">${time}</span>
    </li>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshDepartures() {
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;
  statusText.textContent = "Odświeżanie...";

  try {
    const results = await Promise.all(STOPS.map(async (stop) => [stop, await fetchStop(stop)]));
    results.forEach(([stop, data]) => renderStop(stop, data));

    const newestUpdate = results
      .map(([, data]) => new Date(data.lastUpdate).getTime())
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    statusText.textContent = "Aktualne odjazdy";
    updatedText.textContent = newestUpdate ? `Dane z ${formatter.format(new Date(newestUpdate))}` : "";
  } catch (error) {
    statusText.textContent = error.message || "Nie udało się pobrać odjazdów.";
    updatedText.textContent = "Spróbuj odświeżyć";
  } finally {
    refreshButton.classList.remove("is-loading");
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", refreshDepartures);
refreshDepartures();
setInterval(refreshDepartures, 30000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
