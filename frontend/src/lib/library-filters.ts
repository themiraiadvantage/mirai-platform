export type LibraryFilters = { query: string; state: string; stage: string };
export function matchesLibraryFilters(
  plot: { code: string; location: string; state: string; title?: string },
  stage: string,
  filters?: LibraryFilters,
) {
  if (!filters) return true;
  return (
    (!filters.state || filters.state === plot.state) &&
    (!filters.stage || filters.stage === stage) &&
    `${plot.code} ${plot.title || ""} ${plot.location} ${plot.state}`
      .toLowerCase()
      .includes(filters.query.trim().toLowerCase())
  );
}
