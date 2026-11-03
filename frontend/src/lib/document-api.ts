import { getAccessToken } from "./session";
export type LiveDocument = {
  id: string;
  plotId: string;
  name: string;
  mime: string;
  kind: string;
  category: string;
  notes: string;
  recipientId: string | null;
  recipient: { id: string; name: string; email: string } | null;
  recordVersion: number;
  fileVersion: number;
  createdAt: string;
  updatedAt: string;
  plot: { code: string; title: string; publication: string };
  _count: { allocations: number };
  versions?: {
    id: string;
    number: number;
    name: string;
    mime: string;
    size: number;
    uploadedBy: string;
    createdAt: string;
  }[];
};
export type DocumentPage = {
  items: LiveDocument[];
  total: number;
  nextCursor: string | null;
  stats: { total: number; listing: number; buyer: number; staff: number };
};
export async function documentFile(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose a file up to 5 MB.");
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PDF, JPG, PNG or WebP file.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Could not read the selected file."));
    r.readAsDataURL(file);
  });
  return { name: file.name, mime: file.type, base64 };
}
export async function downloadDocument(path: string, name: string) {
  const token = await getAccessToken();
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(
    /\/$/,
    "",
  );
  const response = await fetch(base + path, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("This document could not be downloaded. Refresh and try again.");
  const blob = await response.blob(),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
  };
  a.download = /\.(pdf|png|jpe?g|webp)$/i.test(name) ? name : name + (ext[blob.type] || "");
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
