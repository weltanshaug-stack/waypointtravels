import { useEffect, useRef, useState } from "react";
import fallbackCoast from "@/assets/fallback-travel-1.jpg";
import fallbackValley from "@/assets/fallback-travel-2.jpg";
import fallbackHero from "@/assets/hero.jpg";
import type { EventPhoto } from "@/lib/waypoint/types";

const CACHE_KEY = "waypoint:image-cache";
const LOAD_TIMEOUT_MS = 6000;

/** Bundled travel photos — always available, zero network requests. */
const LOCAL_FALLBACKS = [fallbackCoast, fallbackValley, fallbackHero];

function pickLocalFallback(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return LOCAL_FALLBACKS[hash % LOCAL_FALLBACKS.length]!;
}

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
 * Renders the first candidate size of a Pexels photo that actually loads.
 *
 * - shows a skeleton while loading
 * - falls through to the next candidate on error or timeout
 * - ends on a bundled travel photo, so the container is never blank/broken
 * - caches the winning URL so it isn't re-resolved on re-render
 * - retries are bounded by the candidate list — never endless
 * - credits the photographer and links to Pexels, per their guidelines
 */
export function ActivityImage({
  cacheKey,
  photo,
  alt,
  priority = false,
  className = "",
}: {
  cacheKey: string;
  photo: EventPhoto | undefined;
  alt: string;
  /** True for the first visible images — loads eagerly instead of lazily. */
  priority?: boolean;
  className?: string;
}) {
  const cached = typeof window !== "undefined" ? readCache()[cacheKey] : undefined;
  const remote = photo?.urls?.length ? photo.urls : [];
  const local = pickLocalFallback(cacheKey);
  const ordered = [...(cached ? [cached] : []), ...remote.filter((u) => u !== cached), local];

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = ordered[Math.min(index, ordered.length - 1)]!;
  const isLocal = current === local;

  // Reset when the photo changes (e.g. after a plan revision).
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [cacheKey, photo?.id, remote.length]);

  // Slow or hanging URL → move on to the next candidate (local photo can't hang).
  useEffect(() => {
    if (loaded || isLocal) return;
    timer.current = setTimeout(() => setIndex((i) => i + 1), LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, loaded, isLocal]);

  return (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      <img
        key={current}
        src={current}
        alt={photo?.alt || alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={(e) => {
          // Guard against 1px trackers / error placeholders.
          if (!isLocal && e.currentTarget.naturalWidth < 200) {
            setIndex((i) => i + 1);
            return;
          }
          setLoaded(true);
          if (!isLocal) writeCache(cacheKey, current);
        }}
        onError={() => {
          if (isLocal) {
            // Bundled asset: nothing left to try, just show it as-is.
            setLoaded(true);
            return;
          }
          setLoaded(false);
          setIndex((i) => i + 1);
        }}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Loading skeleton keeps the container size stable. */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary via-muted to-secondary" />
      )}

      {/* Pexels attribution — required when a Pexels photo is displayed. */}
      {loaded && !isLocal && photo && (
        <span className="absolute right-2 bottom-2 rounded-full bg-background/80 px-2 py-0.5 text-[0.68rem] text-muted-foreground backdrop-blur-sm">
          <a
            href={photo.photographerUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="hover:text-foreground hover:underline"
          >
            {photo.photographer}
          </a>{" "}
          /{" "}
          <a
            href={photo.pexelsUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="hover:text-foreground hover:underline"
          >
            Pexels
          </a>
        </span>
      )}
    </div>
  );
}
