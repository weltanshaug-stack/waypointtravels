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
  /** Openverse-hosted proxy copy — loads even when the origin blocks hotlinking. */
  thumbnail?: string | undefined;
  title: string;
  width?: number | undefined;
  height?: number | undefined;
  tags?: string | undefined;
};

/** Ordered URLs for one photo: full-size first, reliable proxy copy as backup. */
function urlsOf(c: Candidate): string[] {
  return [c.url, c.thumbnail].filter((u): u is string => Boolean(u));
}


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


/** One Openverse request, retried once with a longer timeout on failure. */
async function searchOpenverse(query: string, attempt = 0): Promise<Candidate[]> {
  const url = `${OPENVERSE}?${new URLSearchParams({
    q: query,
    page_size: "16",
    mature: "false",
    license_type: "all",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(attempt === 0 ? 6000 : 9000),
    });
    if (!res.ok) return attempt === 0 ? searchOpenverse(query, 1) : [];

    const json = (await res.json()) as {
      results?: {
        title?: string;
        url?: string;
        thumbnail?: string;
        width?: number;
        height?: number;
        tags?: { name?: string }[];
      }[];
    };
    return (json.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        url: r.url!,
        thumbnail: r.thumbnail,
        title: r.title ?? "",
        width: r.width,
        height: r.height,
        tags: (r.tags ?? []).map((t) => t.name ?? "").join(" "),
      }));

  } catch {
    // Timed-out or dropped request: one retry so a slow response doesn't
    // silently cost this event its photo.
    return attempt === 0 ? searchOpenverse(query, 1) : [];
  }

}

/** One Wikipedia request — used only for the shared destination fallback set. */
async function searchWikipedia(query: string): Promise<Candidate[]> {
  const url = `${WIKIPEDIA}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "20",
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

/** Broad experience categories used for relevant backup photos. */
const CATEGORIES = [
  "museum",
  "art gallery",
  "temple",
  "shrine",
  "church",
  "cathedral",
  "mosque",
  "castle",
  "palace",
  "park",
  "garden",
  "beach",
  "market",
  "food market",
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "winery",
  "hike",
  "trail",
  "mountain",
  "waterfall",
  "lake",
  "river",
  "boat",
  "cruise",
  "kayak",
  "bike",
  "walking tour",
  "viewpoint",
  "old town",
  "square",
  "bridge",
  "zoo",
  "aquarium",
  "spa",
  "hot spring",
  "shopping street",
  "hotel",
  "train",
  "cooking class",
  "concert",
  "theatre",
  "lighthouse",
  "harbour",
  "island",
  "desert",
  "vineyard",
  "street food",
];

/** Best-matching experience category for a query, if any. */
function categoryOf(query: string): string | undefined {
  const hay = query.toLowerCase();
  const hits = CATEGORIES.filter((cat) => hay.includes(cat));
  if (hits.length) return hits.sort((a, b) => b.length - a.length)[0];
  const words = tokens(query);
  if (words.some((w) => ["hiking", "trek", "trekking"].includes(w))) return "hike";
  if (words.some((w) => ["dinner", "lunch", "brunch", "breakfast", "tasting"].includes(w)))
    return "restaurant";
  if (words.some((w) => ["stay", "check", "checkin", "accommodation"].includes(w))) return "hotel";
  return undefined;
}


/** Runs tasks in small concurrent batches so the free API isn't hammered. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  }
  return out;
}

type Entry = {
  query: string;
  words: string[];
  /** Relevant, ranked candidates for this event (best first). */
  options: Candidate[];
  /** Confidence of the best option — drives global assignment order. */
  score: number;
};

