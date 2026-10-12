import { test } from "node:test";
import assert from "node:assert/strict";
import { handleFloodStatusRequest } from "../lib/floodStatusHandler.js";
import { RATE_LIMIT } from "../lib/rateLimit.js";

const allow = { allowed: true, remaining: 10, reset: Date.now() + 60000 };

function request(body, { malformed = false } = {}) {
  return {
    headers: new Headers({ "x-forwarded-for": "203.0.113.5" }),
    async json() {
      if (malformed) throw new SyntaxError("Unexpected token");
      return body;
    },
  };
}

test("rejects a malformed JSON body with 400", async () => {
  const res = await handleFloodStatusRequest({
    req: request(null, { malformed: true }),
    fetchStatus: async () => {
      throw new Error("should not be called");
    },
    limit: allow,
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "Malformed JSON body");
});

test("rejects an unknown district with 400 and lists the valid keys", async () => {
  const res = await handleFloodStatusRequest({
    req: request({ district: "atlantis" }),
    fetchStatus: async () => {
      throw new Error("should not be called");
    },
    limit: allow,
  });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.match(error, /Unknown or missing district/);
  assert.match(error, /nowshera/);
});

test("returns 429 with Retry-After when the rate limit is exceeded", async () => {
  const now = Date.now();
  const res = await handleFloodStatusRequest({
    req: request({ district: "nowshera" }),
    fetchStatus: async () => {
      throw new Error("should not be called");
    },
    now,
    limit: { allowed: false, remaining: 0, reset: now + 5000 },
  });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "5");
});

test("returns the status body with 200 on the happy path", async () => {
  const body = { district: "swat", risk: "low", source: "google-flood-forecasting" };
  const res = await handleFloodStatusRequest({
    req: request({ district: "swat" }),
    fetchStatus: async (district) => ({ district, ...body }),
    limit: allow,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), body);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("falls back to labeled simulated data when the upstream throws", async () => {
  const res = await handleFloodStatusRequest({
    req: request({ district: "mardan" }),
    fetchStatus: async () => {
      throw new Error("upstream down");
    },
    limit: allow,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, "simulated");
  assert.equal(body.simulated, true);
  assert.equal(body.district, "mardan");
});

test("limits per client IP using the header-derived key", async () => {
  const ip = `198.51.100.${Math.floor(Math.random() * 250)}`;
  const req = {
    headers: new Headers({ "x-forwarded-for": ip }),
    json: async () => ({ district: "peshawar" }),
  };
  const fetchStatus = async (district) => ({ district, source: "simulated" });

  // Exhaust this IP's budget through the real in-memory limiter.
  for (let i = 0; i < RATE_LIMIT.maxRequests; i += 1) {
    const res = await handleFloodStatusRequest({ req, fetchStatus });
    assert.equal(res.status, 200);
  }

  const blocked = await handleFloodStatusRequest({ req, fetchStatus });
  assert.equal(blocked.status, 429);

  // A different IP still has its own budget.
  const other = await handleFloodStatusRequest({
    req: { headers: new Headers({ "x-forwarded-for": "203.0.113.99" }), json: req.json },
    fetchStatus,
  });
  assert.equal(other.status, 200);
});
