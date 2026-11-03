import { Check, Clock, HelpCircle, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { VerifStatus, CheckResult } from "@/lib/data";

export function Logo({
  className,
  size = "normal",
  dark = false,
}: {
  className?: string;
  size?: "normal" | "large" | "small";
  dark?: boolean;
}) {
  const whiteFilterId = `mirai-white-${useId().replaceAll(":", "")}`;
  return (
    <span
      className={cn("mirai-brand", `mirai-brand-${size}`, dark && "mirai-brand-on-dark", className)}
    >
      {dark && (
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
          <defs>
            <filter id={whiteFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
                result="white"
              />
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  5 0 -5 0 0"
                result="goldMask"
              />
              <feComposite in="goldMask" in2="SourceAlpha" operator="in" result="gold" />
              <feComposite in="white" in2="gold" operator="out" result="whiteOnly" />
              <feMerge>
                <feMergeNode in="whiteOnly" />
                <feMergeNode in="gold" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      )}
      <Image
        src="/brand/mirai-logo-no-tagline.png"
        width={1774}
        height={887}
        alt="MIRAI"
        sizes={size === "large" ? "220px" : size === "small" ? "32px" : "126px"}
        loading="eager"
        style={dark ? { filter: `url(#${whiteFilterId})` } : undefined}
      />
    </span>
  );
}

const verifMap: Record<VerifStatus, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "text-success bg-success/12 border-success/30" },
  in_progress: { label: "In progress", cls: "text-info bg-info/12 border-info/30" },
  pending: { label: "Pending review", cls: "text-warning bg-warning/12 border-warning/30" },
  unchecked: { label: "Not yet checked", cls: "text-muted-foreground bg-overlay border-border" },
};

export function StatusChip({ status, className }: { status: VerifStatus; className?: string }) {
  const m = verifMap[status];
  return <Chip className={cn(m.cls, className)}>{m.label}</Chip>;
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export const toneChip = {
  success: "text-success bg-success/12 border-success/30",
  warning: "text-warning bg-warning/12 border-warning/30",
  danger: "text-destructive bg-destructive/12 border-destructive/30",
  info: "text-info bg-info/12 border-info/30",
  gold: "text-gold bg-gold/12 border-gold/30",
  muted: "text-muted-foreground bg-overlay border-border",
};

export const checkCopy: Record<CheckResult, { text: string; icon: typeof Check; tone: string }> = {
  ok: {
    text: "No material issue found in the available checks",
    icon: Check,
    tone: "text-success",
  },
  further: { text: "Further checking recommended", icon: AlertTriangle, tone: "text-warning" },
  nodata: { text: "Not enough data", icon: HelpCircle, tone: "text-muted-foreground" },
};

/** Confirmed vs in-progress: solid border + check vs dashed border + clock. */
export function Fact({
  label,
  value,
  confirmed = true,
}: {
  label: string;
  value: React.ReactNode;
  confirmed?: boolean;
}) {
  return (
    <div className={cn("p-4", confirmed ? "surface" : "surface-dashed")}>
      <div className="flex items-center gap-1.5 text-xs text-low">
        {confirmed ? (
          <Check className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />
        ) : (
          <Clock className="h-3.5 w-3.5 text-warning" strokeWidth={1.5} />
        )}
        {label} {!confirmed && <span className="text-warning">· still being verified</span>}
      </div>
      <div className="mt-1 num text-foreground">{value}</div>
    </div>
  );
}

export function ParcelSvg({
  shape,
  className,
  beacons = true,
}: {
  shape: [number, number][];
  className?: string;
  beacons?: boolean;
}) {
  const d = shape.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + "Z";
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {[18, 30, 42].map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--primary-bright)"
          strokeOpacity=".12"
          strokeWidth=".4"
        />
      ))}
      <path
        d={d}
        fill="var(--primary)"
        fillOpacity=".18"
        stroke="var(--primary-bright)"
        strokeWidth=".8"
      />
      {beacons &&
        shape.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="2.4"
              fill="var(--gold)"
              className="animate-beacon"
              style={{ animationDelay: `${i * 300}ms` }}
            />
            <circle cx={x} cy={y} r="1.3" fill="var(--gold)" />
          </g>
        ))}
    </svg>
  );
}

export function EmptyState({ title, cta }: { title: string; cta?: React.ReactNode }) {
  return (
    <div className="surface flex flex-col items-center gap-4 p-10 text-center">
      <svg viewBox="0 0 120 80" className="h-20 w-32" aria-hidden>
        <path
          d="M10 60 Q40 20 60 45 T110 30"
          fill="none"
          stroke="var(--primary-bright)"
          strokeOpacity=".5"
        />
        <path d="M10 70 Q40 35 60 58 T110 45" fill="none" stroke="var(--gold)" strokeOpacity=".4" />
        <circle cx="60" cy="45" r="4" fill="var(--terracotta)" />
      </svg>
      <p className="text-muted-foreground">{title}</p>
      {cta}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-gold">{eyebrow}</div>
      )}
      <h2 className="text-3xl md:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = size / 2 - 4,
    c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-label={`${value}% complete`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth="4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={value === 100 ? "var(--gold)" : "var(--primary-bright)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        style={{ transition: "stroke-dashoffset 1s var(--ease-mirai)" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="num fill-foreground text-xs"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {value}%
      </text>
    </svg>
  );
}
