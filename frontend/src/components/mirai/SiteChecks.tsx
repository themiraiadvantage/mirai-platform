import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type Plot } from "@/lib/data";
import { Chip, checkCopy, toneChip } from "./primitives";
import { cn } from "@/lib/utils";
import { MapView } from "./MapView";

const siteTone: Record<Plot["siteStatus"], string> = {
  "Not yet checked": toneChip.muted,
  "Desk check complete": toneChip.info,
  "Specialist visit recommended": toneChip.warning,
  "Site visit complete": toneChip.gold,
  "Information needs updating": toneChip.danger,
};

export function SiteChecks({ plot }: { plot: Plot }) {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-2xl">Location & Site Assessment</h3>
        <Chip className={siteTone[plot.siteStatus]}>{plot.siteStatus}</Chip>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Sample findings for this frontend demo. Listed sources illustrate the intended evidence
        format; they have not been consulted for these plots. Figures are estimates, not engineering
        surveys.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plot.checks.map((c, i) => {
          const r = checkCopy[c.result];
          return (
            <div
              key={c.key}
              className={cn(
                "animate-rise p-5",
                c.result === "nodata" ? "surface-dashed" : "surface",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.label}</span>
                <Tooltip>
                  <TooltipTrigger aria-label={`What ${c.label} means`}>
                    <Info className="h-4 w-4 text-low" strokeWidth={1.5} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{c.meaning}</TooltipContent>
                </Tooltip>
              </div>
              <div className={cn("mt-3 flex gap-2 text-sm", r.tone)}>
                <r.icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                {r.text}
              </div>
              <div className="mt-4 space-y-1 text-xs text-low">
                <div>
                  Coverage: {plot.location} area · {c.label}
                </div>
                <div>Sample source: {c.source}</div>
                <div>
                  Method:{" "}
                  {c.result === "nodata"
                    ? "Not recorded"
                    : c.reliability === 3
                      ? "Sample field observation"
                      : "Sample desk screening"}
                </div>
                <div>Named reviewer: Not assigned</div>
                <div>
                  Reviewer role:{" "}
                  {c.reliability === 3 ? "Site check contributor" : "Desk check contributor"}
                </div>
                <div className="flex items-center justify-between">
                  <span>Checked {c.date}</span>
                  <span
                    className="flex items-center gap-1"
                    aria-label={`Reliability ${c.reliability} of 3`}
                  >
                    Reliability{" "}
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn(
                          "h-1.5 w-3 rounded-full",
                          n <= c.reliability ? "bg-primary-bright" : "bg-border",
                        )}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                Next step:{" "}
                {c.result === "nodata"
                  ? "Collect dated evidence and assign a reviewer."
                  : c.result === "further"
                    ? "Request specialist review and resolve the finding before proceeding."
                    : "Confirm current evidence and obtain specialist sign-off where required."}
              </p>
              {c.key === "visit" && (
                <p className="mt-2 text-xs text-low">
                  Inspection report, dated photos, coordinates and independent review: awaiting real
                  evidence.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function BeaconMap({ plot }: { plot: Plot }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="surface relative aspect-[4/3] overflow-hidden">
        <MapView plots={[plot]} focus={plot.code} />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground">
          Basemap: Esri · Simulated boundaries · Oct 2026
        </div>
      </div>
      <div className="surface p-5">
        <h4 className="text-lg">Survey beacons</h4>
        <ul className="mt-4 divide-y divide-border text-sm">
          {plot.beacons.map((b) => (
            <li key={b.id} className="flex justify-between py-3">
              <span className="text-gold">Beacon {b.id}</span>
              <span className="num text-muted-foreground">
                {b.lat.toFixed(4)}°N / {b.lng.toFixed(4)}°E
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-low">
          Demo coordinates around approximate town centres. These are not a licensed survey or a
          navigational boundary record.
        </p>
      </div>
    </div>
  );
}
