import {
  mergeDefaultAndCatalogGroups,
  moveStop,
  normalizeSearchText,
  orderStops,
  parseGroupSelection,
  parseStopSettings,
  SELECTED_GROUPS_STORAGE_KEY,
  STOP_SETTINGS_STORAGE_KEY,
} from "./stop-preferences.mjs";

const DEPARTURES_ENDPOINT = "https://ckan2.multimediagdansk.pl/departures?stopId=";
const DEFAULT_STOP_GROUPS = [
  {
    id: "opacka",
    label: "Opacka",
    note: "Tramwaje i autobusy przy Opackiej",
    stops: [
      {
        id: "2048",
        label: "Opacka 02",
        code: "2048",
        endpoint: `${DEPARTURES_ENDPOINT}2048`,
      },
      {
        id: "2047",
        label: "Opacka 01",
        code: "2047",
        endpoint: `${DEPARTURES_ENDPOINT}2047`,
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
        endpoint: `${DEPARTURES_ENDPOINT}1330`,
      },
      {
        id: "1331",
        label: "Płowce 02",
        code: "1331",
        endpoint: `${DEPARTURES_ENDPOINT}1331`,
      },
    ],
  },
];
const DEFAULT_GROUP_IDS = DEFAULT_STOP_GROUPS.map((group) => group.id);
const MAX_MANAGER_RESULTS = 80;

const refreshButton = document.querySelector("#refreshButton");
const manageStopsButton = document.querySelector("#manageStopsButton");
const statusText = document.querySelector("#statusText");
const updatedText = document.querySelector("#updatedText");
const currentStopTitle = document.querySelector("#currentStopTitle");
const currentStopNote = document.querySelector("#currentStopNote");
const stopTabs = document.querySelector("#stopTabs");
const stopPanels = document.querySelector("#stopPanels");
const stopManagerDialog = document.querySelector("#stopManagerDialog");
const stopSearch = document.querySelector("#stopSearch");
const stopManagerStatus = document.querySelector("#stopManagerStatus");
const stopManagerList = document.querySelector("#stopManagerList");
const aliasDialog = document.querySelector("#aliasDialog");
const aliasForm = document.querySelector("#aliasForm");
const aliasStopName = document.querySelector("#aliasStopName");
const aliasInput = document.querySelector("#aliasInput");
const removeAliasButton = document.querySelector("#removeAliasButton");
const closeAliasButton = document.querySelector("#closeAliasButton");
const formatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

let availableGroups = [...DEFAULT_STOP_GROUPS];
let availableGroupsById = new Map(availableGroups.map((group) => [group.id, group]));
let selectedGroupIds = [];
let stopGroups = [];
let activeGroupId = null;
let catalogLoadError = "";
let refreshRequestId = 0;
let stopSettings = parseStopSettings(null);
let editedStop = null;

function normalizeCatalogGroup(group) {
  return {
    id: group.id,
    label: group.label,
    note: group.note,
    stops: group.stops.map((stop) => ({
      id: String(stop.id),
      label: stop.label,
      code: stop.code || stop.id,
      endpoint: `${DEPARTURES_ENDPOINT}${encodeURIComponent(stop.id)}`,
    })),
  };
}

async function loadStopCatalog() {
  const response = await fetch("./stops.json");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const snapshot = await response.json();
  if (!Array.isArray(snapshot.groups)) {
    throw new Error("Nieoczekiwany format katalogu przystanków.");
  }

  return snapshot.groups.map(normalizeCatalogGroup);
}

function getSavedGroupIds() {
  return parseGroupSelection(
    localStorage.getItem(SELECTED_GROUPS_STORAGE_KEY),
    new Set(availableGroupsById.keys()),
    DEFAULT_GROUP_IDS,
  );
}

function getInitialGroupId() {
  const saved = localStorage.getItem("selectedStopGroup");
  return selectedGroupIds.includes(saved) ? saved : selectedGroupIds[0] || null;
}

