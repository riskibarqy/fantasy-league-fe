import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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

  useEffect(() => {
    if (!src) {
      setShouldLoad(false);
      return;
    }

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

  return (
    <span ref={anchorRef} className="lazy-image-anchor">
      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          className={className}
          loading={loading}
          decoding="async"
          fetchPriority="low"
        />
      ) : (
        fallback
      )}
    </span>
  );
};
