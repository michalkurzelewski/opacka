import {
  mergeDefaultAndCatalogGroups,
  normalizeSearchText,
  orderStops,
  parseGroupSelection,
  parseStopSettings,
  SELECTED_GROUPS_STORAGE_KEY,
  STOP_SETTINGS_STORAGE_KEY,
  updateGroupStopSettings,
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
const statusText = document.querySelector("#statusText");
const stopTabs = document.querySelector("#stopTabs");
const stopPanels = document.querySelector("#stopPanels");
const stopManagerDialog = document.querySelector("#stopManagerDialog");
const stopSearch = document.querySelector("#stopSearch");
const stopManagerStatus = document.querySelector("#stopManagerStatus");
const stopManagerList = document.querySelector("#stopManagerList");
const stopEditorDialog = document.querySelector("#stopEditorDialog");
const stopEditorForm = document.querySelector("#stopEditorForm");
const stopEditorTitle = document.querySelector("#stopEditorTitle");
const stopEditorList = document.querySelector("#stopEditorList");
const closeStopEditorButton = document.querySelector("#closeStopEditorButton");
const cancelStopEditorButton = document.querySelector("#cancelStopEditorButton");
const deleteStopGroupButton = document.querySelector("#deleteStopGroupButton");
const deleteStopGroupConfirmation = document.querySelector("#deleteStopGroupConfirmation");
const deleteStopGroupMessage = document.querySelector("#deleteStopGroupMessage");
const cancelDeleteStopGroupButton = document.querySelector("#cancelDeleteStopGroupButton");
const confirmDeleteStopGroupButton = document.querySelector("#confirmDeleteStopGroupButton");
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
const latestUpdateByGroupId = new Map();
let stopSettings = parseStopSettings(null);
let editedGroupId = null;

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
  const addStopButton = `
    <button class="add-stop-button" type="button" data-open-stop-manager aria-label="Dodaj przystanek" title="Dodaj przystanek">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
    </button>
  `;

  if (!stopGroups.length) {
    stopTabs.innerHTML = addStopButton;
    stopPanels.innerHTML = `
      <section class="no-stops-panel">
        <h2>Nie masz jeszcze wybranych przystanków</h2>
        <p>Otwórz „Moje przystanki”, wyszukaj przystanek i dodaj go do swoich zakładek.</p>
        <button class="primary-button" type="button" data-open-stop-manager>Dodaj przystanek</button>
      </section>
    `;
    statusText.textContent = "Brak wybranych przystanków";
    refreshButton.disabled = true;
    document.title = "Moje przystanki | Odjazdy";
    return;
  }

  stopTabs.innerHTML = `
    <div class="stop-tab-list" role="tablist">
      ${stopGroups
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
        </button>
      `,
        )
        .join("")}
    </div>
    ${addStopButton}
  `;

  stopPanels.innerHTML = stopGroups
    .map(
      (group) => {
        const visibleStops = group.stops.filter(
          (stop) => !isStopHidden({ groupId: group.id, stopId: stop.id }),
        );
        return `
        <section
          class="departures stop-tab-panel"
          id="panel-${group.id}"
          role="tabpanel"
          aria-labelledby="tab-${group.id}"
        >
          ${
            visibleStops.length
              ? visibleStops.map((stop) => renderStopPanel(group, stop)).join("")
              : '<p class="no-visible-stops">Brak widocznych słupków. Naciśnij aktywną zakładkę ponownie, aby je przywrócić.</p>'
          }
        </section>
      `;
      },
    )
    .join("");

  refreshButton.disabled = false;
  selectGroup(activeGroupId, { persist: false });
}

function renderLatestUpdate(groupId = activeGroupId) {
  const latestUpdate = latestUpdateByGroupId.get(groupId);
  statusText.textContent = latestUpdate
    ? `Dane z ${formatter.format(new Date(latestUpdate))}`
    : "Brak aktualnych danych";
}

function stopSettingsKey(stopReference) {
  return `${stopReference.groupId}:${stopReference.stopId}`;
}

function isStopHidden(stopReference) {
  return stopSettings.collapsed.includes(stopSettingsKey(stopReference));
}

function renderStopPanel(group, stop) {
  const stopReference = { groupId: group.id, stopId: stop.id };
  const preferenceKey = stopSettingsKey(stopReference);
  const alias = stopSettings.aliases[preferenceKey];
  const displayLabel = alias || stop.label;
  const originalNameTitle = alias ? ` title="Oryginalna nazwa: ${escapeHtml(stop.label)}"` : "";

  return `
    <article class="stop-panel" data-stop-card="${escapeHtml(stop.id)}">
      <div class="stop-heading">
        <h2 class="stop-title"${originalNameTitle}>${escapeHtml(displayLabel)}</h2>
      </div>
      <div class="stop-details">
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
  document.title = `${group.label} | Odjazdy`;
  renderLatestUpdate(group.id);

  stopTabs.querySelectorAll("[data-stop-group]").forEach((button) => {
    const isSelected = button.dataset.stopGroup === group.id;
    const buttonGroup = stopGroups.find(
      (candidate) => candidate.id === button.dataset.stopGroup,
    );
    const buttonLabel = buttonGroup?.label || button.textContent.trim();
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
    button.setAttribute("tabindex", isSelected ? "0" : "-1");
    button.setAttribute(
      "aria-label",
      isSelected
        ? `${buttonLabel}, aktywna. Naciśnij ponownie, aby edytować.`
        : buttonLabel,
    );
    button.title = isSelected ? "Naciśnij ponownie, aby edytować" : "";
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

function visibilityIcon(isHidden) {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
      <circle cx="12" cy="12" r="2.5"></circle>
      ${isHidden ? '<path d="m4 4 16 16"></path>' : ""}
    </svg>
  `;
}

function renderStopEditorItem(group, stop) {
  const preferenceKey = stopSettingsKey({ groupId: group.id, stopId: stop.id });
  const isHidden = stopSettings.collapsed.includes(preferenceKey);
  const alias = stopSettings.aliases[preferenceKey] || "";

  return `
    <li class="stop-editor-item ${isHidden ? "is-hidden" : ""}" data-stop-editor-id="${escapeHtml(stop.id)}">
      <div class="stop-editor-move-controls">
        <button class="editor-icon-button" type="button" data-editor-move="earlier" aria-label="Przesuń ${escapeHtml(stop.label)} wcześniej" title="Przesuń wcześniej">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 14 5-5 5 5"></path></svg>
        </button>
        <button class="editor-icon-button" type="button" data-editor-move="later" aria-label="Przesuń ${escapeHtml(stop.label)} później" title="Przesuń później">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"></path></svg>
        </button>
      </div>
      <input class="stop-editor-name" type="text" maxlength="40" value="${escapeHtml(alias)}" placeholder="${escapeHtml(stop.label)}" aria-label="Nazwa ${escapeHtml(stop.label)}" data-stop-editor-alias autocomplete="off">
      <button
        class="editor-icon-button visibility-button"
        type="button"
        data-toggle-editor-visibility
        aria-pressed="${isHidden}"
        aria-label="${isHidden ? "Pokaż" : "Ukryj"} ${escapeHtml(stop.label)}"
        title="${isHidden ? "Pokaż słupek" : "Ukryj słupek"}"
      >
        ${visibilityIcon(isHidden)}
      </button>
    </li>
  `;
}

function updateStopEditorMoveButtons() {
  const items = [...stopEditorList.querySelectorAll("[data-stop-editor-id]")];
  items.forEach((item, index) => {
    item.querySelector('[data-editor-move="earlier"]').disabled = index === 0;
    item.querySelector('[data-editor-move="later"]').disabled = index === items.length - 1;
  });
}

function resetDeleteStopGroupConfirmation() {
  deleteStopGroupButton.hidden = false;
  deleteStopGroupConfirmation.hidden = true;
}

function openStopEditor(groupId) {
  const group = stopGroups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return;
  }

  editedGroupId = group.id;
  stopEditorTitle.textContent = group.label;
  stopEditorList.innerHTML = group.stops.map((stop) => renderStopEditorItem(group, stop)).join("");
  deleteStopGroupButton.textContent = `Usuń ${group.label} z moich przystanków`;
  deleteStopGroupMessage.textContent = `Czy na pewno chcesz usunąć ${group.label} z zakładek?`;
  resetDeleteStopGroupConfirmation();
  updateStopEditorMoveButtons();
  stopEditorDialog.showModal();
}

function moveStopEditorItem(button, direction) {
  const item = button.closest("[data-stop-editor-id]");
  const sibling = direction === "earlier" ? item.previousElementSibling : item.nextElementSibling;
  if (!sibling) {
    return;
  }

  if (direction === "earlier") {
    stopEditorList.insertBefore(item, sibling);
  } else {
    stopEditorList.insertBefore(sibling, item);
  }
  updateStopEditorMoveButtons();
}

function toggleStopEditorVisibility(button) {
  const item = button.closest("[data-stop-editor-id]");
  const isHidden = !item.classList.contains("is-hidden");
  const group = stopGroups.find((candidate) => candidate.id === editedGroupId);
  const stop = group?.stops.find((candidate) => candidate.id === item.dataset.stopEditorId);

  item.classList.toggle("is-hidden", isHidden);
  button.setAttribute("aria-pressed", String(isHidden));
  button.setAttribute("aria-label", `${isHidden ? "Pokaż" : "Ukryj"} ${stop?.label || "słupek"}`);
  button.title = isHidden ? "Pokaż słupek" : "Ukryj słupek";
  button.innerHTML = visibilityIcon(isHidden);
}

function saveStopEditor() {
  if (!editedGroupId) {
    return;
  }

  const items = [...stopEditorList.querySelectorAll("[data-stop-editor-id]")];
  const draft = {
    aliases: Object.fromEntries(
      items.map((item) => [item.dataset.stopEditorId, item.querySelector("[data-stop-editor-alias]").value]),
    ),
    hiddenStopIds: items
      .filter((item) => item.classList.contains("is-hidden"))
      .map((item) => item.dataset.stopEditorId),
    order: items.map((item) => item.dataset.stopEditorId),
  };

  stopSettings = updateGroupStopSettings(stopSettings, editedGroupId, draft);
  stopEditorDialog.close();
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
    (stop) => !isStopHidden({ groupId: group.id, stopId: stop.id }),
  );
  if (!visibleStops.length) {
    refreshRequestId += 1;
    refreshButton.classList.remove("is-loading");
    refreshButton.disabled = false;
    renderLatestUpdate(group.id);
    return;
  }

  const requestId = ++refreshRequestId;
  refreshButton.classList.add("is-loading");
  refreshButton.disabled = true;
  if (!latestUpdateByGroupId.has(group.id)) {
    statusText.textContent = "Pobieranie danych...";
  }

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
  if (failures < visibleStops.length && newestUpdate) {
    latestUpdateByGroupId.set(group.id, newestUpdate);
  }
  renderLatestUpdate(group.id);

  refreshButton.classList.remove("is-loading");
  refreshButton.disabled = false;
}

function openStopManagerFromEvent(event) {
  if (!event.target.closest("[data-open-stop-manager]")) {
    return false;
  }

  openStopManager();
  return true;
}

function registerEventListeners() {
  stopTabs.addEventListener("click", (event) => {
    if (openStopManagerFromEvent(event)) {
      return;
    }

    const button = event.target.closest("[data-stop-group]");
    if (button) {
      if (button.dataset.stopGroup === activeGroupId) {
        openStopEditor(activeGroupId);
        return;
      }

      const group = selectGroup(button.dataset.stopGroup);
      refreshDepartures(group.id);
    }
  });

  stopPanels.addEventListener("click", (event) => {
    openStopManagerFromEvent(event);
  });

  refreshButton.addEventListener("click", () => refreshDepartures());
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
  stopEditorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveStopEditor();
  });
  stopEditorList.addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-editor-move]");
    if (moveButton) {
      moveStopEditorItem(moveButton, moveButton.dataset.editorMove);
      return;
    }

    const visibilityButton = event.target.closest("[data-toggle-editor-visibility]");
    if (visibilityButton) {
      toggleStopEditorVisibility(visibilityButton);
    }
  });
  closeStopEditorButton.addEventListener("click", () => stopEditorDialog.close());
  cancelStopEditorButton.addEventListener("click", () => stopEditorDialog.close());
  deleteStopGroupButton.addEventListener("click", () => {
    deleteStopGroupButton.hidden = true;
    deleteStopGroupConfirmation.hidden = false;
  });
  cancelDeleteStopGroupButton.addEventListener("click", resetDeleteStopGroupConfirmation);
  confirmDeleteStopGroupButton.addEventListener("click", () => {
    const groupId = editedGroupId;
    stopEditorDialog.close();
    if (groupId) {
      toggleGroup(groupId);
    }
  });
  stopEditorDialog.addEventListener("click", (event) => {
    if (event.target === stopEditorDialog) {
      stopEditorDialog.close();
    }
  });
  stopEditorDialog.addEventListener("close", () => {
    editedGroupId = null;
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