function resolveSelectedGroups(groupIds) {
  return groupIds
    .map((groupId) => availableGroupsById.get(groupId))
    .filter(Boolean)
    .map((group) => ({
      ...group,
      stops: orderStops(group.stops, stopSettings.order[group.id]),
    }));
}

function formatStopCount(count) {
  return `${count} ${count === 1 ? "słupek" : "słupki"}`;
}

function renderShell() {
  if (!stopGroups.length) {
    stopTabs.innerHTML = "";
    stopPanels.innerHTML = `
      <section class="no-stops-panel">
        <h2>Nie masz jeszcze wybranych przystanków</h2>
        <p>Otwórz „Moje przystanki”, wyszukaj przystanek i dodaj go do swoich zakładek.</p>
        <button class="primary-button" type="button" data-open-stop-manager>Dodaj przystanek</button>
      </section>
    `;
    currentStopTitle.textContent = "Moje przystanki";
    currentStopNote.textContent = "Wybierz przystanki, które chcesz odświeżać";
    statusText.textContent = "Brak wybranych przystanków";
    updatedText.textContent = "";
    refreshButton.disabled = true;
    document.title = "Moje przystanki | Odjazdy";
    return;
  }

  stopTabs.innerHTML = stopGroups
    .map(
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
          <small>${formatStopCount(group.stops.length)}</small>
        </button>
      `,
    )
    .join("");

  stopPanels.innerHTML = stopGroups
    .map(
      (group) => `
        <section
          class="departures stop-tab-panel"
          id="panel-${group.id}"
          role="tabpanel"
          aria-labelledby="tab-${group.id}"
        >
          ${group.stops.map((stop, index) => renderStopPanel(group, stop, index)).join("")}
        </section>
      `,
    )
    .join("");

  refreshButton.disabled = false;
  selectGroup(activeGroupId, { persist: false });
}

function stopSettingsKey(stopReference) {
  return `${stopReference.groupId}:${stopReference.stopId}`;
}

function isStopCollapsed(stopReference) {
  return stopSettings.collapsed.includes(stopSettingsKey(stopReference));
}

function renderStopPanel(group, stop, index) {
  const stopReference = { groupId: group.id, stopId: stop.id };
  const preferenceKey = stopSettingsKey(stopReference);
  const isCollapsed = stopSettings.collapsed.includes(preferenceKey);
  const alias = stopSettings.aliases[preferenceKey];
  const displayLabel = alias || stop.label;
  const originalNameTitle = alias ? ` title="Oryginalna nazwa: ${escapeHtml(stop.label)}"` : "";

  return `
    <article class="stop-panel ${isCollapsed ? "is-collapsed" : ""}" data-stop-card="${escapeHtml(stop.id)}">
      <div class="stop-heading">
        <button
          class="stop-title-button"
          type="button"
          data-toggle-stop-details
          data-group-id="${group.id}"
          data-stop-id="${escapeHtml(stop.id)}"
          aria-expanded="${!isCollapsed}"
          title="${isCollapsed ? "Rozwiń" : "Zwiń"} ${escapeHtml(displayLabel)}"
        >
          <svg class="collapse-chevron" aria-hidden="true" viewBox="0 0 24 24">
            <path d="m7 10 5 5 5-5"></path>
          </svg>
          <span${originalNameTitle}>${escapeHtml(displayLabel)}</span>
        </button>
        <div class="stop-card-actions">
          <button
            class="stop-action-button"
            type="button"
            data-move-stop="earlier"
            data-group-id="${group.id}"
            data-stop-id="${escapeHtml(stop.id)}"
            aria-label="Przesuń ${escapeHtml(displayLabel)} wcześniej"
            title="Przesuń wcześniej"
            ${index === 0 ? "disabled" : ""}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 14 5-5 5 5"></path></svg>
          </button>
          <button
            class="stop-action-button"
            type="button"
            data-move-stop="later"
            data-group-id="${group.id}"
            data-stop-id="${escapeHtml(stop.id)}"
            aria-label="Przesuń ${escapeHtml(displayLabel)} później"
            title="Przesuń później"
            ${index === group.stops.length - 1 ? "disabled" : ""}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"></path></svg>
          </button>
          <button
            class="stop-action-button ${alias ? "has-alias" : ""}"
            type="button"
            data-edit-stop-alias
            data-group-id="${group.id}"
            data-stop-id="${escapeHtml(stop.id)}"
            aria-label="Zmień nazwę ${escapeHtml(stop.label)}"
            title="Nadaj alias"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="stop-details" ${isCollapsed ? "hidden" : ""}>
        <ul class="departure-list" id="departures-${escapeHtml(stop.id)}">
          <li class="empty-state">Ładowanie odjazdów...</li>
        </ul>
      </div>
    </article>
  `;
}

function selectGroup(groupId, options = {}) {
  const group = stopGroups.find((candidate) => candidate.id === groupId) || stopGroups[0];
  if (!group) {
    activeGroupId = null;
    return null;
  }

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

function saveSelectedGroups(nextIds, preferredActiveId = activeGroupId) {
  selectedGroupIds = [...new Set(nextIds)].filter((groupId) => availableGroupsById.has(groupId));
  localStorage.setItem(SELECTED_GROUPS_STORAGE_KEY, JSON.stringify(selectedGroupIds));
  stopGroups = resolveSelectedGroups(selectedGroupIds);
  activeGroupId = selectedGroupIds.includes(preferredActiveId)
    ? preferredActiveId
    : selectedGroupIds[0] || null;

  renderShell();
  renderStopManager();

  if (activeGroupId) {
    refreshDepartures(activeGroupId);
  }
}

function persistStopSettingsAndRefresh() {
  localStorage.setItem(STOP_SETTINGS_STORAGE_KEY, JSON.stringify(stopSettings));
  stopGroups = resolveSelectedGroups(selectedGroupIds);
  renderShell();

  if (activeGroupId) {
    refreshDepartures(activeGroupId);
  }
}

function toggleStopDetails(stopReference) {
  const preferenceKey = stopSettingsKey(stopReference);
  const collapsed = new Set(stopSettings.collapsed);

  if (collapsed.has(preferenceKey)) {
    collapsed.delete(preferenceKey);
  } else {
    collapsed.add(preferenceKey);
  }

  stopSettings = { ...stopSettings, collapsed: [...collapsed] };
  persistStopSettingsAndRefresh();
}

function reorderStop(stopReference, direction) {
  const group = stopGroups.find((candidate) => candidate.id === stopReference.groupId);
  if (!group) {
    return;
  }

  stopSettings = {
    ...stopSettings,
    order: {
      ...stopSettings.order,
      [stopReference.groupId]: moveStop(group.stops, stopReference.stopId, direction),
    },
  };
  persistStopSettingsAndRefresh();
}

function openAliasEditor(stopReference) {
  const group = stopGroups.find((candidate) => candidate.id === stopReference.groupId);
  const stop = group?.stops.find((candidate) => candidate.id === stopReference.stopId);
  if (!stop) {
    return;
  }

  const preferenceKey = stopSettingsKey(stopReference);
  editedStop = stopReference;
  aliasStopName.textContent = stop.label;
  aliasInput.value = stopSettings.aliases[preferenceKey] || "";
  removeAliasButton.hidden = !stopSettings.aliases[preferenceKey];
  aliasDialog.showModal();
  aliasInput.focus();
  aliasInput.select();
}

function setEditedStopAlias(value) {
  if (!editedStop) {
    return;
  }

  const preferenceKey = stopSettingsKey(editedStop);
  const aliases = { ...stopSettings.aliases };
  const alias = value.trim();

  if (alias) {
    aliases[preferenceKey] = alias;
  } else {
    delete aliases[preferenceKey];
  }

  stopSettings = { ...stopSettings, aliases };
  editedStop = null;
  aliasDialog.close();
  persistStopSettingsAndRefresh();
}

function toggleGroup(groupId) {
  if (selectedGroupIds.includes(groupId)) {
    const removedIndex = selectedGroupIds.indexOf(groupId);
    const nextIds = selectedGroupIds.filter((candidate) => candidate !== groupId);
    const nextActiveId =
      groupId === activeGroupId
        ? nextIds[Math.min(removedIndex, nextIds.length - 1)] || null
        : activeGroupId;
    saveSelectedGroups(nextIds, nextActiveId);
    return;
  }

  saveSelectedGroups([...selectedGroupIds, groupId], activeGroupId || groupId);
}

function groupSearchText(group) {
  const stopIdentifiers = group.stops.map((stop) => `${stop.code} ${stop.id}`).join(" ");
  return normalizeSearchText(`${group.label} ${group.note} ${stopIdentifiers}`);
}

function renderStopManager() {
  const query = normalizeSearchText(stopSearch.value);
  const matchingGroups = availableGroups.filter(
    (group) => !query || groupSearchText(group).includes(query),
  );
  const visibleGroups = matchingGroups.slice(0, MAX_MANAGER_RESULTS);

  if (catalogLoadError) {
    stopManagerStatus.textContent = catalogLoadError;
  } else if (!matchingGroups.length) {
    stopManagerStatus.textContent = "Nie znaleziono takiego przystanku.";
  } else if (matchingGroups.length > visibleGroups.length) {
    stopManagerStatus.textContent = `Znaleziono ${matchingGroups.length} zespołów. Wpisz nazwę, aby zawęzić wyniki.`;
  } else {
    stopManagerStatus.textContent = `${matchingGroups.length} ${matchingGroups.length === 1 ? "zespół" : "zespołów przystankowych"}`;
  }

  stopManagerList.innerHTML = visibleGroups
    .map((group) => {
      const isSelected = selectedGroupIds.includes(group.id);
      return `
        <li class="stop-manager-item">
          <div>
            <strong>${escapeHtml(group.label)}</strong>
            <span>${escapeHtml(group.note)} · ${formatStopCount(group.stops.length)}</span>
          </div>
          <button
            class="toggle-stop-button ${isSelected ? "is-selected" : ""}"
            type="button"
            data-toggle-stop-group="${group.id}"
            aria-pressed="${isSelected}"
          >
            ${isSelected ? "Usuń" : "Dodaj"}
          </button>
        </li>
      `;
    })
    .join("");
}

function openStopManager() {
  renderStopManager();
  stopManagerDialog.showModal();
  stopSearch.focus();
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
  if (!list) {
    return;
  }

  const upcoming = data.departures
    .filter((departure) => minutesUntil(departureDate(departure)) >= -1)
    .sort((a, b) => new Date(departureDate(a)).getTime() - new Date(departureDate(b)).getTime())
    .slice(0, 8);

  if (!upcoming.length) {
    list.innerHTML = '<li class="empty-state">Brak najbliższych odjazdów.</li>';
    return;
  }

  list.innerHTML = upcoming.map(renderDeparture).join("");
}

function renderStopError(stop, error) {
  const list = document.querySelector(`#departures-${stop.id}`);
  if (!list) {
    return;
  }

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
  const group = stopGroups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return;
  }

  const visibleStops = group.stops.filter(
    (stop) => !isStopCollapsed({ groupId: group.id, stopId: stop.id }),
  );
  if (!visibleStops.length) {
    refreshRequestId += 1;
    refreshButton.classList.remove("is-loading");
    refreshButton.disabled = false;
    statusText.textContent = "Wszystkie słupki są zwinięte";
    updatedText.textContent = "";
    return;
  }

  const requestId = ++refreshRequestId;
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;
  statusText.textContent = "Odświeżanie...";

  const results = await Promise.allSettled(
    visibleStops.map(async (stop) => [stop, await fetchStop(stop)]),
  );

  if (requestId !== refreshRequestId) {
    return;
  }

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
    renderStopError(visibleStops[index], result.reason);
  });

  if (group.id !== activeGroupId) {
    return;
  }

  const newestUpdate = successfulUpdates.sort((a, b) => b - a)[0];
  if (failures === visibleStops.length) {
    statusText.textContent = "Nie udało się pobrać odjazdów.";
    updatedText.textContent = "Spróbuj odświeżyć";
  } else {
    statusText.textContent = failures ? "Część przystanków bez danych" : "Aktualne odjazdy";
    updatedText.textContent = newestUpdate ? `Dane z ${formatter.format(new Date(newestUpdate))}` : "";
  }

  refreshButton.classList.remove("is-loading");
  refreshButton.disabled = false;
}

