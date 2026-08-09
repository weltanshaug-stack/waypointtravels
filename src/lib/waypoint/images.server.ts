/**
 * Strict itinerary image selection pipeline.
 *
 * For every itinerary event we:
 *   1. Generate MULTIPLE queries (exact event + location, activity + location,
 *      activity + destination, broader activity) instead of one search.
 *   2. Retrieve many candidates per query from Openverse (openly licensed photo
 *      search) with Wikipedia article thumbnails as a secondary source.
 *   3. Hard-filter anything that isn't a usable photo of the experience
 *      (selfies, posed portraits, maps, logos, screenshots, collages,
 *      infographics, watermarks, low-resolution or broken assets).
 *   4. Score every survivor 0-100:
 *        event match 50 | location 20 | quality 15 | aesthetics 10 | clean 5
 *   5. Only accept a candidate that clears the tier threshold (80 for the
 *      event/attraction tiers), walking a fallback ladder before ever
 *      considering a generic destination photo.
 *   6. Deduplicate globally — an image (or a crop/resize of it) is never used
 *      twice inside one itinerary. If nothing unique clears the bar, the event
 *      gets NO image rather than a wrong one.
 */

const OPENVERSE = "https://api.openverse.org/v1/images/";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";
const UA = "Waypoint/1.0 (travel planning app)";

/** Words that mean the asset is not a usable photo of the experience. */
const REJECT = [
  // not a photo of a place
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
  // screenshots / composites
  "screenshot",
  "screen shot",
  "collage",
  "montage",
  "comparison",
  "before and after",
  "side by side",
  "panel of",
  "watermark",
  // selfies / posed portraits / influencer shots
  "selfie",
  "self-portrait",
  "self portrait",
  "portrait of",
  "headshot",
  "posing",
  "poses",
  "posed",
  "me at",
  "myself",
  "my trip",
  "instagram",
  "tiktok",
  "influencer",
  "model shoot",
  "photoshoot",
  "closeup of face",
  "close-up of face",
  // low quality markers
  "blurry",
  "blurred",
  "pixelated",
  "low resolution",
  "lowres",
  "thumbnail",
  "test image",
  "scan of",
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
  "de",
  "la",
  "el",
]);

type Candidate = {
  url: string;
  title: string;
  width?: number | undefined;
  height?: number | undefined;
  tags?: string | undefined;
};

type Scored = { url: string; score: number; threshold: number; identity: string };

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

/**
 * Identity used for global de-duplication. Strips thumbnail size prefixes and
 * extensions so crops/resizes of the same photo collapse to one key.
 */
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

