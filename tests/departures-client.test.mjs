import assert from "node:assert/strict";
import test from "node:test";

import { fetchDepartures } from "../departures-client.mjs";

const endpoint = "https://ckan2.multimediagdansk.pl/departures?stopId=2048";
const proxyEndpoint =
  "https://corsproxy.nl/https/ckan2.multimediagdansk.pl/departures?stopId=2048";
const requestOptions = {
  cache: "no-store",
  credentials: "omit",
  referrerPolicy: "no-referrer",
};

test("uses the official API directly when it is available", async () => {
  const payload = { departures: [] };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => payload };
  };

  assert.deepEqual(await fetchDepartures(endpoint, { fetchImpl }), payload);
  assert.deepEqual(calls, [{ url: endpoint, options: requestOptions }]);
});

test("falls back to the scoped CORS proxy when the browser rejects the official API", async () => {
  const payload = {
    lastUpdate: "2026-09-02T16:11:28Z",
    departures: [{ routeShortName: "2" }],
  };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      throw new TypeError("Failed to fetch");
    }

    return {
      ok: true,
      json: async () => payload,
    };
  };

  const result = await fetchDepartures(endpoint, { fetchImpl });

  assert.deepEqual(result, payload);
  assert.deepEqual(calls, [
    { url: endpoint, options: requestOptions },
    { url: proxyEndpoint, options: requestOptions },
  ]);
});

test("does not use the proxy when the official API returns an HTTP error", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: false, status: 503 };
  };

  await assert.rejects(fetchDepartures(endpoint, { fetchImpl }), /HTTP 503/);
  assert.deepEqual(calls, [{ url: endpoint, options: requestOptions }]);
});

test("refuses to proxy an endpoint outside the official departures API", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new TypeError("Failed to fetch");
  };

  await assert.rejects(
    fetchDepartures("https://example.com/departures?stopId=2048", { fetchImpl }),
    /Nieobsługiwany endpoint/,
  );
  assert.equal(calls, 0);
});

test("temporarily skips the blocked official API after the first CORS failure", async () => {
  const secondEndpoint = "https://ckan2.multimediagdansk.pl/departures?stopId=1330";
  const secondProxyEndpoint =
    "https://corsproxy.nl/https/ckan2.multimediagdansk.pl/departures?stopId=1330";
  const payload = { departures: [] };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      throw new TypeError("Failed to fetch");
    }
    return { ok: true, json: async () => payload };
  };

  await fetchDepartures(endpoint, { fetchImpl, now: () => 1_000 });
  await fetchDepartures(secondEndpoint, { fetchImpl, now: () => 2_000 });

  assert.deepEqual(calls, [
    { url: endpoint, options: requestOptions },
    { url: proxyEndpoint, options: requestOptions },
    { url: secondProxyEndpoint, options: requestOptions },
  ]);
});

test("rejects an invalid payload without retrying through the proxy", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ message: "unexpected" }) };
  };

  await assert.rejects(fetchDepartures(endpoint, { fetchImpl }), /Nieoczekiwany format/);
  assert.deepEqual(calls, [{ url: endpoint, options: requestOptions }]);
});

test("reports a proxy HTTP failure after a browser CORS rejection", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      throw new TypeError("Failed to fetch");
    }
    return { ok: false, status: 502 };
  };

  await assert.rejects(fetchDepartures(endpoint, { fetchImpl }), /HTTP 502/);
  assert.deepEqual(calls, [
    { url: endpoint, options: requestOptions },
    { url: proxyEndpoint, options: requestOptions },
  ]);
});