function stopReferenceFromElement(element) {
  return {
    groupId: element.dataset.groupId,
    stopId: element.dataset.stopId,
  };
}

function registerEventListeners() {
  stopTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stop-group]");
    if (button) {
      const group = selectGroup(button.dataset.stopGroup);
      refreshDepartures(group.id);
    }
  });

  stopPanels.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-stop-manager]")) {
      openStopManager();
      return;
    }

    const toggleButton = event.target.closest("[data-toggle-stop-details]");
    if (toggleButton) {
      toggleStopDetails(stopReferenceFromElement(toggleButton));
      return;
    }

    const moveButton = event.target.closest("[data-move-stop]");
    if (moveButton) {
      reorderStop(stopReferenceFromElement(moveButton), moveButton.dataset.moveStop);
      return;
    }

    const aliasButton = event.target.closest("[data-edit-stop-alias]");
    if (aliasButton) {
      openAliasEditor(stopReferenceFromElement(aliasButton));
    }
  });

  refreshButton.addEventListener("click", () => refreshDepartures());
  manageStopsButton.addEventListener("click", openStopManager);
  stopSearch.addEventListener("input", renderStopManager);
  stopManagerList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle-stop-group]");
    if (button) {
      toggleGroup(button.dataset.toggleStopGroup);
    }
  });
  stopManagerDialog.addEventListener("click", (event) => {
    if (event.target === stopManagerDialog) {
      stopManagerDialog.close();
    }
  });
  aliasForm.addEventListener("submit", (event) => {
    event.preventDefault();
    setEditedStopAlias(aliasInput.value);
  });
  removeAliasButton.addEventListener("click", () => setEditedStopAlias(""));
  closeAliasButton.addEventListener("click", () => aliasDialog.close());
  aliasDialog.addEventListener("click", (event) => {
    if (event.target === aliasDialog) {
      aliasDialog.close();
    }
  });
  aliasDialog.addEventListener("close", () => {
    editedStop = null;
  });
}

