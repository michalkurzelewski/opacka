import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeCatalogGroup,
  normalizeSourceStop,
  parseStopCatalog,
} from "../stop-catalog.mjs";

const snapshot = JSON.parse(
  await readFile(new URL("../stops.json", import.meta.url), "utf8"),
);

test("keeps the public stop number separate from the departures API stop id", () => {
  assert.deepEqual(
    normalizeSourceStop({
      stopId: 14551,
      stopShortName: "1678",
      stopName: "Biblioteka Główna UG",
      subName: "01",
      type: "BUS",
    }),
    {
      id: "1678",
      departuresStopId: "14551",
      code: "01",
      label: "Biblioteka Główna UG 01",
      type: "BUS",
    },
  );
});

test("builds a departures endpoint from the technical stop id", () => {
  assert.deepEqual(
    normalizeCatalogGroup({
      id: "ztm-library",
      label: "Biblioteka Główna UG",
      note: "Gdańsk",
      stops: [
        {
          id: "1678",
          departuresStopId: "14551",
          code: "01",
          label: "Biblioteka Główna UG 01",
        },
      ],
    }),
    {
      id: "ztm-library",
      label: "Biblioteka Główna UG",
      note: "Gdańsk",
      stops: [
        {
          id: "1678",
          departuresStopId: "14551",
          code: "01",
          label: "Biblioteka Główna UG 01",
          endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=14551",
        },
      ],
    },
  );
});

test("supports snapshots created before departuresStopId was added", () => {
  const [stop] = normalizeCatalogGroup({
    id: "ztm-legacy",
    label: "Starszy katalog",
    note: "Gdańsk",
    stops: [{ id: "2048", code: "02", label: "Opacka 02" }],
  }).stops;

  assert.equal(stop.departuresStopId, "2048");
  assert.equal(
    stop.endpoint,
    "https://ckan2.multimediagdansk.pl/departures?stopId=2048",
  );
});

test("uses current departures ids for Biblioteka while preserving its public ids", () => {
  const snapshotGroup = snapshot.groups.find(
    (group) => group.label === "Biblioteka Główna UG" && group.note === "Gdańsk",
  );

  assert.ok(snapshotGroup);
  const [runtimeGroup] = parseStopCatalog({ groups: [snapshotGroup] });
  assert.deepEqual(
    runtimeGroup.stops.map(({ id, departuresStopId, endpoint }) => ({
      id,
      departuresStopId,
      endpoint,
    })),
    [
      {
        id: "1678",
        departuresStopId: "14551",
        endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=14551",
      },
      {
        id: "1679",
        departuresStopId: "14550",
        endpoint: "https://ckan2.multimediagdansk.pl/departures?stopId=14550",
      },
    ],
  );
});

test("gives every catalog pole a numeric departures API id", () => {
  const stops = snapshot.groups.flatMap((group) => group.stops);

  assert.ok(stops.length > 0);
  assert.equal(
    stops.filter((stop) => !/^\d+$/.test(stop.departuresStopId)).length,
    0,
  );
});
