import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { normalizeSourceStop } from "../stop-catalog.mjs";

const SOURCE_URL =
  "https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/d3e96eb6-25ad-4d6c-8651-b1eb39155945/download/stopsingdansk.json";
const OUTPUT_URL = new URL("../stops.json", import.meta.url);
const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

function catalogGroupId(zoneName, stopName) {
  const digest = createHash("sha256")
    .update(`${zoneName}\u0000${stopName}`)
    .digest("hex")
    .slice(0, 12);

  return `ztm-${digest}`;
}

function isPassengerStop(stop) {
  return !stop.virtual && !stop.nonpassenger && !stop.depot && stop.stopName;
}

function buildGroups(stops) {
  const grouped = new Map();

  stops.filter(isPassengerStop).forEach((stop) => {
    const zoneName = String(stop.zoneName || "Inna strefa").trim();
    const stopName = String(stop.stopName).trim();
    const key = `${zoneName}\u0000${stopName}`;
    const group = grouped.get(key) || {
      id: catalogGroupId(zoneName, stopName),
      label: stopName,
      note: zoneName,
      stops: [],
    };

    group.stops.push(normalizeSourceStop(stop));
    grouped.set(key, group);
  });

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      stops: group.stops.sort((a, b) => collator.compare(a.code, b.code)),
    }))
    .sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.note, b.note));
}

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Nie udało się pobrać listy przystanków: HTTP ${response.status}`);
}

const source = await response.json();
if (!Array.isArray(source.stops)) {
  throw new Error("Nieoczekiwany format listy przystanków.");
}

const snapshot = {
  source: SOURCE_URL,
  sourceLastUpdate: source.lastUpdate || null,
  generatedAt: new Date().toISOString(),
  groups: buildGroups(source.stops),
};

await writeFile(OUTPUT_URL, `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(
  `Zapisano ${snapshot.groups.length} zespołów przystankowych do ${fileURLToPath(OUTPUT_URL)}.`,
);
