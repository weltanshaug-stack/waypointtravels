/**
 * Free, key-less photography for itinerary stops.
 *
 * Primary source: Openverse (openly-licensed photo search) — it indexes real
 * photographs of specific venues, buildings and streets.
 * Fallback: the Wikipedia article thumbnail for the place.
 *
 * Maps, logos, flags, crests, diagrams and other non-photographic assets are
 * rejected so every stop shows the actual place.
 */

const OPENVERSE = "https://api.openverse.org/v1/images/";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";
const UA = "Waypoint/1.0 (travel planning app)";

/** Words that mean the asset is not a photo of the physical place. */
const REJECT = [
  "map",
  "locator",
  "logo",
  "flag",
  "coat of arms",
  "coat_of_arms",
  "crest",
  "seal of",
  "emblem",
  "wappen",
  "diagram",
  "floor plan",
  "floorplan",
  "blueprint",
  "chart",
  "icon",
  "banner",
  "wordmark",
  "signature",
  "screenshot",
];

function looksLikePhoto(text: string, url: string): boolean {
  const haystack = `${text} ${decodeURIComponent(url)}`.toLowerCase();
  if (/\.(svg|gif)(\?|$)/.test(url.toLowerCase())) return false;
  return !REJECT.some((bad) => haystack.includes(bad));
}

type OpenverseResult = { title?: string; url?: string; thumbnail?: string };

async function openverse(query: string): Promise<string | null> {
  const url = `${OPENVERSE}?${new URLSearchParams({
    q: query,
    page_size: "8",
    mature: "false",
    license_type: "all",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: OpenverseResult[] };
    const hit = (json.results ?? []).find(
      (r) => r.url && looksLikePhoto(r.title ?? "", r.url),
    );
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

type WikiPage = { title?: string; thumbnail?: { source?: string } };

async function wikipedia(query: string): Promise<string | null> {
  const url = `${WIKIPEDIA}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "4",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1000",
    format: "json",
    origin: "*",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
    const hit = Object.values(json.query?.pages ?? {}).find((p) => {
      const src = p.thumbnail?.source;
      return src && looksLikePhoto(p.title ?? "", src);
    });
    return hit?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/** Resolves one search phrase to a photograph of the place itself. */
async function lookupOne(query: string): Promise<string | null> {
  return (
    (await openverse(query)) ??
    (await openverse(`${query} building`)) ??
    (await wikipedia(query))
  );
}

export async function fetchImagesForQueries(
  queries: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(
      queries
        .map((q) => (typeof q === "string" ? q.trim().slice(0, 120) : ""))
        .filter((q) => q.length > 2),
    ),
  ).slice(0, 45);

  const results = await Promise.all(unique.map((q) => lookupOne(q)));
  const map: Record<string, string> = {};
  unique.forEach((q, i) => {
    const url = results[i];
    if (url) map[q] = url;
  });
  return map;
}
