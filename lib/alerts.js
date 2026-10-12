// Client-safe presentation data and pure helpers for the Hero demo.
//
// This module deliberately has no React, DOM or fetch dependency so the alert
// wording and the live/simulated decision can be unit-tested directly (#5).
// It also holds no risk or discharge values: those must come from the API
// response, so the UI can never invent a warning.

import { DISTRICTS as DISTRICT_GEO } from "./districts.js";

// Per-district copy used to compose warnings. `name` is read from the canonical
// geo config so the two definitions cannot drift apart.
export const DISTRICT_CONTENT = {
  nowshera: {
    river: "Kabul River",
    landmark: "the GT Road bypass",
    window: "by Maghrib, around 6pm",
  },
  charsadda: {
    river: "Kabul River",
    landmark: "the Peshawar road ridge",
    window: "within 6 to 12 hours",
  },
  peshawar: {
    river: "Bara River",
    landmark: "the Ring Road overpass",
    window: "within 6 to 12 hours",
  },
  swat: {
    river: "Swat River",
    landmark: "the Mingora ridge road",
    window: "no rise expected yet",
  },
  mardan: {
    river: "Kalpani River",
    landmark: "the Swabi road",
    window: "no rise expected yet",
  },
};

export const DEMO_DISTRICTS = Object.keys(DISTRICT_CONTENT);

export function districtName(key) {
  return DISTRICT_GEO[key]?.name || key;
}

export const RISK_META = {
  high: { color: "#ef4a3d", label: "High risk" },
  medium: { color: "#f2a93b", label: "Medium risk" },
  low: { color: "#35d399", label: "Low risk" },
};

// Shown before any reading exists. Muted and non-alarming on purpose: an
// unloaded district must not borrow a risk colour.
export const NEUTRAL_RISK = { color: "#5b6b7f", label: "Not checked yet" };

export const LANGUAGES = [
  { key: "en", label: "EN" },
  { key: "roman", label: "Roman" },
  { key: "ps", label: "پښتو", dir: "rtl" },
];

// Speech-synthesis locale per UI language. Pashto TTS voices are rare, so `ps`
// falls back to Urdu (`ur-PK`), which shares the Perso-Arabic script and
// pronunciation for most flood vocabulary. Roman Pashto is Latin script, so the
// English voice reads it acceptably.
export function speechLang(langKey) {
  return langKey === "ps" ? "ur-PK" : "en-US";
}

/**
 * Choose the best available voice for `target`. Prefers an exact locale match
 * (e.g. "en-US"), then a same-language match (e.g. "en-GB" for "en-US"), and
 * returns null when nothing matches so the browser default is used.
 */
export function pickVoice(voices, target) {
  if (!Array.isArray(voices) || !target) return null;
  const norm = (value) => (value || "").toLowerCase().replaceAll("_", "-");
  const wanted = norm(target);
  const exact = voices.find((voice) => norm(voice.lang) === wanted);
  if (exact) return exact;
  const base = wanted.split("-")[0];
  return (
    voices.find((voice) => norm(voice.lang).split("-")[0] === base) || null
  );
}

// Spoken and shown whenever data is illustrative. A non-literate user hears
// only this audio, so the caveat has to be part of the warning itself.
export const SIMULATED_NOTICE = {
  en: "Sample demo — not a live warning.",
  roman: "Sample demo — da asli khabardari na da.",
  ps: "بېلګه — دا ریښتینې خبرداری نه دی.",
};

const TREND_LABELS = {
  RISING: "Rising",
  STEADY: "Steady",
  FALLING: "Falling",
};

export function trendLabel(trend) {
  if (!trend) return null;
  return TREND_LABELS[trend] || trend;
}

/**
 * The single line under the district name. Live readings show the forecast
 * trend (Google exposes no discharge figure); simulated readings keep their
 * illustrative cusecs, which the sample pill above flags as not live.
 */
export function readingLine(content, statusBody, tier) {
  const river = content?.river;
  let detail = null;
  if (tier === "live") {
    detail = trendLabel(statusBody?.forecastTrend);
  } else if (statusBody?.discharge != null) {
    detail = `${statusBody.discharge.toLocaleString()} cusecs`;
  }
  return [river, detail].filter(Boolean).join(" · ");
}

/** Valid risk key from a status body, or null when absent/unrecognised. */
export function riskFromStatus(status) {
  const risk = status?.risk;
  return Object.hasOwn(RISK_META, risk) ? risk : null;
}

/**
 * Whether a response is live or illustrative. Anything unrecognised is treated
 * as simulated: an unknown source must never be presented as a live warning.
 */
export function dataTier(status) {
  return status?.source === "google-flood-forecasting" ? "live" : "simulated";
}

export function buildAlert(districtKey, riskKey, sample = false) {
  const content = DISTRICT_CONTENT[districtKey];
  if (!content) return null;

  const d = {
    name: districtName(districtKey),
    river: content.river,
    landmark: content.landmark,
    window: content.window,
  };

  let base;
  if (riskKey === "high") {
    base = {
      en: `Urgent — ${d.name}: the ${d.river} is rising fast. Water will reach knee to waist depth ${d.window}. Move your family and animals to ${d.landmark} now.`,
      roman: `${d.name} ta khatarnak khabardari: ${d.river} dera ghrandai loredzi. Obah ${d.window} kamar-jag lware wi. Khpal koranai aw tsarwi ${d.landmark} ta osa olegday.`,
      ps: `${d.name} ته خطرناک خبرداری: ${d.river} ډېره ګړندۍ لوړېږي. اوبه به ${d.window} د زنګون تر کمر پورې لوړې وي. خپل کورنۍ او څاروي اوس مهال ${d.landmark} ته ولیږدئ.`,
    };
  } else if (riskKey === "medium") {
    base = {
      en: `Watch — ${d.name}: the ${d.river} is rising. Low-lying streets may flood ${d.window}. Keep essentials packed and stay near ${d.landmark}.`,
      roman: `${d.name} lapara khabardari: ${d.river} lwaregi. Teto sarakuna ${d.window} tar obo lande kedai shi. Zaroori shai chmatawali wasata.`,
      ps: `${d.name} لپاره خبرداری: ${d.river} لوړېږي. ټیټې سړکونه ${d.window} تر اوبو لاندې کېدای شي. اړین توکي چمتو وساتئ.`,
    };
  } else {
    base = {
      en: `Calm — ${d.name}: the ${d.river} is steady today. Risk is low, no action needed. We are still watching for you.`,
      roman: `${d.name} nan aaram day: ${d.river} sam dy. Khatar kam dy, os hits kar pakar na dy. Mung ba mudam gorо.`,
      ps: `${d.name} نن آرام دی: ${d.river} ثابت دی. خطر کم دی، اوس هېڅ کار پکار نه دی. موږ به مو تعقیب کوو.`,
    };
  }

  if (!sample) return base;
  return {
    en: `${SIMULATED_NOTICE.en} ${base.en}`,
    roman: `${SIMULATED_NOTICE.roman} ${base.roman}`,
    ps: `${SIMULATED_NOTICE.ps} ${base.ps}`,
  };
}
