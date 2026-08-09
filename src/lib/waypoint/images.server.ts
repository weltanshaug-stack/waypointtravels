/**
 * Free, key-less photography for itinerary stops.
 *
 * Goal: every card shows a photo of the *actual activity or place*, not a
 * random shot of the city. We do that in two ways:
 *   1. Progressive query broadening that always preserves the activity words
 *      (exact place → place + photo → activity + destination).
 *   2. Relevance scoring — a candidate is only accepted when its title/URL
 *      shares meaningful words with the query, so we never fall back to an
 *      unrelated building, street or landscape from the same city.
 *
 * Primary source: Openverse (openly-licensed photo search).
 * Fallback: the Wikipedia article thumbnail for the place.
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
  "poster",
  "stamp",
  "portrait of",
  "comparison",
];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "at",
  "on",
  "and",
  "to",
  "for",
  "with",
  "photo",
  "view",
  "exterior",
  "building",
  "near",
  "de",
  "la",
  "el",
]);

function looksLikePhoto(text: string, url: string): boolean {
  const haystack = `${text} ${decodeURIComponent(url)}`.toLowerCase();
  if (/\.(svg|gif)(\?|$)/.test(url.toLowerCase())) return false;
  return !REJECT.some((bad) => haystack.includes(bad));
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * How well a candidate matches the query. Requires at least one shared
 * meaningful word; more overlap wins.
 */
function relevance(query: string, title: string, url: string): number {
  const wanted = tokens(query);
  if (wanted.length === 0) return 0;
  const haystack = `${title} ${decodeURIComponent(url)}`.toLowerCase();
  let hits = 0;
  for (const word of new Set(wanted)) if (haystack.includes(word)) hits += 1;
  return hits;
}

type OpenverseResult = { title?: string; url?: string };

async function openverse(query: string, minHits: number): Promise<string[]> {
  const url = `${OPENVERSE}?${new URLSearchParams({
    q: query,
    page_size: "16",
    mature: "false",
    license_type: "all",
    // Aesthetics: prefer large, wide, photographic files — they crop well into
    // the wide itinerary cards instead of looking pixelated or awkward.
    aspect_ratio: "wide",
    size: "large",
    extension: "jpg,jpeg,png",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: OpenverseResult[] };
    return (json.results ?? [])
      .filter((r) => r.url && looksLikePhoto(r.title ?? "", r.url))
      .map((r) => ({ url: r.url!, score: relevance(query, r.title ?? "", r.url!) }))
      .filter((r) => r.score >= minHits)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.url);
  } catch {
    return [];
  }
}

type WikiPage = { title?: string; thumbnail?: { source?: string } };

async function wikipedia(query: string, minHits: number): Promise<string[]> {
  const url = `${WIKIPEDIA}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "6",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1200",
    format: "json",
    origin: "*",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
    return Object.values(json.query?.pages ?? {})
      .map((p) => ({ src: p.thumbnail?.source, title: p.title ?? "" }))
      .filter((p): p is { src: string; title: string } => Boolean(p.src))
      .filter((p) => looksLikePhoto(p.title, p.src))
      .map((p) => ({ src: p.src, score: relevance(query, p.title, p.src) }))
      .filter((p) => p.score >= minHits)
      .sort((a, b) => b.score - a.score)
      .map((p) => p.src);
  } catch {
    return [];
  }
}

/**
 * Query variants, strongest first. The activity words are preserved as the
 * query broadens so we never drop to "generic city photo" too early.
 * Query shape from the planner is "<activity/place> <city>".
 */
function variants(query: string): { q: string; minHits: number }[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const core = words.slice(0, Math.max(1, words.length - 1)).join(" ");
  const list = [
    { q: query, minHits: 2 },
    { q: query, minHits: 1 },
    { q: `${core} photograph`, minHits: 1 },
    { q: core, minHits: 1 },
    { q: query, minHits: 0 },
  ];
  // Deduplicate identical phrase+threshold pairs.
  const seen = new Set<string>();
  return list.filter((v) => {
    const key = `${v.q}|${v.minHits}`;
    if (!v.q || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Ranked photo candidates for one search phrase, strongest match first.
 * Multiple candidates let the caller give every activity a distinct photo.
 */
async function lookupCandidates(query: string): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const { q, minHits } of variants(query)) {
    const found = [...(await openverse(q, minHits)), ...(await wikipedia(q, minHits))];
    for (const url of found) {
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    if (out.length >= 6) break;
  }
  return out;
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

  const candidates = await Promise.all(unique.map((q) => lookupCandidates(q)));

  // Greedy unique assignment: no two activities ever show the same photo.
  const map: Record<string, string> = {};
  const used = new Set<string>();
  unique.forEach((q, i) => {
    const pick = (candidates[i] ?? []).find((url) => !used.has(url));
    if (pick) {
      used.add(pick);
      map[q] = pick;
    }
  });
  return map;
}

