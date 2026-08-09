/**
 * Lightweight itinerary image lookup.
 *
 * Design goals (deliberately simple + cheap):
 *   - ONE image-search request per unique itinerary query (Openverse, free,
 *     openly licensed photo search). No per-event fallback ladders.
 *   - ONE extra request in total for a shared destination photo set, used only
 *     when an event's own search came back empty.
 *   - Filter out anything that clearly isn't a photo of a place (maps, logos,
 *     screenshots, selfies, posters, ...), then rank by simple relevance.
 *   - Return a few ordered URLs per query so the client can fall through
 *     without hitting the network again.
 *
 * No AI-generated image URLs are trusted anywhere: every URL comes from a real
 * search result, and the client still validates that it actually loads.
 */

const OPENVERSE = "https://api.openverse.org/v1/images/";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";
const UA = "Waypoint/1.0 (travel planning app)";

/** Words that mean the asset is not a usable photo of the experience. */
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
  "diagram",
  "floor plan",
  "floorplan",
  "blueprint",
  "chart",
  "graph",
  "infographic",
  "icon",
  "banner",
  "wordmark",
  "signature",
  "poster",
  "stamp",
  "sticker",
  "ticket",
  "brochure",
  "advertisement",
  "advert",
  "screenshot",
  "screen shot",
  "collage",
  "montage",
  "watermark",
  "selfie",
  "self-portrait",
  "self portrait",
  "portrait of",
  "headshot",
  "posing",
  "posed",
  "instagram",
  "tiktok",
  "influencer",
  "photoshoot",
  "blurry",
  "pixelated",
  "low resolution",
  "thumbnail",
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
  "photograph",
  "picture",
  "view",
  "visit",
  "explore",
  "near",
]);

type Candidate = {
  url: string;
  title: string;
  width?: number | undefined;
  height?: number | undefined;
  tags?: string | undefined;
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function haystackOf(c: Candidate): string {
  let decoded = c.url;
  try {
    decoded = decodeURIComponent(c.url);
  } catch {
    /* keep raw url */
  }
  return `${c.title} ${c.tags ?? ""} ${decoded}`.toLowerCase();
}

/** De-duplication identity: crops/resizes of the same photo collapse to one key. */
function identityOf(url: string): string {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  const file = decoded.split("?")[0]!.split("/").pop() ?? decoded;
  return file
    .toLowerCase()
    .replace(/^\d+px-/, "")
    .replace(/\.(jpe?g|png|webp|avif)$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Hard rejections: not a photo, wrong format, or too small to look good. */
function isDisqualified(c: Candidate): boolean {
  const url = c.url.toLowerCase();
  if (!/^https?:\/\//.test(url)) return true;
  if (/\.(svg|gif|tif|tiff)(\?|$)/.test(url)) return true;
  if (REJECT.some((bad) => haystackOf(c).includes(bad))) return true;
  if (c.width && c.width < 640) return true;
  if (c.width && c.height && c.height / c.width > 1.6) return true; // extreme portrait
  return false;
}

/**
 * Relevance rank. Subject words (the activity/venue itself) matter far more than
 * the city name, so a generic city photo can never outrank an actual match.
 */
function rank(c: Candidate, words: string[], cityWords: string[] = []): number {
  const hay = haystackOf(c);
  const subject = words.filter((w) => !cityWords.includes(w));
  const subjectHits = subject.filter((w) => hay.includes(w)).length;
  const cityHit = cityWords.some((w) => hay.includes(w)) ? 1 : 0;
  const subjectScore = subject.length ? (subjectHits / subject.length) * 65 : 30;
  const locationScore = cityHit * 15;
  const w = c.width ?? 0;
  const h = c.height ?? 0;
  const quality = w >= 1600 ? 12 : w >= 1000 ? 8 : 4;
  const framing = w && h ? (w > h ? 8 : 3) : 5;
  return Math.round(subjectScore + locationScore + quality + framing);
}

/** True when the candidate actually depicts the subject of the query. */
function matchesSubject(c: Candidate, words: string[], cityWords: string[]): boolean {
  const subject = words.filter((w) => !cityWords.includes(w));
  if (!subject.length) return true;
  const hay = haystackOf(c);
  const hits = subject.filter((w) => hay.includes(w)).length;
  // Need a real overlap with the event itself, not just the city name.
  return hits >= Math.min(2, subject.length) || hits / subject.length >= 0.5;
}


/** One Openverse request. */
async function searchOpenverse(query: string): Promise<Candidate[]> {
  const url = `${OPENVERSE}?${new URLSearchParams({
    q: query,
    page_size: "12",
    mature: "false",
    license_type: "all",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: {
        title?: string;
        url?: string;
        width?: number;
        height?: number;
        tags?: { name?: string }[];
      }[];
    };
    return (json.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        url: r.url!,
        title: r.title ?? "",
        width: r.width,
        height: r.height,
        tags: (r.tags ?? []).map((t) => t.name ?? "").join(" "),
      }));
  } catch {
    return [];
  }
}

/** One Wikipedia request — used only for the shared destination fallback set. */
async function searchWikipedia(query: string): Promise<Candidate[]> {
  const url = `${WIKIPEDIA}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "8",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1600",
    format: "json",
    origin: "*",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; thumbnail?: { source?: string; width?: number; height?: number } }
        >;
      };
    };
    return Object.values(json.query?.pages ?? {})
      .filter((p) => p.thumbnail?.source)
      .map((p) => ({
        url: p.thumbnail!.source!,
        title: p.title ?? "",
        width: p.thumbnail?.width,
        height: p.thumbnail?.height,
      }));
  } catch {
    return [];
  }
}

