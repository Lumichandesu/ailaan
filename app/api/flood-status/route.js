import { unstable_cache } from "next/cache";
import { fetchLiveFloodStatus, simulatedStatus } from "@/lib/floodStatus";
import { handleFloodStatusRequest } from "@/lib/floodStatusHandler";

const CACHE_SECONDS = Number(process.env.FLOOD_CACHE_SECONDS || 300);
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 10000);

// Only successful live results are cached. If Google has no data we throw so the
// (simulated) fallback is generated per request and recovery is immediate
// instead of being frozen into the cache for the whole revalidate window.
const cachedLiveStatus = unstable_cache(
  async (district) => {
    const normalized = await fetchLiveFloodStatus(district, {
      apiKey: process.env.GOOGLE_FLOOD_API_KEY,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!normalized) throw new Error("No live flood status for area");
    return { district, ...normalized };
  },
  ["flood-status-live"],
  { revalidate: CACHE_SECONDS, tags: ["flood-status"] },
);

async function resolveStatus(district) {
  if (!process.env.GOOGLE_FLOOD_API_KEY) return simulatedStatus(district);
  try {
    return await cachedLiveStatus(district);
  } catch {
    // Upstream unavailable / no data — degrade to clearly-labeled simulated data.
    return simulatedStatus(district);
  }
}

export async function POST(req) {
  return handleFloodStatusRequest({ req, fetchStatus: resolveStatus });
}
