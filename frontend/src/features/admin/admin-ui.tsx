"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, FileText, Upload, Download, FolderOpen, Check, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useAdmin,
  uid,
  now,
  dateLabel,
  savePreviewFile,
  readPreviewFile,
  type AdminDocument,
} from "./admin-store";
import { cn } from "@/lib/utils";

export function PageHead({
  eyebrow = "MIRAI OPERATIONS",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="admin-page-actions">{action}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("admin-panel", className)}>
      {title && (
        <div className="admin-panel-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const v = String(children).toLowerCase();
  const tone =
    /confirmed|approved|published|available|active|complete|verified/.test(v) &&
    !/await|inactive|not |unverified/.test(v)
      ? "positive"
      : /pending|await|review|reserved|progress|looking|draft|recommended/.test(v)
        ? "pending"
        : /failed|cancelled|changes|suspended|archived/.test(v)
          ? "negative"
          : "neutral";
  return (
    <span className={`admin-badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Empty({
  title = "No records found",
  description = "Try a different search or add your first record.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <FolderOpen size={28} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="admin-search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className={cn(
          "admin-dialog max-h-[90dvh] overflow-y-auto rounded-2xl border-border bg-white",
          wide && "sm:max-w-3xl",
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function LocalPhoto({
  id,
  fallback = "",
  alt = "Plot photo",
  className,
}: {
  id?: string;
  fallback?: string;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    let address = "";
    readPreviewFile(id)
      .then((blob) => {
        if (blob && active) {
          address = URL.createObjectURL(blob);
          setUrl(address);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (address) URL.revokeObjectURL(address);
    };
  }, [id]);
  return url || fallback ? (
    <img src={url || fallback} alt={alt} className={className} />
  ) : (
    <div className={cn("admin-photo-placeholder", className)}>
      <FolderOpen size={22} />
    </div>
  );
}
export function FileView({
  document,
  onClose,
}: {
  document: AdminDocument | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [mime, setMime] = useState("");
  const [error, setError] = useState("");
  const file = document?.versions[document.versions.length - 1];
  useEffect(() => {
    setUrl("");
    setError("");
    if (!file) return;
    let active = true;
    let address = "";
    readPreviewFile(file.id)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setError(
            "This file is no longer available in this browser. Upload a replacement version.",
          );
          return;
        }
        address = URL.createObjectURL(blob);
        setMime(blob.type);
        setUrl(address);
      })
      .catch(() => {
        if (active) setError("The local file could not be opened.");
      });
    return () => {
      active = false;
      if (address) URL.revokeObjectURL(address);
    };
  }, [file]);
  return (
    <Modal
      title={document?.name || "Document"}
      description="Document preview and version history. Files are stored only in this browser."
      open={Boolean(document)}
      onClose={onClose}
      wide
    >
      {document && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge>{document.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {document.plot} · {document.visibility}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {url ? (
            <>
              {mime.startsWith("image/") ? (
                <img
                  src={url}
                  alt={document.name}
                  className="max-h-[50vh] w-full rounded-xl object-contain"
                />
              ) : (
                <iframe
                  src={url}
                  title={document.name}
                  className="h-[50vh] w-full rounded-xl border border-border"
                />
              )}
              <a
                href={url}
                download={file?.name}
                className="admin-text-link inline-flex items-center gap-2"
              >
                <Download size={15} />
                Download file
              </a>
            </>
          ) : (
            !file && (
              <div className="admin-empty">
                <FileText size={36} />
                <h3>Sample document record</h3>
                <p>This entry illustrates the review workflow. No original file is attached yet.</p>
              </div>
            )
          )}
          <div className="admin-detail-grid">
            <div>
              <small>Reviewer</small>
              <strong>{document.reviewer || "Not assigned"}</strong>
            </div>
            <div>
              <small>Reviewed</small>
              <strong>{dateLabel(document.reviewedAt)}</strong>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {document.notes || "No review notes recorded."}
          </p>
          <h3 className="text-sm font-semibold">Version history</h3>
          {document.versions.length ? (
            <ul className="admin-version-list">
              {[...document.versions].reverse().map((v, i) => (
                <li key={v.id}>
                  <FileText size={16} />
                  <span>
                    v{document.versions.length - i} · {v.name}
                    <small>
                      {dateLabel(v.date)} · {(v.size / 1024).toFixed(0)} KB
                    </small>
                  </span>
                  {i === 0 && <Badge>Current</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No uploaded versions.</p>
          )}
        </>
      )}
    </Modal>
  );
}

export function DocumentManager({
  plotCode,
  compact = false,
}: {
  plotCode?: string;
  compact?: boolean;
}) {
  const { data, update } = useAdmin();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [editing, setEditing] = useState<AdminDocument | null>(null);
  const [viewing, setViewing] = useState<AdminDocument | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const list = data.documents.filter(
    (d) =>
      (!plotCode || d.plot === plotCode) &&
      (d.name + d.plot + d.category).toLowerCase().includes(q.toLowerCase()) &&
      (filter === "All statuses" || d.status === filter),
  );
  function add() {
    if (!data.plots.length) {
      toast.error("Save a plot before attaching documents.");
      return;
    }
    setFile(null);
    setEditing({
      id: uid(),
      name: "",
      plot: plotCode || data.plots[0].code,
      buyer: "",
      category: "Survey plan",
      visibility: "Listing",
      status: "Awaiting review",
      reviewer: "",
      reviewedAt: "",
      notes: "",
      versions: [],
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (editing.visibility === "Buyer only" && !editing.buyer) {
      toast.error("Choose the buyer who can access this document.");
      return;
    }
    if (
      editing.visibility === "Buyer only" &&
      !data.reservations.some(
        (r) => r.buyer === editing.buyer && r.plot === editing.plot && r.status !== "Cancelled",
      )
    ) {
      toast.error(
        "This buyer does not have an active ownership or reservation record for the selected plot.",
      );
      return;
    }
    if (editing.status === "Approved" && !editing.reviewer.trim()) {
      toast.error("Assign a reviewer before approving a document.");
      return;
    }
    setBusy(true);
    try {
      const version = file ? await savePreviewFile(file) : null;
      const saved = {
        ...editing,
        name: editing.name.trim(),
        buyer: editing.visibility === "Buyer only" ? editing.buyer : "",
        reviewedAt: editing.status === "Awaiting review" ? "" : now(),
        versions: version ? [...editing.versions, version] : editing.versions,
      };
      update(
        "Document saved",
        saved.plot,
        (s) => {
          const index = s.documents.findIndex((d) => d.id === saved.id);
          if (index >= 0) s.documents[index] = saved;
          else s.documents.unshift(saved);
        },
        `${saved.name} · ${saved.status}`,
      );
      setEditing(null);
      setFile(null);
      toast.success("Document saved in this preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the document.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!compact && (
        <PageHead
          title="Documents"
          description="Every file, review and version, connected to the right plot and buyer."
          action={
            <Button onClick={add}>
              <Upload size={16} />
              Upload document
            </Button>
          }
        />
      )}
      <div className="admin-toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search documents or plot code…" />
        <select
          aria-label="Document status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All statuses</option>
          <option>Awaiting review</option>
          <option>Approved</option>
          <option>Changes requested</option>
        </select>
        {compact && (
          <Button size="sm" onClick={add}>
            <Upload size={15} />
            Add document
          </Button>
        )}
        <span className="admin-record-count">{list.length} documents</span>
      </div>
      <Panel>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Plot / access</th>
                <th>Status</th>
                <th>Reviewer</th>
                <th>Version</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="admin-file-cell">
                      <span>
                        <FileText size={19} />
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        <small>{d.category}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{d.plot}</strong>
                    <small>
                      {d.visibility}
                      {d.buyer && ` · ${data.buyers.find((b) => b.id === d.buyer)?.name}`}
                    </small>
                  </td>
                  <td>
                    <Badge>{d.status}</Badge>
                  </td>
                  <td>
                    {d.reviewer || <span className="text-muted-foreground">Unassigned</span>}
                    <small>{dateLabel(d.reviewedAt)}</small>
                  </td>
                  <td>{d.versions.length ? `v${d.versions.length}` : "Sample"}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button onClick={() => setViewing(d)}>View</button>
                      <button
                        onClick={() => {
                          setFile(null);
                          setEditing(d);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && (
          <Empty
            title="No documents in this view"
            description="Upload a document or adjust your filters."
            action={
              <Button variant="outline" onClick={add}>
                Add document
              </Button>
            }
          />
        )}
      </Panel>
      <Modal
        title={
          editing && data.documents.some((d) => d.id === editing.id)
            ? "Manage document"
            : "Upload document"
        }
        description="Add a record and an optional sample file. Files stay in your browser; nothing is sent to buyers."
        open={Boolean(editing)}
        onClose={() => !busy && setEditing(null)}
        wide
      >
        {editing && (
          <form onSubmit={save} className="admin-form">
            <div className="admin-form-grid">
              <Field label="Document name">
                <input
                  required
                  maxLength={150}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Epe survey plan"
                />
              </Field>
              <Field label="Plot">
                <select
                  value={editing.plot}
                  disabled={Boolean(plotCode)}
                  onChange={(e) => setEditing({ ...editing, plot: e.target.value, buyer: "" })}
                >
                  {data.plots.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} · {p.location}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Document category">
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                >
                  {[
                    "Survey plan",
                    "Title document",
                    "Sale agreement",
                    "Deed of assignment",
                    "Receipt",
                    "Inspection report",
                    "Other",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Access">
                <select
                  value={editing.visibility}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      visibility: e.target.value as AdminDocument["visibility"],
                    })
                  }
                >
                  <option>Listing</option>
                  <option>Buyer only</option>
                  <option>Staff only</option>
                </select>
              </Field>
              {editing.visibility === "Buyer only" && (
                <Field label="Buyer">
                  <select
                    required
                    value={editing.buyer}
                    onChange={(e) => setEditing({ ...editing, buyer: e.target.value })}
                  >
                    <option value="">Select buyer</option>
                    {data.buyers
                      .filter((b) =>
                        data.reservations.some(
                          (r) =>
                            r.buyer === b.id && r.plot === editing.plot && r.status !== "Cancelled",
                        ),
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label="Review status">
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as AdminDocument["status"] })
                  }
                >
                  <option>Awaiting review</option>
                  <option>Approved</option>
                  <option>Changes requested</option>
                </select>
              </Field>
              <Field label="Reviewer">
                <select
                  value={editing.reviewer}
                  onChange={(e) => setEditing({ ...editing, reviewer: e.target.value })}
                >
                  <option value="">Not assigned</option>
                  {data.staff
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id}>{s.name}</option>
                    ))}
                </select>
              </Field>
            </div>
            <Field
              label={editing.versions.length ? "Upload a new version" : "Attach file"}
              hint="PDF, JPG, PNG or WebP. Up to 20 MB. Use sample files only."
            >
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <Field label="Review notes">
              <textarea
                rows={3}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </Field>
            <div className="admin-form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button disabled={busy}>{busy ? "Saving…" : "Save document"}</Button>
            </div>
          </form>
        )}
      </Modal>
      <FileView document={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