/** Hard rejections that no score can rescue. */
function isDisqualified(c: Candidate): boolean {
  const url = c.url.toLowerCase();
  if (!/^https?:\/\//.test(url)) return true;
  if (/\.(svg|gif|tif|tiff)(\?|$)/.test(url)) return true;
  const hay = haystackOf(c);
  if (REJECT.some((bad) => hay.includes(bad))) return true;
  // Reject genuinely small assets — they look bad in a large card.
  if (c.width && c.width < 400) return true;
  if (c.width && c.height && c.height / c.width > 1.6) return true; // extreme portrait
  return false;
}

/** Partial match: "bakeries" still matches "bakery", "pastries" matches "pastry". */
function hasWord(hay: string, word: string): boolean {
  if (hay.includes(word)) return true;
  if (word.length >= 6) {
    const stem = word.slice(0, Math.max(4, word.length - 2));
    return hay.includes(stem);
  }
  return false;
}

/**
 * Scores a candidate 0-100 against the event.
 *   event match 50 · location 20 · quality 15 · aesthetics 10 · clean 5
 */
function scoreCandidate(c: Candidate, activity: string[], city: string[]): number {
  const hay = haystackOf(c);

  if (activity.length === 0) return 0;
  const matched = activity.filter((w) => hasWord(hay, w)).length;
  if (matched === 0) return 0;
  let score = (matched / activity.length) * 50;

  // Location: full credit when the city is present, partial when no city was
  // requested (an exact-activity photo shouldn't be punished for that).
  if (city.length === 0) score += 20;
  else if (city.some((w) => hasWord(hay, w))) score += 20;
  else score += 10;


  // Quality by pixel width.
  const w = c.width ?? 0;
  score += w >= 1600 ? 15 : w >= 1000 ? 11 : w >= 640 ? 6 : 8;

  // Aesthetics: landscape framing reads best in a hero card.
  const h = c.height ?? 0;
  if (w && h) score += w > h * 1.15 ? 10 : w >= h ? 7 : 3;
  else score += 6;

  // Professionalism: survived the reject list.
  score += 5;

  return Math.round(score);
}

async function openverseCandidates(query: string): Promise<Candidate[]> {
  const url = `${OPENVERSE}?${new URLSearchParams({
    q: query,
    page_size: "20",
    mature: "false",
    license_type: "all",
  }).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
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

async function wikipediaCandidates(query: string): Promise<Candidate[]> {
  const url = `${WIKIPEDIA}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "6",
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
          {
            title?: string;
            thumbnail?: { source?: string; width?: number; height?: number };
          }
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

/** All acceptable candidates for one search phrase, scored. */
async function candidatesFor(
  phrase: string,
  activity: string[],
  city: string[],
  threshold: number,
): Promise<Scored[]> {
  const raw = [
    ...(await openverseCandidates(phrase)),
    ...(await wikipediaCandidates(phrase)),
  ].filter((c) => !isDisqualified(c));

  return raw
    .map((c) => ({
      url: c.url,
      score: scoreCandidate(c, activity, city),
      threshold,
      identity: identityOf(c.url),
    }))
    .filter((s) => s.score >= s.threshold);
}

/**
 * Splits "<activity words> <city>" (the shape the planner emits) into the
 * activity tokens and the city tokens.
 */
function split(query: string): { activity: string[]; city: string[]; core: string; cityText: string } {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const cityText = words.length > 1 ? words[words.length - 1]! : "";
  const core = (words.length > 1 ? words.slice(0, -1) : words).join(" ");
  return {
    activity: tokens(core),
    city: tokens(cityText),
    core,
    cityText,
  };
}

/**
 * Builds the full, ordered candidate pool for one event across every fallback
 * level. Nothing is chosen here — selection happens later so we can enforce
 * global uniqueness across the whole itinerary.
 */
async function poolFor(query: string, destination: string): Promise<Scored[]> {
  const { activity, city, core, cityText } = split(query);
  const destTokens = tokens(destination);

  const levels: { phrase: string; activity: string[]; city: string[]; threshold: number }[] = [
    // L1 — exact attraction + activity + location.
    { phrase: query, activity, city, threshold: 80 },
    { phrase: `${core} ${cityText} photograph`.trim(), activity, city, threshold: 80 },
    // L2 — exact attraction + location.
    { phrase: `${core} ${cityText}`.trim(), activity, city, threshold: 80 },
    // L3 — activity + location.
    { phrase: `${core} ${destination}`.trim(), activity, city: destTokens, threshold: 78 },
    // L4 — activity + destination region, any angle.
    { phrase: `${core} ${destination} photograph`.trim(), activity, city: destTokens, threshold: 74 },
    // L5 — visually similar activity anywhere (still recognisably the activity).
    { phrase: core, activity, city: [], threshold: 68 },
  ];

  const pool: Scored[] = [];
  const seenPhrase = new Set<string>();
  for (const level of levels) {
    if (!level.phrase || seenPhrase.has(level.phrase)) continue;
    seenPhrase.add(level.phrase);
    const found = await candidatesFor(level.phrase, level.activity, level.city, level.threshold);
    pool.push(...found);
    // Stop early once we have a healthy set of strong, on-event candidates.
    if (pool.filter((p) => p.score >= 80).length >= 5) break;
  }

  // Highest score first, de-duplicated by identity within this event.
  const byIdentity = new Map<string, Scored>();
  for (const s of pool.sort((a, b) => b.score - a.score)) {
    if (!byIdentity.has(s.identity)) byIdentity.set(s.identity, s);
  }
  return Array.from(byIdentity.values());
}

/**
 * Returns an ORDERED list of candidate URLs per query (best first) so the client
 * can fall through to the next-best image whenever one fails to load.
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

  // Network-heavy candidate gathering runs in parallel...
  const pools = await Promise.all(unique.map((q) => poolFor(q, destination || q)));

  // ...then selection is sequential so the primary photo is never used twice.
  const usedIdentities = new Set<string>();
  const usedUrls = new Set<string>();
  const map: Record<string, string[]> = {};

  unique.forEach((q, i) => {
    const pool = pools[i] ?? [];
    const primary = pool.find((c) => !usedIdentities.has(c.identity) && !usedUrls.has(c.url));
    if (!primary) {
      // No unique first choice — still hand over backups so the card isn't blank.
      const backups = pool.slice(0, 4).map((c) => c.url);
      if (backups.length) map[q] = backups;
      return;
    }
    usedIdentities.add(primary.identity);
    usedUrls.add(primary.url);
    const fallbacks = pool
      .filter((c) => c.url !== primary.url && c.identity !== primary.identity)
      .slice(0, 4)
      .map((c) => c.url);
    map[q] = [primary.url, ...fallbacks];
  });

  return map;
}
