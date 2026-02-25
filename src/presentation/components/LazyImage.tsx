import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ImageCacheEntry = {
  dataUrl: string;
  expiresAt: number;
  lastAccessAt: number;
  bytes: number;
};

type ImageCachePayload = {
  version: number;
  entries: Record<string, ImageCacheEntry>;
};

const IMAGE_CACHE_STORAGE_KEY = "fantasy:image-cache:v1";
const IMAGE_CACHE_VERSION = 1;
const IMAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const IMAGE_CACHE_MAX_ITEMS = 140;
const IMAGE_CACHE_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const IMAGE_CACHE_MAX_ITEM_BYTES = 120 * 1024;
const imageCacheState = new Map<string, ImageCacheEntry>();
const imageCacheInflight = new Map<string, Promise<string | null>>();
let imageCacheHydrated = false;

const estimateStringBytes = (value: string): number => value.length * 2;

const pruneImageCacheInMemory = () => {
  const now = Date.now();

  for (const [key, entry] of imageCacheState.entries()) {
    if (entry.expiresAt <= now || !entry.dataUrl) {
      imageCacheState.delete(key);
    }
  }

  const sorted = [...imageCacheState.entries()].sort(
    (left, right) => left[1].lastAccessAt - right[1].lastAccessAt
  );

  let totalBytes = sorted.reduce((acc, [, entry]) => acc + entry.bytes, 0);
  while (
    sorted.length > IMAGE_CACHE_MAX_ITEMS ||
    totalBytes > IMAGE_CACHE_MAX_TOTAL_BYTES
  ) {
    const oldest = sorted.shift();
    if (!oldest) {
      break;
    }
    imageCacheState.delete(oldest[0]);
    totalBytes -= oldest[1].bytes;
  }
};

const persistImageCacheToStorage = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    pruneImageCacheInMemory();
    const payload: ImageCachePayload = {
      version: IMAGE_CACHE_VERSION,
      entries: Object.fromEntries(imageCacheState.entries())
    };
    localStorage.setItem(IMAGE_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    imageCacheState.clear();
    try {
      localStorage.removeItem(IMAGE_CACHE_STORAGE_KEY);
    } catch {
      // Ignore storage write errors.
    }
  }
};

const hydrateImageCacheFromStorage = () => {
  if (imageCacheHydrated || typeof window === "undefined") {
    return;
  }

  imageCacheHydrated = true;

  try {
    const raw = localStorage.getItem(IMAGE_CACHE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const payload = JSON.parse(raw) as ImageCachePayload;
    if (!payload || payload.version !== IMAGE_CACHE_VERSION || !payload.entries) {
      return;
    }

    for (const [key, entry] of Object.entries(payload.entries)) {
      if (!entry?.dataUrl) {
        continue;
      }
      imageCacheState.set(key, entry);
    }
    pruneImageCacheInMemory();
  } catch {
    try {
      localStorage.removeItem(IMAGE_CACHE_STORAGE_KEY);
    } catch {
      // Ignore storage read/remove errors.
    }
    imageCacheState.clear();
  }
};

const getCachedImageDataUrl = (src: string): string | null => {
  if (!src) {
    return null;
  }

  hydrateImageCacheFromStorage();
  const entry = imageCacheState.get(src);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    imageCacheState.delete(src);
    persistImageCacheToStorage();
    return null;
  }

  entry.lastAccessAt = Date.now();
  imageCacheState.set(src, entry);
  return entry.dataUrl;
};

const cacheImageDataUrl = (src: string, dataUrl: string) => {
  const bytes = estimateStringBytes(dataUrl);
  if (bytes <= 0 || bytes > IMAGE_CACHE_MAX_ITEM_BYTES) {
    return;
  }

  hydrateImageCacheFromStorage();
  imageCacheState.set(src, {
    dataUrl,
    bytes,
    expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
    lastAccessAt: Date.now()
  });
  persistImageCacheToStorage();
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("failed to decode image blob"));
    reader.readAsDataURL(blob);
  });
};

const fetchAndCacheImage = async (src: string): Promise<string | null> => {
  if (!src) {
    return null;
  }

  const cached = getCachedImageDataUrl(src);
  if (cached) {
    return cached;
  }

  const running = imageCacheInflight.get(src);
  if (running) {
    return running;
  }

  const job = (async () => {
    try {
      const response = await fetch(src, { cache: "force-cache" });
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      if (!blob || blob.size <= 0 || blob.size > IMAGE_CACHE_MAX_ITEM_BYTES) {
        return null;
      }

      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl) {
        return null;
      }

      cacheImageDataUrl(src, dataUrl);
      return dataUrl;
    } catch {
      return null;
    } finally {
      imageCacheInflight.delete(src);
    }
  })();

  imageCacheInflight.set(src, job);
  return job;
};

type LazyImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  rootMargin?: string;
  loading?: "eager" | "lazy";
};

export const LazyImage = ({
  src,
  alt,
  className,
  fallback,
  rootMargin = "180px 0px",
  loading = "lazy"
}: LazyImageProps) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setShouldLoad(false);
      setResolvedSrc(null);
      setHasError(false);
      return;
    }

    setShouldLoad(false);
    setResolvedSrc(null);
    setHasError(false);

    const node = anchorRef.current;
    if (!node) {
      return;
    }

    if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin,
        threshold: 0.01
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, src]);

  useEffect(() => {
    if (!shouldLoad || !src) {
      return;
    }

    let mounted = true;

    const resolveSource = async () => {
      const cached = getCachedImageDataUrl(src);
      if (cached) {
        if (mounted) {
          setResolvedSrc(cached);
        }
        return;
      }

      const fetched = await fetchAndCacheImage(src);
      if (!mounted) {
        return;
      }
      setResolvedSrc(fetched || src);
    };

    void resolveSource();

    return () => {
      mounted = false;
    };
  }, [shouldLoad, src]);

  return (
    <span ref={anchorRef} className="lazy-image-anchor">
      {shouldLoad && resolvedSrc && !hasError ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className={className}
          loading={loading}
          decoding="async"
          fetchPriority="low"
          onError={() => {
            if (resolvedSrc !== src) {
              setResolvedSrc(src);
              return;
            }
            setHasError(true);
          }}
        />
      ) : (
        fallback
      )}
    </span>
  );
};
