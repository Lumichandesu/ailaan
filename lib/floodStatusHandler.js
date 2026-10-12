import { isValidDistrict, DISTRICT_KEYS } from "./districts.js";
import { simulatedStatus } from "./floodStatus.js";
import { checkRateLimit, clientKeyFromHeaders } from "./rateLimit.js";

const SECONDS = 1000;

function json(body, status, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

/**
 * Request handling for `POST /api/flood-status`, with no Next.js or cache
 * dependencies so it can be unit-tested directly.
 *
 * `req` is a request-like object exposing `headers` and `json()`.
 * `fetchStatus(districtKey)` resolves the status body and may throw when the
 * upstream is unavailable. `rateLimitKey` defaults to the client IP derived from
 * the request headers.
 */
export async function handleFloodStatusRequest({
  req,
  fetchStatus,
  rateLimitKey,
  now = Date.now(),
  limit,
} = {}) {
  const key = rateLimitKey ?? clientKeyFromHeaders(req?.headers ?? new Headers());
  const rate = limit ?? (await checkRateLimit(key, { now }));

  if (!rate.allowed) {
    return json({ error: "Too many requests. Please try again shortly." }, 429, {
      "Retry-After": String(Math.max(1, Math.ceil((rate.reset - now) / SECONDS))),
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Malformed JSON body" }, 400);
  }

  const district = body?.district;
  if (!isValidDistrict(district)) {
    return json(
      { error: `Unknown or missing district. Expected one of: ${DISTRICT_KEYS.join(", ")}` },
      400,
    );
  }

  try {
    return json(await fetchStatus(district), 200);
  } catch {
    // Upstream unavailable / no data — degrade to clearly-labeled simulated data.
    return json(simulatedStatus(district), 200);
  }
}
