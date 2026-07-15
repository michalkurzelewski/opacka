export const SELECTED_GROUPS_STORAGE_KEY = "selectedStopGroups";
export const STOP_SETTINGS_STORAGE_KEY = "stopSettings";

export function parseGroupSelection(rawValue, availableIds, defaultIds) {
  if (rawValue === null) {
    return [...defaultIds];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [...defaultIds];
    }

    return [
      ...new Set(parsed.filter((groupId) => typeof groupId === "string" && availableIds.has(groupId))),
    ];
  } catch {
    return [...defaultIds];
  }
}

export function normalizeSearchText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

export function mergeDefaultAndCatalogGroups(defaultGroups, catalogGroups) {
  const defaultLabels = new Set(defaultGroups.map((group) => normalizeSearchText(group.label)));
  const mergedDefaults = defaultGroups.map((defaultGroup) => {
    const matchingCatalogGroup = catalogGroups.find(
      (group) => normalizeSearchText(group.label) === normalizeSearchText(defaultGroup.label),
    );

    if (!matchingCatalogGroup) {
      return defaultGroup;
    }

    const defaultStopIds = new Set(defaultGroup.stops.map((stop) => stop.id));
    return {
      ...defaultGroup,
      stops: [
        ...defaultGroup.stops,
        ...matchingCatalogGroup.stops.filter((stop) => !defaultStopIds.has(stop.id)),
      ],
    };
  });

  return [
    ...mergedDefaults,
    ...catalogGroups.filter((group) => !defaultLabels.has(normalizeSearchText(group.label))),
  ];
}

function emptyStopSettings() {
  return { aliases: {}, collapsed: [], order: {} };
}

export function parseStopSettings(rawValue) {
  if (rawValue === null) {
    return emptyStopSettings();
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyStopSettings();
    }

    const aliases = Object.fromEntries(
      Object.entries(parsed.aliases || {}).filter(
        ([key, value]) => typeof key === "string" && typeof value === "string" && value.trim(),
      ),
    );
    const collapsed = [
      ...new Set(
        (Array.isArray(parsed.collapsed) ? parsed.collapsed : []).filter(
          (key) => typeof key === "string",
        ),
      ),
    ];
    const order = Object.fromEntries(
      Object.entries(parsed.order || {})
        .filter(([, stopIds]) => Array.isArray(stopIds))
        .map(([groupId, stopIds]) => [
          groupId,
          [...new Set(stopIds.filter((stopId) => typeof stopId === "string"))],
        ]),
    );

    return { aliases, collapsed, order };
  } catch {
    return emptyStopSettings();
  }
}

export function orderStops(stops, savedOrder = []) {
  const stopsById = new Map(stops.map((stop) => [stop.id, stop]));
  const orderedStops = savedOrder.map((stopId) => stopsById.get(stopId)).filter(Boolean);
  const orderedIds = new Set(orderedStops.map((stop) => stop.id));

  return [...orderedStops, ...stops.filter((stop) => !orderedIds.has(stop.id))];
}

export function updateGroupStopSettings(settings, groupId, draft) {
  const groupPrefix = `${groupId}:`;
  const aliases = Object.fromEntries(
    Object.entries(settings.aliases).filter(([key]) => !key.startsWith(groupPrefix)),
  );

  Object.entries(draft.aliases).forEach(([stopId, value]) => {
    const alias = typeof value === "string" ? value.trim() : "";
    if (alias) {
      aliases[`${groupPrefix}${stopId}`] = alias;
    }
  });

  const collapsed = [
    ...settings.collapsed.filter((key) => !key.startsWith(groupPrefix)),
    ...draft.hiddenStopIds.map((stopId) => `${groupPrefix}${stopId}`),
  ];

  return {
    aliases,
    collapsed,
    order: {
      ...settings.order,
      [groupId]: [...draft.order],
    },
  };
}
