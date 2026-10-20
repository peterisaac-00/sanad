import React, { useEffect, useMemo, useState } from "react";

/**
 * Minimal History-API router. It intentionally avoids adding a dependency:
 * every screen is a real URL, so refreshes and deep links work in production
 * (the Express server serves index.html for non-API paths).
 */

const EVENT = "sanad:navigate";

export function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function currentLocation(): string {
  return `${currentPath()}${window.location.search}`;
}

export function navigate(to: string, opts?: { replace?: boolean; state?: unknown }) {
  if (to === currentLocation()) return;
  if (opts?.replace) window.history.replaceState(opts?.state ?? null, "", to);
  else window.history.pushState(opts?.state ?? null, "", to);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener("popstate", update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return path;
}

export function useQuery(): URLSearchParams {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    window.addEventListener("popstate", update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function Link({
  href,
  className,
  children,
  onClick,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function redirectIf(path: string, condition: boolean) {
  if (condition) navigate(path, { replace: true });
}
