/**
 * Free, key-less activity imagery via the Wikipedia API.
 * Best-effort only: any failure resolves to no image and the UI falls back to
 * an illustrated tile.
 *
 * We deliberately reject maps, logos, flags, crests, diagrams and other
 * non-photographic assets so every stop shows the actual place.
 */

const ENDPOINT = "https://en.wikipedia.org/w/api.php";

type WikiPage = {
  title?: string;
  thumbnail?: { source?: string };
  original?: { source?: string };
};

type WikiResponse = { query?: { pages?: Record<string, WikiPage> } };

/** Filenames that are almost never a photo of the physical place. */
const REJECT = [
  "map",
  "locator",
  "logo",
  "flag",
  "coat_of_arms",
  "coatofarms",
  "crest",
  "seal",
  "emblem",
  "wappen",
  "diagram",
  "chart",
  "plan_of",
  "floorplan",
  "icon",
  "banner",
  "wordmark",
  "svg",
  "blank",
  "location",
];

function isPhoto(url: string): boolean {
  const file = decodeURIComponent(url).toLowerCase();
  if (/\.(svg|png)(\?|$)/.test(file.split("/").pop() ?? "")) return false;
  return !REJECT.some((bad) => file.includes(bad));
}

/** Asks Wikipedia for up to `limit` candidate images for one search phrase. */
async function candidates(query: string, limit = 4): Promise<string[]> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1000",
    format: "json",
    origin: "*",
  }).toString()}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Waypoint/1.0 (travel planning demo)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as WikiResponse;
    return Object.values(json.query?.pages ?? {})
      .map((p) => p.thumbnail?.source ?? p.original?.source ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Resolves one search phrase to a photograph of the place itself, trying a
 * building-biased variant of the phrase before the raw phrase.
 */
async function lookupOne(query: string): Promise<string | null> {
  const attempts = [`${query} building exterior`, query, `${query} view`];
  for (const attempt of attempts) {
    const urls = await candidates(attempt);
    const photo = urls.find(isPhoto);
    if (photo) return photo;
  }
  return null;
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
