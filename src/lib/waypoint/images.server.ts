/**
 * Itinerary photo lookup, powered by the Pexels photo API.
 *
 * Design goals:
 *   - ONE Pexels search per unique event query (highly specific, e.g.
 *     "Lake Tahoe kayaking" rather than "Lake Tahoe"), asking for multiple
 *     landscape results so we can choose rather than take the first hit.
 *   - Filter out selfies/portraits/screenshots/collages/text-heavy assets.
 *   - Rank by how well the photo actually depicts the event, then quality.
 *   - Assign photos globally by confidence so late days keep strong matches,
 *     and never reuse the same photo inside one itinerary.
 *   - Return the chosen photo id + ordered URL candidates + attribution, so the
 *     client can fall through sizes if one fails and credit Pexels correctly.
 *
 * The API key is read inside this server-only module and never sent to the client.
 */

const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

/** Words that mean the asset is not a usable photo of the experience. */
const REJECT = [
  "selfie",
  "self portrait",
  "self-portrait",
  "posing",
  "posed",
  "headshot",
  "portrait of a",
  "close up of a woman",
  "close up of a man",
  "close-up of a woman",
  "close-up of a man",
  "influencer",
  "model wearing",
  "fashion shoot",
  "photoshoot",
  "screenshot",
  "screen shot",
  "collage",
  "montage",
  "watermark",
  "logo",
  "poster",
  "flyer",
  "brochure",
  "advertisement",
  "text on",
  "lettering",
  "typography",
  "signage",
  "map of",
  "illustration",
  "vector",
  "clip art",
  "3d render",
  "mockup",
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

/** A chosen Pexels photo, stored on the itinerary event. */
export type EventPhoto = {
  /** Pexels photo id — stored with the event so the same photo can be reused. */
  id: number;
  /** Ordered URL candidates (large → medium) for the client to fall through. */
  urls: string[];
  alt: string;
  photographer: string;
  photographerUrl: string;
  /** Pexels photo page — required attribution link. */
  pexelsUrl: string;
};

type Photo = {
  id: number;
  width: number;
  height: number;
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  srcs: string[];
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function haystackOf(p: Photo): string {
  return `${p.alt} ${p.url}`.toLowerCase().replace(/-/g, " ");
}

/** Hard rejections: not a usable landscape photo of a place/activity. */
function isDisqualified(p: Photo): boolean {
  if (!p.srcs.length) return true;
  if (p.width < 1000) return true;
  if (p.height > p.width) return true; // landscape only
  const hay = haystackOf(p);
  return REJECT.some((bad) => hay.includes(bad));
}

/**
 * Relevance rank. Subject words (the activity/venue itself) matter far more than
 * the city name, so a generic city photo can never outrank an actual match.
 */
function rank(p: Photo, words: string[], cityWords: string[] = []): number {
  const hay = haystackOf(p);
  const subject = words.filter((w) => !cityWords.includes(w));
  const subjectHits = subject.filter((w) => hay.includes(w)).length;
  const cityHit = cityWords.some((w) => hay.includes(w)) ? 1 : 0;
  const subjectScore = subject.length ? (subjectHits / subject.length) * 65 : 30;
  const locationScore = cityHit * 15;
  const quality = p.width >= 3000 ? 12 : p.width >= 1900 ? 9 : 5;
  const ratio = p.width / Math.max(1, p.height);
  const framing = ratio >= 1.3 && ratio <= 2.1 ? 8 : 4;
  return Math.round(subjectScore + locationScore + quality + framing);
}

/** True when the candidate plausibly depicts the subject of the query. */
function matchesSubject(p: Photo, words: string[], cityWords: string[]): boolean {
  const subject = words.filter((w) => !cityWords.includes(w));
  if (!subject.length) return true;
  const hay = haystackOf(p);
  const hits = subject.filter((w) => hay.includes(w)).length;
  return hits >= Math.min(2, subject.length) || hits / subject.length >= 0.5;
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

/** One Pexels search, retried once with a longer timeout on failure. */
async function searchPexels(query: string, attempt = 0): Promise<Photo[]> {
  const key = process.env["PEXELS_API_KEY"];
  if (!key) return [];
  const url = `${PEXELS_SEARCH}?${new URLSearchParams({
    query,
    per_page: "15",
    orientation: "landscape",
    size: "large",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(attempt === 0 ? 6000 : 9000),
    });
    if (!res.ok) return attempt === 0 && res.status >= 500 ? searchPexels(query, 1) : [];
    const json = (await res.json()) as {
      photos?: {
        id?: number;
        width?: number;
        height?: number;
        url?: string;
        alt?: string;
        photographer?: string;
        photographer_url?: string;
        src?: Record<string, string>;
      }[];
    };
    return (json.photos ?? [])
      .filter((p) => p.id && p.src)
      .map((p) => ({
        id: p.id!,
        width: p.width ?? 0,
        height: p.height ?? 0,
        url: p.url ?? "",
        alt: p.alt ?? "",
        photographer: p.photographer ?? "Pexels photographer",
        photographerUrl: p.photographer_url ?? "https://www.pexels.com",
        srcs: [p.src?.["large2x"], p.src?.["large"], p.src?.["medium"]].filter(
          (u): u is string => Boolean(u),
        ),
      }));
  } catch {
    // Timed-out or dropped request: one retry so a slow response doesn't
    // silently cost this event its photo.
    return attempt === 0 ? searchPexels(query, 1) : [];
  }
}

/** Runs tasks in small concurrent batches so the API isn't hammered. */
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

function toEventPhoto(p: Photo): EventPhoto {
  return {
    id: p.id,
    urls: p.srcs.slice(0, 3),
    alt: p.alt,
    photographer: p.photographer,
    photographerUrl: p.photographerUrl,
    pexelsUrl: p.url || "https://www.pexels.com",
  };
}

type Entry = {
  query: string;
  words: string[];
  /** Relevant, ranked candidates for this event (best first). */
  options: Photo[];
  /** Confidence of the best option — drives global assignment order. */
  score: number;
};

/**
 * Returns one chosen Pexels photo per event query, with attribution and ordered
 * URL candidates. Photos are unique within the itinerary and assigned globally
 * by confidence, so later days keep their strong matches.
 */
export async function fetchImagesForQueries(
  queries: string[],
  destination = "",
): Promise<Record<string, EventPhoto>> {
  const unique = Array.from(
    new Set(
      queries
        .map((q) => (typeof q === "string" ? q.trim().slice(0, 120) : ""))
        .filter((q) => q.length > 2),
    ),
  ).slice(0, 45);

  const cityWords = tokens(destination);

  const [results, destinationPhotos] = await Promise.all([
    inBatches(unique, 8, (q) => searchPexels(q)),
    destination ? searchPexels(`${destination} landmark travel`) : Promise.resolve([]),
  ]);

  const usedIds = new Set<number>();
  const map: Record<string, EventPhoto> = {};

  const relevantOf = (pool: Photo[], words: string[]): Photo[] =>
    pool
      .filter((p) => !isDisqualified(p) && matchesSubject(p, words, cityWords))
      .sort((a, b) => rank(b, words, cityWords) - rank(a, words, cityWords));

  const scoreOf = (options: Photo[], words: string[]): number =>
    options.length ? rank(options[0]!, words, cityWords) : -1;

  const entries: Entry[] = unique.map((query, i) => {
    const words = tokens(query);
    const options = relevantOf(results[i] ?? [], words);
    return { query, words, options, score: scoreOf(options, words) };
  });

  // Second chance for events with no on-topic match: drop the city and search
  // the activity words alone, which often finds a true photo of the experience.
  const needRescue = entries.filter((e) => !e.options.length);
  const rescueResults = await inBatches(needRescue, 8, (e) => {
    const subject = e.words.filter((w) => !cityWords.includes(w));
    return subject.length ? searchPexels(subject.join(" ")) : Promise.resolve([]);
  });
  needRescue.forEach((e, i) => {
    e.options = relevantOf(rescueResults[i] ?? [], e.words);
    e.score = scoreOf(e.options, e.words);
  });

  // Global assignment: the most confident matches claim their photo first, so an
  // event on day 6 with an exact match isn't outbid by a weak day-1 match.
  [...entries]
    .sort((a, b) => b.score - a.score)
    .forEach((e) => {
      const fresh = e.options.find((p) => !usedIds.has(p.id));
      if (!fresh) return;
      usedIds.add(fresh.id);
      map[e.query] = toEventPhoto(fresh);
    });

  const stillUnresolved = entries.filter((e) => !map[e.query]).map((e) => e.query);

  // Third chance: one shared search per activity CATEGORY (museum, market, hike…),
  // so the backup photo still depicts the kind of experience — anchored to the city.
  const categories = Array.from(
    new Set(stillUnresolved.map(categoryOf).filter((c): c is string => Boolean(c))),
  ).slice(0, 8);

  const categoryResults = await inBatches(categories, 8, (cat) =>
    searchPexels(destination ? `${cat} ${destination}` : cat),
  );
  const categoryPools = new Map<string, Photo[]>();
  categories.forEach((cat, i) => {
    categoryPools.set(
      cat,
      (categoryResults[i] ?? [])
        .filter((p) => !isDisqualified(p))
        .sort(
          (a, b) =>
            rank(b, [cat, ...cityWords], cityWords) - rank(a, [cat, ...cityWords], cityWords),
        ),
    );
  });

  /** Claims the first unused photo from a pool, so no two events share it. */
  const claimUnique = (pool: Photo[]): Photo | undefined => {
    const free = pool.find((p) => !usedIds.has(p.id));
    if (!free) return undefined;
    usedIds.add(free.id);
    return free;
  };

  const leftover: string[] = [];
  stillUnresolved.forEach((q) => {
    const cat = categoryOf(q);
    const claimed = cat ? claimUnique(categoryPools.get(cat) ?? []) : undefined;
    if (claimed) map[q] = toEventPhoto(claimed);
    else leftover.push(q);
  });

  // Last resort: a distinct destination photo per remaining event — never the
  // same backup twice. If nothing is left the client shows a bundled photo.
  const destPool = destinationPhotos
    .filter((p) => !isDisqualified(p))
    .sort((a, b) => rank(b, cityWords) - rank(a, cityWords));

  leftover.forEach((q) => {
    const claimed = claimUnique(destPool);
    if (claimed) map[q] = toEventPhoto(claimed);
  });

  return map;
}
