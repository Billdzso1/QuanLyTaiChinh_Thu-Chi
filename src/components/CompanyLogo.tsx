"use client";

import React, { useEffect, useState } from "react";

let cachedLogoUrl: string | null | undefined = undefined;
const listeners = new Set<(url: string | null) => void>();

export function setGlobalLogoUrl(url: string | null) {
  cachedLogoUrl = url;
  listeners.forEach((fn) => fn(url));
}

export function CompanyLogo({ size = 36 }: { size?: number }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(cachedLogoUrl ?? null);

  useEffect(() => {
    listeners.add(setLogoUrl);
    if (cachedLogoUrl === undefined) {
      fetch("/api/settings/logo")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const url = d?.logoUrl ?? null;
          cachedLogoUrl = url;
          setLogoUrl(url);
        })
        .catch(() => {
          cachedLogoUrl = null;
        });
    }
    return () => {
      listeners.delete(setLogoUrl);
    };
  }, []);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="NDAHOME Logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-lg object-contain bg-white p-0.5 border border-amber-500/60 shrink-0"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="NDAHOME Logo"
    >
      <rect width="48" height="48" rx="10" fill="#0A0A0A" stroke="#F59E0B" strokeWidth="2" />
      <path
        d="M24 10L9 22.5H13.5V36H20.5V27H27.5V36H34.5V22.5H39L24 10Z"
        fill="#F59E0B"
      />
      <path d="M21 36V28.5H27V36H21Z" fill="#0A0A0A" />
    </svg>
  );
}
