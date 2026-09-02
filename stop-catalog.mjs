export const DEPARTURES_ENDPOINT =
  "https://ckan2.multimediagdansk.pl/departures?stopId=";

export function normalizeSourceStop(stop) {
  const code = String(stop.subName || stop.stopCode || "").trim();
  const id = String(stop.stopShortName || stop.stopId).trim();
  const departuresStopId = String(stop.stopId || stop.stopShortName).trim();

  return {
    id,
    departuresStopId,
    code,
    label: code ? `${stop.stopName} ${code}` : stop.stopName,
    type: stop.type || "",
  };
}

export function normalizeCatalogGroup(group) {
  return {
    id: group.id,
    label: group.label,
    note: group.note,
    stops: group.stops.map((stop) => {
      const id = String(stop.id);
      const departuresStopId = String(stop.departuresStopId || stop.id);

      return {
        id,
        departuresStopId,
        label: stop.label,
        code: stop.code || id,
        endpoint: `${DEPARTURES_ENDPOINT}${encodeURIComponent(departuresStopId)}`,
      };
    }),
  };
}

export function parseStopCatalog(snapshot) {
  if (!Array.isArray(snapshot?.groups)) {
    throw new Error("Nieoczekiwany format katalogu przystanków.");
  }

  return snapshot.groups.map(normalizeCatalogGroup);
}
