"use client";
import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/property-api";
import { getAccessToken, useSession } from "@/lib/session";

export function PropertyImage({
  id,
  alt,
  className,
  admin = false,
}: {
  id: string;
  alt: string;
  className?: string;
  admin?: boolean;
}) {
  const session = useSession();
  const [source, setSource] = useState<{ key: string; url: string } | null>(null);
  const key = `${session?.id}:${id}`;
  useEffect(() => {
    if (!admin) return;
    let active = true;
    let objectUrl = "";
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await getAccessToken();
        const url = assetUrl(id).replace("/plots/assets/", "/admin/plots/assets/");
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) return;
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setSource({ key, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      } catch {
        /* The file remains available through the download action. */
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, admin, key]);
  const src = admin ? (source?.key === key ? source.url : "") : assetUrl(id);
  return src ? (
    <img src={src} alt={alt} className={className} loading="lazy" />
  ) : (
    <div
      className={`${className || ""} animate-pulse bg-slate-100`}
      role="status"
      aria-label="Loading plot photo"
    />
  );
}
