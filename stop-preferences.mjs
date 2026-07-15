export const SELECTED_GROUPS_STORAGE_KEY = "selectedStopGroups";

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
