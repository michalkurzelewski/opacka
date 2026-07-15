import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeDefaultAndCatalogGroups,
  moveStop,
  normalizeSearchText,
  orderStops,
  parseGroupSelection,
  parseStopSettings,
} from "../stop-preferences.mjs";

const availableIds = new Set(["opacka", "plowce", "ztm-a", "ztm-b"]);
const defaults = ["opacka", "plowce"];

test("uses the default groups when no preference has been saved", () => {
  assert.deepEqual(parseGroupSelection(null, availableIds, defaults), defaults);
});

test("preserves an intentionally empty group selection", () => {
  assert.deepEqual(parseGroupSelection("[]", availableIds, defaults), []);
});

test("keeps known groups in saved order and drops stale identifiers", () => {
  assert.deepEqual(
    parseGroupSelection('["ztm-b","missing","opacka","ztm-b"]', availableIds, defaults),
    ["ztm-b", "opacka"],
  );
});

test("falls back to defaults for malformed preferences", () => {
  assert.deepEqual(parseGroupSelection("not-json", availableIds, defaults), defaults);
  assert.deepEqual(parseGroupSelection("{}", availableIds, defaults), defaults);
});

test("normalizes Polish diacritics and case for searching", () => {
  assert.equal(normalizeSearchText("  PŁOWCE, Gdańsk  "), "plowce, gdansk");
});

test("merges extra catalog poles into a matching default group", () => {
  const defaults = [
    { id: "opacka", label: "Opacka", stops: [{ id: "2047", heading: "Własny opis" }] },
  ];
  const catalog = [
    {
      id: "ztm-opacka",
      label: "Opacka",
      stops: [{ id: "2047", heading: "Ogólny opis" }, { id: "1665" }],
    },
    { id: "ztm-oliwa", label: "Oliwa", stops: [{ id: "2045" }] },
  ];

  assert.deepEqual(mergeDefaultAndCatalogGroups(defaults, catalog), [
    {
      id: "opacka",
      label: "Opacka",
      stops: [{ id: "2047", heading: "Własny opis" }, { id: "1665" }],
    },
    { id: "ztm-oliwa", label: "Oliwa", stops: [{ id: "2045" }] },
  ]);
});

test("parses saved aliases, collapsed poles, and group order", () => {
  assert.deepEqual(
    parseStopSettings(
      JSON.stringify({
        aliases: { "opacka:2048": "Do pracy", invalid: 42 },
        collapsed: ["opacka:2047", 12, "opacka:2047"],
        order: { opacka: ["2047", "2048", 12], invalid: "not-an-array" },
      }),
    ),
    {
      aliases: { "opacka:2048": "Do pracy" },
      collapsed: ["opacka:2047"],
      order: { opacka: ["2047", "2048"] },
    },
  );
});

test("uses empty stop settings for malformed data", () => {
  assert.deepEqual(parseStopSettings(null), { aliases: {}, collapsed: [], order: {} });
  assert.deepEqual(parseStopSettings("not-json"), { aliases: {}, collapsed: [], order: {} });
});

test("orders known poles first and appends new catalog poles", () => {
  const stops = [{ id: "1" }, { id: "2" }, { id: "3" }];
  assert.deepEqual(orderStops(stops, ["3", "missing", "1"]).map((stop) => stop.id), [
    "3",
    "1",
    "2",
  ]);
});

test("moves a pole without crossing group boundaries", () => {
  const stops = [{ id: "1" }, { id: "2" }, { id: "3" }];
  assert.deepEqual(moveStop(stops, "2", "earlier"), ["2", "1", "3"]);
  assert.deepEqual(moveStop(stops, "2", "later"), ["1", "3", "2"]);
  assert.deepEqual(moveStop(stops, "1", "earlier"), ["1", "2", "3"]);
  assert.deepEqual(moveStop(stops, "3", "later"), ["1", "2", "3"]);
  assert.deepEqual(moveStop(stops, "2", "unsupported"), ["1", "2", "3"]);
});
