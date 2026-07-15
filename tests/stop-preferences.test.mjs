import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeDefaultAndCatalogGroups,
  normalizeSearchText,
  parseGroupSelection,
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
