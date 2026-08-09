import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

/** URLs already proven to load in this session — skips the skeleton next time. */
const verified = new Set<string>();
/** URLs known to be broken — never retried. */
const failed = new Set<string>();

const TIMEOUT_MS = 9000;

/** Resolves true only when the browser can actually decode the image in time. */
function probe(url: string): Promise<boolean> {
  if (verified.has(url)) return Promise.resolve(true);
  if (failed.has(url)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (ok) verified.add(url);
      else failed.add(url);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      img.src = "";
      finish(false);
    }, TIMEOUT_MS);
    img.onload = () => finish(img.naturalWidth > 1);
    img.onerror = () => finish(false);
    img.decoding = "async";
    img.src = url;
  });
}

/**
 * Shows a skeleton, validates each candidate before displaying it and walks down
 * the fallback list on any failure/timeout. Container size is fixed so the
 * layout never jumps, and an empty broken-image box is never rendered.
 */
export function ItineraryImage({
  candidates,
  alt,
  priority = false,
  loading: pending = false,
  className = "",
}: {
  candidates: string[];
  alt: string;
  /** First visible itinerary images load eagerly at high priority. */
  priority?: boolean;
  /** True while the server is still choosing images for this event. */
  loading?: boolean;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const key = candidates.join("|");

  useEffect(() => {
    let cancelled = false;
    setExhausted(false);
    const usable = candidates.filter((u) => u && !failed.has(u));
    const cached = usable.find((u) => verified.has(u));
    setSrc(cached ?? null);
    if (cached) return;

    (async () => {
      for (const url of usable) {
        // One retry per candidate covers transient rate limits / slow networks.
        const ok = (await probe(url)) || (failed.delete(url), await probe(url));
        if (cancelled) return;
        if (ok) {
          setSrc(url);
          return;
        }
      }
      if (!cancelled) setExhausted(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const showSkeleton = !src && !exhausted;

  return (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          width={1200}
          height={800}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => {
            failed.add(src);
            verified.delete(src);
            setSrc(null);
          }}
        />
      ) : showSkeleton || pending ? (
        <div className="h-full w-full animate-pulse bg-gradient-to-br from-secondary via-accent to-secondary" />
      ) : (
        // Graceful, on-brand placeholder — never a broken-image icon.
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-secondary">
          <ImageIcon className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
          <span className="sr-only">{alt}</span>
        </div>
      )}
    </div>
  );
}
