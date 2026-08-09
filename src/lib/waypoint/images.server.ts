/**
 * Strict itinerary image selection.
 *
 * Every itinerary card must show a photo a traveller can recognise as the
 * actual experience. We never take the first search hit. Instead:
 *
 *   1. Candidates are gathered from Openverse (openly licensed photo search)
 *      with the Wikipedia article thumbnail as a secondary source.
 *   2. Every candidate is scored 0-100:
 *        event relevance 50 | location 20 | quality 15 | appeal 10 | clean 5
 *   3. Only candidates at or above the tier's threshold are displayed.
 *   4. Searching walks a tier ladder (exact event -> same attraction ->
 *      activity in destination -> activity anywhere -> destination) so we never
 *      jump straight from "exact" to "generic city photo".
 *
 * Selfies, portraits, influencer shots, maps, logos, screenshots, collages,
 * infographics, watermarked and low-resolution assets are rejected outright.
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
  // selfies / portraits / influencer shots
  "selfie",
  "self-portrait",
  "self portrait",
  "portrait of",
  "headshot",
  "posing",
  "poses",
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
  width?: number;
  height?: number;
  tags?: string;
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

/** Hard rejections that no score can rescue. */
function isDisqualified(c: Candidate): boolean {
  const url = c.url.toLowerCase();
  if (/\.(svg|gif|tif|tiff)(\?|$)/.test(url)) return false || true;
  const hay = haystackOf(c);
  if (REJECT.some((bad) => hay.includes(bad))) return true;
  // Reject genuinely small assets — they look bad in a large card.
  if (c.width && c.width < 640) return true;
  if (c.width && c.height && c.height / c.width > 1.6) return true; // extreme portrait
  return false;
}

/**
 * Scores a candidate 0-100 against the event.
 *   event relevance 50 · location 20 · quality 15 · appeal 10 · clean 5
 */
function scoreCandidate(
  c: Candidate,
  activity: string[],
  city: string[],
): number {
  const hay = haystackOf(c);

  if (activity.length === 0) return 0;
  const matched = activity.filter((w) => hay.includes(w)).length;
  if (matched === 0) return 0;
  let score = (matched / activity.length) * 50;

  // Location: full credit when the city is present, partial when no city was
  // requested (an exact-activity photo shouldn't be punished for that).
  if (city.length === 0) score += 20;
  else if (city.some((w) => hay.includes(w))) score += 20;
  else score += 10;

  // Quality by pixel width.
  const w = c.width ?? 0;
  score += w >= 1600 ? 15 : w >= 1000 ? 11 : w >= 640 ? 6 : 8;

  // Appeal: landscape framing reads best in a hero card.
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

/** Best-scoring acceptable candidate for one search phrase. */
async function bestFor(
  phrase: string,
  activity: string[],
  city: string[],
  threshold: number,
): Promise<{ url: string; score: number } | null> {
  const candidates = [
    ...(await openverseCandidates(phrase)),
    ...(await wikipediaCandidates(phrase)),
  ].filter((c) => !isDisqualified(c));

  let best: { url: string; score: number } | null = null;
  for (const c of candidates) {
    const score = scoreCandidate(c, activity, city);
    if (score >= threshold && (!best || score > best.score)) {
      best = { url: c.url, score };
    }
  }
  return best;
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
 * Tier ladder for one event. Relevance always beats aesthetics: we only fall
 * back to a destination photo when nothing activity-specific clears the bar.
 */
async function lookupOne(query: string, destination: string): Promise<string | null> {
  const { activity, city, core, cityText } = split(query);
  const destTokens = tokens(destination);

  const tiers: { phrase: string; activity: string[]; city: string[]; threshold: number }[] = [
    // Tier 1 — exact event in the exact location.
    { phrase: query, activity, city, threshold: 80 },
    // Tier 2 — same attraction/activity, any angle.
    { phrase: `${core} ${cityText} photograph`.trim(), activity, city, threshold: 80 },
    // Tier 3 — same activity somewhere in the destination.
    { phrase: `${core} ${destination}`.trim(), activity, city: destTokens, threshold: 75 },
    // Tier 4 — same activity elsewhere (still recognisably the activity).
    { phrase: core, activity, city: [], threshold: 68 },
  ];

  const seen = new Set<string>();
  for (const tier of tiers) {
    if (!tier.phrase || seen.has(`${tier.phrase}|${tier.threshold}`)) continue;
    seen.add(`${tier.phrase}|${tier.threshold}`);
    const hit = await bestFor(tier.phrase, tier.activity, tier.city, tier.threshold);
    if (hit) return hit.url;
  }

  // Tier 5 — destination image, absolute last resort.
  const dest = await bestFor(`${destination} landscape`, destTokens, [], 55);
  return dest?.url ?? null;
}

export async function fetchImagesForQueries(
  queries: string[],
  destination = "",
): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(
      queries
        .map((q) => (typeof q === "string" ? q.trim().slice(0, 120) : ""))
        .filter((q) => q.length > 2),
    ),
  ).slice(0, 45);

  const results = await Promise.all(
    unique.map((q) => lookupOne(q, destination || q)),
  );
  const map: Record<string, string> = {};
  unique.forEach((q, i) => {
    const url = results[i];
    if (url) map[q] = url;
  });
  return map;
}