/**
 * Returns up to 4 ordered candidate URLs per query (best first) so the client can
 * fall through locally when one URL fails to load.
 *
 * Photos are assigned globally by confidence, not in itinerary order, so later
 * days keep their strong matches instead of losing them to earlier days.
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

  const cityWords = tokens(destination);

  const [results, wikiPhotos, cityPhotos] = await Promise.all([
    inBatches(unique, 10, (q) => searchOpenverse(q)),
    destination ? searchWikipedia(`${destination} landmark`) : Promise.resolve([]),
    destination ? searchOpenverse(`${destination} city`) : Promise.resolve([]),
  ]);

  // Deep, deduped pool of destination photos for the very last resort.
  const seenDest = new Set<string>();
  const destPool = [...wikiPhotos, ...cityPhotos]
    .filter((c) => !isDisqualified(c))
    .filter((c) => {
      const id = identityOf(c.url);
      if (seenDest.has(id)) return false;
      seenDest.add(id);
      return true;
    })
    .sort((a, b) => rank(b, cityWords) - rank(a, cityWords));

  const usedIdentities = new Set<string>();
  const map: Record<string, string[]> = {};
  let destCursor = 0;

  /** On-topic candidates for one query, best first. */
  const relevantOf = (pool: Candidate[], words: string[]): Candidate[] =>
    pool
      .filter((c) => !isDisqualified(c) && matchesSubject(c, words, cityWords))
      .sort((a, b) => rank(b, words, cityWords) - rank(a, words, cityWords));

  const scoreOf = (options: Candidate[], words: string[]): number =>
    options.length ? rank(options[0]!, words, cityWords) : -1;

  const entries: Entry[] = unique.map((query, i) => {
    const words = tokens(query);
    const options = relevantOf(results[i] ?? [], words);
    return { query, words, options, score: scoreOf(options, words) };
  });

  // Second chance for EVERY event with no on-topic match: search the activity
  // words alone (city dropped), which often finds a true photo of the experience.
  const needRescue = entries.filter((e) => !e.options.length);
  const rescueResults = await inBatches(needRescue, 8, (e) => {
    const subject = e.words.filter((w) => !cityWords.includes(w));
    return subject.length ? searchOpenverse(subject.join(" ")) : Promise.resolve([]);
  });
  needRescue.forEach((e, i) => {
    e.options = relevantOf(rescueResults[i] ?? [], e.words);
    e.score = scoreOf(e.options, e.words);
  });

  const commit = (query: string, chosen: Candidate[]) => {
    usedIdentities.add(identityOf(chosen[0]!.url));
    map[query] = chosen
      .flatMap(urlsOf)
      .filter((u, idx, arr) => arr.indexOf(u) === idx)
      .slice(0, 4);
  };

  // Global assignment: most confident matches claim their photo first, so an
  // event on day 6 with an exact match isn't outbid by a weak day-1 match.
  const byConfidence = [...entries].sort((a, b) => b.score - a.score);
  byConfidence.forEach((e) => {
    if (!e.options.length) return;
    const fresh = e.options.filter((c) => !usedIdentities.has(identityOf(c.url)));
    // A relevant repeat beats a generic photo, so reuse only when nothing is free.
    commit(e.query, (fresh.length ? fresh : e.options).slice(0, 3));
  });

  const stillUnresolved = entries.filter((e) => !map[e.query]).map((e) => e.query);

  // Third chance: one shared search per activity CATEGORY (museum, market, hike…),
  // so the backup photo still depicts the kind of experience, not a random city shot.
  const categorySet = new Set<string>();
  stillUnresolved.forEach((q) => {
    const cat = categoryOf(q);
    if (cat) categorySet.add(cat);
  });

  const categories = Array.from(categorySet).slice(0, 8);
  const categoryResults = await inBatches(categories, 8, (cat) =>
    searchOpenverse(destination ? `${cat} ${destination}` : cat),
  );

  const categoryPools = new Map<string, Candidate[]>();
  categories.forEach((cat, i) => {
    const words = [cat, ...cityWords];
    const pool = (categoryResults[i] ?? [])
      .filter((c) => !isDisqualified(c))
      .sort((a, b) => rank(b, words, cityWords) - rank(a, words, cityWords));
    categoryPools.set(cat, pool);
  });

  /** Claims the first not-yet-used photo from a pool, so no two events share it. */
  const claimUnique = (pool: Candidate[]): Candidate | undefined => {
    const free = pool.find((c) => !usedIdentities.has(identityOf(c.url)));
    if (!free) return undefined;
    usedIdentities.add(identityOf(free.url));
    return free;
  };

  const leftover: string[] = [];
  stillUnresolved.forEach((q) => {
    const cat = categoryOf(q);
    const pool = cat ? categoryPools.get(cat) : undefined;
    const claimed = pool ? claimUnique(pool) : undefined;
    if (claimed) {
      map[q] = urlsOf(claimed).slice(0, 4);
      return;
    }
    leftover.push(q);
  });

  // Last resort: a distinct destination photo per remaining event — never the
  // same backup twice while any unused photo is left.
  leftover.forEach((q) => {
    const claimed = claimUnique(destPool);
    if (claimed) {
      map[q] = urlsOf(claimed).slice(0, 4);
      return;
    }
    // Pool exhausted: rotate so at least the repeats are spread out.
    if (destPool.length) {
      const c = destPool[destCursor % destPool.length]!;
      destCursor += 1;
      map[q] = urlsOf(c).slice(0, 4);
    }
  });

  return map;
}


