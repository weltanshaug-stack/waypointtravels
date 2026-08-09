import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

const CACHE_KEY = "waypoint:image-cache";
const LOAD_TIMEOUT_MS = 5000;

/** Remembers which candidate URL actually loaded, per image key. */
function readCache(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCache(key: string, url: string) {
  try {
    const cache = readCache();
    cache[key] = url;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Renders the first candidate image that actually loads.
 *
 * - shows a skeleton while loading
 * - falls through to the next-best candidate on error or timeout
 * - caches the winning URL so it isn't re-resolved on re-render
 * - never leaves a broken icon or empty container behind
 */
export function ActivityImage({
  cacheKey,
  candidates,
  alt,
  priority = false,
  className = "",
}: {
  cacheKey: string;
  candidates: string[] | undefined;
  alt: string;
  /** True for the first visible images — loads eagerly instead of lazily. */
  priority?: boolean;
  className?: string;
}) {
  const cached = typeof window !== "undefined" ? readCache()[cacheKey] : undefined;
  const list = candidates?.length ? candidates : [];
  const ordered = cached ? [cached, ...list.filter((u) => u !== cached)] : list;
  // Undefined means "still resolving"; an empty array means "nothing found".
  const resolving = candidates === undefined && !cached;

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = ordered[index];

  // Reset when the candidate set changes (e.g. after a plan revision).
  const signature = ordered.join("|");
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [cacheKey, signature]);

  // Slow or hanging URL → move on to the next candidate.
  useEffect(() => {
    if (!current || loaded) return;
    timer.current = setTimeout(() => {
      setLoaded(false);
      setIndex((i) => i + 1);
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, loaded]);

  // Out of candidates (or none were ever found) → show the calm placeholder.
  const exhausted = !resolving && !loaded && index >= ordered.length;
  const pending = !loaded && !exhausted;


  return (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      {current && (
        <img
          key={current}
          src={current}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget;
            // Guard against 1px trackers / error placeholders.
            if (img.naturalWidth < 200) {
              setIndex((i) => i + 1);
              return;
            }
            setLoaded(true);
            writeCache(cacheKey, current);
          }}
          onError={() => {
            setLoaded(false);
            setIndex((i) => i + 1);
          }}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Loading skeleton keeps the container size stable. */}
      {pending && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary via-muted to-secondary" />
      )}

      {/* Nothing loadable: a calm branded placeholder, never a broken icon. */}
      {exhausted && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/60">
          <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
