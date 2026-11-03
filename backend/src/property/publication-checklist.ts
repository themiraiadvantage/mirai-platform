export type PublicationIssue = {
  section: "Details" | "Pricing" | "Files" | "Map & boundaries" | "Publish";
  message: string;
  code: string;
};
type Listing = {
  title: string;
  description: string;
  location: string;
  lga: string;
  state: string;
  size: number;
  price: number;
  details: { beacons: { id: string; lat: number; lng: number }[] };
};
export function publicationChecklist(
  plot: Listing,
  files: { saved: boolean; photos: number; documents: number },
): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  for (const [field, label] of [
    ["title", "plot title"],
    ["description", "description"],
    ["location", "location"],
    ["lga", "LGA"],
    ["state", "state"],
  ] as const) {
    if (!plot[field].trim())
      issues.push({ code: field, section: "Details", message: `Add the ${label}.` });
  }
  if (!plot.size)
    issues.push({
      code: "size",
      section: "Details",
      message: "Enter a plot size greater than 0 sqm.",
    });
  if (!plot.price)
    issues.push({
      code: "price",
      section: "Pricing",
      message: "Enter a land price greater than ₦0.",
    });
  if (!files.saved)
    issues.push({
      code: "draft",
      section: "Publish",
      message: "Save this plot as a draft first so you can upload its files.",
    });
  if (!files.photos)
    issues.push({
      code: "photo",
      section: "Files",
      message: "Upload at least one file as a Listing photo.",
    });
  if (!files.documents)
    issues.push({
      code: "document",
      section: "Files",
      message:
        "Upload at least one Public listing document. Private allocation documents do not count.",
    });
  const beacons = plot.details.beacons;
  if (beacons.length < 3)
    issues.push({
      code: "corners",
      section: "Map & boundaries",
      message: `Mark at least 3 boundary corners on the map. ${beacons.length} ${beacons.length === 1 ? "corner is" : "corners are"} currently marked.`,
    });
  else if (
    new Set(beacons.map((b) => b.id)).size !== beacons.length ||
    new Set(beacons.map((b) => `${b.lat},${b.lng}`)).size !== beacons.length
  )
    issues.push({
      code: "distinct-corners",
      section: "Map & boundaries",
      message: "Move overlapping boundary corners apart so each corner is distinct.",
    });
  else {
    const area = Math.abs(
      beacons.reduce((sum, b, i) => {
        const next = beacons[(i + 1) % beacons.length];
        return sum + b.lat * next.lng - next.lat * b.lng;
      }, 0),
    );
    if (area < 1e-12)
      issues.push({
        code: "boundary-area",
        section: "Map & boundaries",
        message:
          "Adjust the corners to outline a plot area. The current corners form a straight line.",
      });
  }
  return issues;
}
