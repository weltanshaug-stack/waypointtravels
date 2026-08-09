/**
 * Itinerary photo lookup, powered by the Pexels photo API.
 *
 * For every event we work down a ladder that keeps the event's MEANING while
 * broadening the search, instead of collapsing to a generic city photo:
 *
 *   1. exact place + city          "Trattoria Example Rome"
 *   2. exact place + category      "Trattoria Example italian restaurant Rome"
 *   3. category + city             "italian restaurant Rome"
 *   4. relevant experience         "italian restaurant dining experience Rome"
 *   5. destination photo           (true last resort only)
 *
 * Each tier is searched for all still-unresolved events at once, filtered for
 * quality (no selfies/portraits/screenshots/collages/logos/maps/text), ranked by
 * how well it depicts the event, then assigned globally by confidence so late
 * days keep strong matches. A photo is never reused inside one itinerary.
 *
 * The API key is read inside this server-only module and never reaches the client.
 */

import type { EventPhoto } from "@/lib/waypoint/types";

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
  "blurry",
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

/** Leading verbs/phrases that aren't part of the place name. */
const LEAD_NOISE =
  /^(dinner|lunch|breakfast|brunch|drinks|coffee|dine|eat|meal|snack|stay|sleep|check\s*in(to)?|check|visit|see|tour|explore|discover|wander|walk|stroll|browse|shop|relax|unwind|enjoy|experience|take|ride|board|join|attend|catch|sunset|sunrise|morning|afternoon|evening|optional|free\s*time)\b[\s:,-]*(at|in|the|a|an|around|through|to|on)?[\s:,-]*/i;

/** Category keywords used for tiers 2–4 (place category / cuisine / activity). */
const CATEGORIES = [
  "italian restaurant",
  "japanese restaurant",
  "sushi restaurant",
  "ramen shop",
  "seafood restaurant",
  "steakhouse",
  "tapas bar",
  "pizzeria",
  "trattoria",
  "osteria",
  "bistro",
  "brasserie",
  "fine dining restaurant",
  "street food market",
  "food market",
  "night market",
  "market",
  "restaurant",
  "cafe",
  "coffee shop",
  "bakery",
  "wine bar",
  "cocktail bar",
  "bar",
  "brewery",
  "winery",
  "vineyard",
  "hotel",
  "boutique hotel",
  "resort",
  "hostel",
  "ryokan",
  "guesthouse",
  "museum",
  "art gallery",
  "gallery",
  "temple",
  "shrine",
  "church",
  "cathedral",
  "basilica",
  "mosque",
  "castle",
  "palace",
  "fortress",
  "monument",
  "park",
  "national park",
  "botanical garden",
  "garden",
  "beach",
  "lake",
  "river cruise",
  "boat tour",
  "kayaking",
  "sailing",
  "surfing",
  "diving",
  "snorkeling",
  "hiking trail",
  "hiking",
  "mountain",
  "waterfall",
  "cave",
  "hot spring",
  "onsen",
  "spa",
  "cycling",
  "bike tour",
  "walking tour",
  "food tour",
  "cooking class",
  "wine tasting",
  "viewpoint",
  "observation deck",
  "old town",
  "square",
  "bridge",
  "lighthouse",
  "harbour",
  "harbor",
  "island",
  "desert",
  "zoo",
  "aquarium",
  "theatre",
  "opera house",
  "concert",
  "stadium",
  "train ride",
  "ferry",
  "shopping street",
  "bookshop",
];

/** Words hinting at a category when no explicit keyword is present. */
const CATEGORY_HINTS: [RegExp, string][] = [
  [/\b(dinner|lunch|dine|dining|eat|meal|trattoria|osteria|tavern)\b/i, "restaurant"],
  [/\b(hotel|stay|lodge|inn|riad|ryokan|accommodation)\b/i, "hotel"],
  [/\b(trek|trekking|hike|hiking)\b/i, "hiking trail"],
  [/\b(cruise|boat|sail)\b/i, "boat tour"],
  [/\b(coffee|espresso|cafe)\b/i, "cafe"],
  [/\b(museum|exhibit|exhibition)\b/i, "museum"],
  [/\b(temple|shrine|pagoda)\b/i, "temple"],
  [/\b(market|bazaar|souk)\b/i, "market"],
  [/\b(spa|massage|thermal|onsen)\b/i, "spa"],
  [/\b(wine|vineyard|winery)\b/i, "wine tasting"],
];

/** A chosen Pexels photo for one event. */
export type { EventPhoto };

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
  if (p.width < 1200) return true; // no low-resolution assets
  if (p.height > p.width) return true; // landscape only
  const hay = haystackOf(p);
  return REJECT.some((bad) => hay.includes(bad));
}

