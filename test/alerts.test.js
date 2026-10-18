import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_DISTRICTS,
  RISK_META,
  buildAlert,
  dataTier,
  districtName,
  readingLine,
  riskFromStatus,
  trendLabel,
} from "../lib/alerts.js";
import { DISTRICT_KEYS, DISTRICTS } from "../lib/districts.js";

test("every demo district is a real district, and vice versa", () => {
  assert.deepEqual([...DEMO_DISTRICTS].sort(), [...DISTRICT_KEYS].sort());
});

test("districtName reads from the canonical geo config", () => {
  assert.equal(districtName("nowshera"), DISTRICTS.nowshera.name);
  assert.equal(districtName("mardan"), "Mardan");
});

test("riskFromStatus accepts only known risk keys", () => {
  assert.equal(riskFromStatus({ risk: "high" }), "high");
  assert.equal(riskFromStatus({ risk: "low" }), "low");
  assert.equal(riskFromStatus({ risk: "SEVERE" }), null);
  assert.equal(riskFromStatus({}), null);
  assert.equal(riskFromStatus(null), null);
});

test("dataTier treats anything not explicitly live as simulated", () => {
  assert.equal(dataTier({ source: "google-flood-forecasting" }), "live");
  assert.equal(dataTier({ source: "simulated" }), "simulated");
  assert.equal(dataTier({ source: "something-else" }), "simulated");
  assert.equal(dataTier({}), "simulated");
  assert.equal(dataTier(null), "simulated");
});

test("trendLabel names known trends and passes through unknown ones", () => {
  assert.equal(trendLabel("RISING"), "Rising");
  assert.equal(trendLabel("FALLING"), "Falling");
  assert.equal(trendLabel("WIBBLE"), "WIBBLE");
  assert.equal(trendLabel(null), null);
});

test("buildAlert picks the wording for the supplied risk level", () => {
  const high = buildAlert("nowshera", "high");
  assert.match(high.en, /^Urgent/);
  assert.match(high.ps, /Nowshera/);

  const medium = buildAlert("charsadda", "medium");
  assert.match(medium.en, /^Watch/);

  const low = buildAlert("swat", "low");
  assert.match(low.en, /^Calm/);
});

test("buildAlert never derives a risk level on its own", () => {
  // The previous implementation read `risk` off a hardcoded array. With no risk
  // supplied the wording must be the calm one, not a fabricated warning.
  assert.match(buildAlert("nowshera", null).en, /^Calm/);
  assert.match(buildAlert("nowshera", "unknown").en, /^Calm/);
});

test("buildAlert returns null for a district it has no copy for", () => {
  assert.equal(buildAlert("atlantis", "high"), null);
});

test("all Roman-Pashto alert text uses ASCII characters only", () => {
  for (const district of DEMO_DISTRICTS) {
    for (const risk of ["high", "medium", "low"]) {
      for (const sample of [false, true]) {
        assert.match(
          buildAlert(district, risk, sample).roman,
          /^[\x00-\x7F]*$/,
          `${district} ${risk} ${sample ? "sample" : "live"} alert should be ASCII`,
        );
      }
    }
  }
});

test("sample alerts are prefixed with the spoken caveat in every language", () => {
  for (const lang of ["en", "roman", "ps"]) {
    const sample = buildAlert("nowshera", "high", true);
    const live = buildAlert("nowshera", "high", false);
    assert.ok(
      sample[lang].startsWith(live[lang]) === false,
      "sample text should be prefixed",
    );
    assert.ok(sample[lang].length > live[lang].length);
  }
  assert.match(buildAlert("nowshera", "high", true).en, /not a live warning/i);
});

test("readingLine shows the trend for live data, never a discharge number", () => {
  const content = { river: "Kabul River" };
  assert.equal(
    readingLine(content, { forecastTrend: "RISING", discharge: 452000 }, "live"),
    "Kabul River · Rising",
  );
  // A live body that happens to carry a discharge figure must still not show it.
  assert.doesNotMatch(
    readingLine(content, { forecastTrend: "RISING", discharge: 452000 }, "live"),
    /cusecs/,
  );
});

test("readingLine shows illustrative cusecs for simulated data", () => {
  const content = { river: "Kalpani River" };
  assert.equal(
    readingLine(content, { discharge: 151000 }, "simulated"),
    "Kalpani River · 151,000 cusecs",
  );
});

test("readingLine degrades to just the river when detail is missing", () => {
  assert.equal(readingLine({ river: "Swat River" }, {}, "simulated"), "Swat River");
  assert.equal(readingLine({ river: "Swat River" }, { discharge: 0 }, "simulated"),
    "Swat River · 0 cusecs");
  assert.equal(readingLine(undefined, {}, "live"), "");
});

test("each risk level maps to a distinct, presentable colour", () => {
  const colours = Object.values(RISK_META).map((m) => m.color);
  assert.equal(new Set(colours).size, colours.length);
  for (const meta of Object.values(RISK_META)) {
    assert.match(meta.color, /^#[0-9a-f]{6}$/i);
    assert.ok(meta.label.length > 0);
  }
});