/**
 * Returns up to 3 ordered candidate URLs per query (best first) so the client can
 * fall through locally when one URL fails to load.
 *
 * Request budget: 1 request per unique query + 1 shared destination request.
 */
export async function fetchImagesForQueries(
  queries: string[],
  destination = "",
): Promise<Record<string, string[]>> {
  const unique = Array.from(
    new Set(
      queries
        .map((q) => (typeof q === "string" ? q.trim().slice(0, 120) : ""))
        .filter((q) => q.length > 2),
    ),
  ).slice(0, 45);

  const [results, destinationPhotos] = await Promise.all([
    Promise.all(unique.map((q) => searchOpenverse(q))),
    destination ? searchWikipedia(`${destination} landmark`) : Promise.resolve([]),
  ]);

  const destPool = destinationPhotos
    .filter((c) => !isDisqualified(c))
    .sort((a, b) => rank(b, tokens(destination)) - rank(a, tokens(destination)));

  const usedIdentities = new Set<string>();
  const map: Record<string, string[]> = {};
  let destCursor = 0;

  unique.forEach((q, i) => {
    const words = tokens(q);
    const pool = (results[i] ?? [])
      .filter((c) => !isDisqualified(c))
      .sort((a, b) => rank(b, words) - rank(a, words));

    // Prefer photos not already used elsewhere in this itinerary.
    const fresh = pool.filter((c) => !usedIdentities.has(identityOf(c.url)));
    const chosen = (fresh.length ? fresh : pool).slice(0, 3);

    if (chosen.length) {
      usedIdentities.add(identityOf(chosen[0]!.url));
      map[q] = chosen.map((c) => c.url);
      return;
    }

    // Nothing usable for this event: reuse the shared destination photos.
    if (destPool.length) {
      const start = destCursor % destPool.length;
      destCursor += 1;
      map[q] = [destPool[start]!, ...destPool.slice(0, 2)]
        .map((c) => c.url)
        .filter((u, idx, arr) => arr.indexOf(u) === idx)
        .slice(0, 3);
    }
  });

  return map;
}
