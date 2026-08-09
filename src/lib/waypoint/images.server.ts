/**
 * Free, key-less activity imagery via the Wikipedia API.
 * Best-effort only: any failure resolves to no image and the UI falls back to
 * an illustrated tile.
 */

const ENDPOINT = "https://en.wikipedia.org/w/api.php";

type WikiResponse = {
  query?: {
    pages?: Record<string, { thumbnail?: { source?: string } }>;
  };
};

async function lookupOne(query: string): Promise<string | null> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "800",
    format: "json",
    origin: "*",
  }).toString()}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WayPoint/1.0 (travel planning demo)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as WikiResponse;
    const pages = Object.values(json.query?.pages ?? {});
    return pages[0]?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
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
  ).slice(0, 40);

  const results = await Promise.all(unique.map((q) => lookupOne(q)));
  const map: Record<string, string> = {};
  unique.forEach((q, i) => {
    const url = results[i];
    if (url) map[q] = url;
  });
  return map;
}