async function initialize() {
  registerEventListeners();

  try {
    availableGroups = mergeDefaultAndCatalogGroups(
      DEFAULT_STOP_GROUPS,
      await loadStopCatalog(),
    );
  } catch (error) {
    catalogLoadError = "Pełna lista przystanków jest chwilowo niedostępna. Nadal możesz używać Opackiej i Płowców.";
    console.error("Nie udało się wczytać katalogu przystanków.", error);
  }

  availableGroupsById = new Map(availableGroups.map((group) => [group.id, group]));
  stopSettings = parseStopSettings(localStorage.getItem(STOP_SETTINGS_STORAGE_KEY));
  selectedGroupIds = getSavedGroupIds();
  stopGroups = resolveSelectedGroups(selectedGroupIds);
  activeGroupId = getInitialGroupId();
  renderShell();
  renderStopManager();

  if (activeGroupId) {
    refreshDepartures();
  }
}

initialize();
setInterval(() => {
  if (activeGroupId) {
    refreshDepartures();
  }
}, 30000);

if ("serviceWorker" in navigator) {
  let isReloadingForNewServiceWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isReloadingForNewServiceWorker) {
      return;
    }
    isReloadingForNewServiceWorker = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("sw.js")
    .then((registration) => {
      registration.update().catch(() => {});
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) {
          return;
        }
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    })
    .catch(() => {});
}
