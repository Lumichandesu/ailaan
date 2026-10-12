import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVoice, speechLang } from "../lib/alerts.js";

test("speechLang falls back to Urdu for Pashto and English otherwise", () => {
  assert.equal(speechLang("ps"), "ur-PK");
  assert.equal(speechLang("en"), "en-US");
  assert.equal(speechLang("roman"), "en-US");
});

test("pickVoice prefers an exact locale match", () => {
  const voices = [
    { name: "A", lang: "en-GB" },
    { name: "B", lang: "en-US" },
  ];
  assert.equal(pickVoice(voices, "en-US").name, "B");
});

test("pickVoice accepts underscore locales and same-language fallback", () => {
  const voices = [{ name: "A", lang: "en_GB" }];
  assert.equal(pickVoice(voices, "en-US").name, "A");
});

test("pickVoice returns null when nothing matches", () => {
  const voices = [{ name: "A", lang: "fr-FR" }];
  assert.equal(pickVoice(voices, "ur-PK"), null);
  assert.equal(pickVoice([], "ur-PK"), null);
  assert.equal(pickVoice(undefined, "ur-PK"), null);
});

test("pickVoice matches the Urdu voice used for Pashto", () => {
  const voices = [
    { name: "Hindi", lang: "hi-IN" },
    { name: "Urdu", lang: "ur-PK" },
  ];
  assert.equal(pickVoice(voices, "ur-PK").name, "Urdu");
});
