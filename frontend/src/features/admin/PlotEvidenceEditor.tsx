"use client";
import { Button } from "@/components/ui/button";
import type { LivePlot } from "@/lib/property-api";
import { PlotBoundaryMap } from "./PlotBoundaryMap";
import { Field } from "./admin-ui";

export function PlotEvidenceEditor({
  plot,
  change,
  site = false,
}: {
  plot: LivePlot;
  change: (patch: Partial<LivePlot>) => void;
  site?: boolean;
}) {
  const checks = plot.details.checks || [];
  const details = (patch: Partial<LivePlot["details"]>) =>
    change({ details: { ...plot.details, ...patch } });
  if (site)
    return (
      <div className="space-y-5">
        <p>
          Record findings with their source, reviewer and date. Listing verification remains a
          separate admin decision.
        </p>
        {!checks.length && (
          <Button
            variant="outline"
            onClick={() =>
              details({
                checks: [
                  "Flooding",
                  "Height and slope",
                  "Drainage",
                  "Soil and ground",
                  "Road access",
                  "Land-use limits",
                  "Surroundings",
                  "Climate",
                  "Site visits",
                ].map((label, i) => ({
                  key: `check-${i}`,
                  label,
                  result: "nodata",
                  source: "",
                  date: "",
                  reviewer: "",
                  notes: "",
                })),
              })
            }
          >
            Set up site assessment checks
          </Button>
        )}
        {checks.map((check, i) => {
          const edit = (patch: Partial<typeof check>) =>
            details({ checks: checks.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
          return (
            <section key={check.key} className="space-y-4 rounded-xl border p-5">
              <h3 className="text-lg font-semibold">{check.label}</h3>
              <div className="admin-form-grid">
                <Field label="Finding">
                  <select
                    value={check.result}
                    onChange={(e) => edit({ result: e.target.value as typeof check.result })}
                  >
                    <option value="nodata">Not enough evidence</option>
                    <option value="further">Further checking needed</option>
                    <option value="ok">No material issue found in available checks</option>
                  </select>
                </Field>
                <Field label="Source / evidence reference">
                  <input value={check.source} onChange={(e) => edit({ source: e.target.value })} />
                </Field>
                <Field label="Reviewer">
                  <input
                    value={check.reviewer}
                    onChange={(e) => edit({ reviewer: e.target.value })}
                  />
                </Field>
                <Field label="Assessment date">
                  <input
                    type="date"
                    value={check.date}
                    onChange={(e) => edit({ date: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Finding notes">
                <textarea
                  rows={3}
                  value={check.notes}
                  onChange={(e) => edit({ notes: e.target.value })}
                />
              </Field>
            </section>
          );
        })}
      </div>
    );
  return <PlotBoundaryMap plot={plot} change={change} />;
}
