const STOP_GROUPS = [
  {
    id: "opacka",
    label: "Opacka",
    note: "Tramwaje w stronę Oliwy i centrum",
    stops: [
      {
        id: "2048",
        label: "Opacka 02",
        code: "2048",
        heading: "Do centrum i Wrzeszcza",
        endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=2048",
      },
      {
        id: "2047",
        label: "Opacka",
        code: "2047",
        heading: "Do Jelitkowa i Zaspy",
        endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=2047",
      },
    ],
  },
  {
    id: "plowce",
    label: "Płowce",
    note: "Autobusy przy Powstańców Warszawskich",
    stops: [
      {
        id: "1330",
        label: "Płowce 01",
        code: "1330",
        heading: "Do Śródmieścia",
        endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=1330",
      },
      {
        id: "1331",
        label: "Płowce 02",
        code: "1331",
        heading: "Do Jasienia, Oliwy i lotniska",
        endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=1331",
      },
    ],
  },
];

const refreshButton = document.querySelector("#refreshButton");
const statusText = document.querySelector("#statusText");
const updatedText = document.querySelector("#updatedText");
const currentStopTitle = document.querySelector("#currentStopTitle");
const currentStopNote = document.querySelector("#currentStopNote");
const stopTabs = document.querySelector("#stopTabs");
const stopPanels = document.querySelector("#stopPanels");
const formatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

let activeGroupId = getInitialGroupId();

function getInitialGroupId() {
  const saved = localStorage.getItem("selectedStopGroup");
  return STOP_GROUPS.some((group) => group.id === saved) ? saved : STOP_GROUPS[0].id;
}

function renderShell() {
  stopTabs.innerHTML = STOP_GROUPS.map(
    (group) => `
      <button
        class="tab-button"
        id="tab-${group.id}"
        type="button"
        role="tab"
        aria-controls="panel-${group.id}"
        data-stop-group="${group.id}"
      >
        <span>${escapeHtml(group.label)}</span>
        <small>${group.stops.length} słupki</small>
      </button>
    `,
  ).join("");

  stopPanels.innerHTML = STOP_GROUPS.map(
    (group) => `
      <section
        class="departures stop-tab-panel"
        id="panel-${group.id}"
        role="tabpanel"
        aria-labelledby="tab-${group.id}"
      >
        ${group.stops.map(renderStopPanel).join("")}
      </section>
    `,
  ).join("");

  stopTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stop-group]");
    if (button) {
      const group = selectGroup(button.dataset.stopGroup);
      refreshDepartures(group.id);
    }
  });

  selectGroup(activeGroupId, { persist: false });
}

function renderStopPanel(stop) {
  return `
    <article class="stop-panel" data-stop-card="${escapeHtml(stop.id)}">
      <div class="stop-heading">
        <div>
          <p class="stop-code">Słupek ${escapeHtml(stop.code)}</p>
          <h2>${escapeHtml(stop.heading)}</h2>
        </div>
        <span class="direction-pill">${escapeHtml(stop.label)}</span>
      </div>
      <ul class="departure-list" id="departures-${escapeHtml(stop.id)}">
        <li class="empty-state">Ładowanie odjazdów...</li>
      </ul>
    </article>
  `;
}

function selectGroup(groupId, options = {}) {
  const group = STOP_GROUPS.find((candidate) => candidate.id === groupId) ?? STOP_GROUPS[0];
  activeGroupId = group.id;

  currentStopTitle.textContent = group.label;
  currentStopNote.textContent = group.note;
  document.title = `${group.label} | Odjazdy`;

  stopTabs.querySelectorAll("[data-stop-group]").forEach((button) => {
    const isSelected = button.dataset.stopGroup === group.id;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
    button.setAttribute("tabindex", isSelected ? "0" : "-1");
  });

  stopPanels.querySelectorAll(".stop-tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${group.id}`;
  });

  if (options.persist !== false) {
    localStorage.setItem("selectedStopGroup", group.id);
  }

  return group;
}

async function fetchStop(stop) {
  const response = await fetch(stop.endpoint, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Nie udało się pobrać danych dla ${stop.label}.`);
  }

  return response.json();
}

function departureDate(departure) {
  return departure.estimatedTime || departure.theoreticalTime;
}

function minutesUntil(date) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 60000);
}

function formatDepartureTime(departure) {
  const minutes = minutesUntil(departureDate(departure));

  if (minutes <= 0) {
    return "teraz";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return formatter.format(new Date(departureDate(departure)));
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
    .filter((departure) => minutesUntil(departureDate(departure)) >= -1)
    .sort((a, b) => new Date(departureDate(a)).getTime() - new Date(departureDate(b)).getTime())
    .slice(0, 8);

  if (!upcoming.length) {
    list.innerHTML = `<li class="empty-state">Brak najbliższych odjazdów.</li>`;
    return;
  }

  list.innerHTML = upcoming.map(renderDeparture).join("");
}

function renderStopError(stop, error) {
  const list = document.querySelector(`#departures-${stop.id}`);
  list.innerHTML = `
    <li class="empty-state error-state">
      ${escapeHtml(error.message || `Nie udało się pobrać danych dla ${stop.label}.`)}
    </li>
  `;
}

function renderDeparture(departure) {
  const minutes = minutesUntil(departureDate(departure));
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

async function refreshDepartures(groupId = activeGroupId) {
  const group = STOP_GROUPS.find((candidate) => candidate.id === groupId) ?? STOP_GROUPS[0];
  const isCurrentGroup = () => group.id === activeGroupId;

  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;
  statusText.textContent = "Odświeżanie...";

  const results = await Promise.allSettled(
    group.stops.map(async (stop) => [stop, await fetchStop(stop)]),
  );

  const successfulUpdates = [];
  let failures = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const [stop, data] = result.value;
      renderStop(stop, data);

      const lastUpdate = new Date(data.lastUpdate).getTime();
      if (Number.isFinite(lastUpdate)) {
        successfulUpdates.push(lastUpdate);
      }
      return;
    }

    failures += 1;
    renderStopError(group.stops[index], result.reason);
  });

  if (!isCurrentGroup()) {
    return;
  }

  const newestUpdate = successfulUpdates.sort((a, b) => b - a)[0];

  if (failures === group.stops.length) {
    statusText.textContent = "Nie udało się pobrać odjazdów.";
    updatedText.textContent = "Spróbuj odświeżyć";
  } else {
    statusText.textContent = failures ? "Część przystanków bez danych" : "Aktualne odjazdy";
    updatedText.textContent = newestUpdate ? `Dane z ${formatter.format(new Date(newestUpdate))}` : "";
  }

  refreshButton.classList.remove("is-loading");
  refreshButton.disabled = false;
}

renderShell();
refreshButton.addEventListener("click", () => refreshDepartures());
refreshDepartures();
setInterval(() => refreshDepartures(), 30000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