/**
 * Relevance rank. Subject words (the place/activity itself) matter far more than
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

/** The place/activity name with leading verbs and the city stripped off. */
function placeOf(query: string, city: string): string {
  let out = query.trim();
  for (let i = 0; i < 2; i += 1) out = out.replace(LEAD_NOISE, "").trim();
  if (city) out = out.replace(new RegExp(`\\b${escapeRe(city)}\\b`, "gi"), "").trim();
  return out.replace(/\s{2,}/g, " ").replace(/^[,\-–:]\s*/, "") || query;
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Best-matching category/cuisine for the event, if any. */
function categoryOf(query: string): string | undefined {
  const hay = query.toLowerCase();
  const hits = CATEGORIES.filter((cat) => hay.includes(cat));
  if (hits.length) return hits.sort((a, b) => b.length - a.length)[0];
  for (const [pattern, cat] of CATEGORY_HINTS) if (pattern.test(hay)) return cat;
  return undefined;
}

/** One Pexels search, retried once with a longer timeout on failure. */
async function searchPexels(query: string, attempt = 0): Promise<Photo[]> {
  const key = process.env["PEXELS_API_KEY"];
  if (!key || !query.trim()) return [];
  const url = `${PEXELS_SEARCH}?${new URLSearchParams({
    query: query.trim().slice(0, 120),
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
  /** Search phrases, most specific first. */
  tiers: string[];
  /** Words that must stay represented for a candidate to count. */
  gateWords: string[][];
};

/**
 * Returns one chosen Pexels photo per event query, with attribution and ordered
 * URL candidates. Photos are unique within a trip and stay semantically tied to
 * the event: broader tiers keep the event's category, never a random city shot.
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

  const city = destination.split(",")[0]?.trim() ?? "";
  const cityWords = tokens(destination);

  const entries: Entry[] = unique.map((query) => {
    const place = placeOf(query, city);
    const category = categoryOf(query);
    const withCity = (text: string) => (city ? `${text} ${city}` : text).trim();

    const tiers = [
      withCity(place), // 1. exact place + city
      category ? withCity(`${place} ${category}`) : "", // 2. place + category + city
      category ? withCity(category) : "", // 3. category + city
      category ? withCity(`${category} experience`) : "", // 4. relevant experience
    ].filter(Boolean);

    const placeWords = tokens(place);
    const categoryWords = category ? tokens(category) : [];
    return {
      query,
      tiers,
      // Tiers 1–2 must match the place itself; tiers 3–4 must match the category.
      gateWords: tiers.map((_, i) => (i <= 1 ? placeWords : categoryWords)),
    };
  });

  const usedIds = new Set<number>();
  const map: Record<string, EventPhoto> = {};

  const relevantOf = (pool: Photo[], words: string[]): Photo[] =>
    pool
      .filter((p) => !isDisqualified(p) && matchesSubject(p, words, cityWords))
      .sort((a, b) => rank(b, words, cityWords) - rank(a, words, cityWords));

  const maxTiers = Math.max(0, ...entries.map((e) => e.tiers.length));

  for (let tier = 0; tier < maxTiers; tier += 1) {
    const pending = entries.filter((e) => !map[e.query] && e.tiers[tier]);
    if (!pending.length) continue;

    const pools = await inBatches(pending, 6, (e) => searchPexels(e.tiers[tier]!));

    // Score first, then assign globally by confidence, so an event with an exact
    // match isn't outbid by a weaker one that happened to be processed earlier.
    const scored = pending
      .map((e, i) => {
        const words = e.gateWords[tier]!;
        const options = relevantOf(pools[i] ?? [], words);
        return { entry: e, options, score: options.length ? rank(options[0]!, words, cityWords) : -1 };
      })
      .sort((a, b) => b.score - a.score);

    scored.forEach(({ entry, options }) => {
      const fresh = options.find((p) => !usedIds.has(p.id));
      if (!fresh) return;
      usedIds.add(fresh.id);
      map[entry.query] = toEventPhoto(fresh);
    });
  }

  // True last resort: a distinct destination photo per event still unresolved.
  const leftover = entries.filter((e) => !map[e.query]);
  if (leftover.length && destination) {
    const destPool = (await searchPexels(`${destination} travel landmark`))
      .filter((p) => !isDisqualified(p))
      .sort((a, b) => rank(b, cityWords) - rank(a, cityWords));
    leftover.forEach((e) => {
      const free = destPool.find((p) => !usedIds.has(p.id));
      if (!free) return;
      usedIds.add(free.id);
      map[e.query] = toEventPhoto(free);
    });
  }

  return map;
}
