const { test } = require("node:test");
const assert = require("node:assert/strict");
const { publicationChecklist } = require("../dist/property/publication-checklist");
const plot = {
  title: "Epe plot",
  description: "Listing details",
  location: "Epe",
  lga: "Epe",
  state: "Lagos",
  size: 600,
  price: 6000000,
  details: {
    beacons: [
      { id: "A", lat: 6.5, lng: 3.5 },
      { id: "B", lat: 6.501, lng: 3.5 },
      { id: "C", lat: 6.5, lng: 3.501 },
    ],
  },
};
test("publication checklist identifies the specific missing file", () => {
  assert.deepEqual(
    publicationChecklist(plot, { saved: true, photos: 0, documents: 1 }).map((i) => i.code),
    ["photo"],
  );
  assert.deepEqual(
    publicationChecklist(plot, { saved: true, photos: 1, documents: 0 }).map((i) => i.code),
    ["document"],
  );
  assert.deepEqual(publicationChecklist(plot, { saved: true, photos: 1, documents: 1 }), []);
});
test("all missing details, files and corners are returned together with their sections", () => {
  const issues = publicationChecklist(
    { ...plot, title: " ", state: "", price: 0, details: { beacons: [] } },
    { saved: false, photos: 0, documents: 0 },
  );
  assert.deepEqual(
    issues.map((i) => i.code),
    ["title", "state", "price", "draft", "photo", "document", "corners"],
  );
  assert.equal(issues.find((i) => i.code === "photo").section, "Files");
  assert.equal(issues.find((i) => i.code === "corners").section, "Map & boundaries");
});
test("overlapping corners and straight-line boundaries have distinct actionable errors", () => {
  const files = { saved: true, photos: 1, documents: 1 };
  const duplicate = {
    ...plot,
    details: {
      beacons: [
        plot.details.beacons[0],
        plot.details.beacons[1],
        { ...plot.details.beacons[0], id: "C" },
      ],
    },
  };
  assert.equal(publicationChecklist(duplicate, files)[0].code, "distinct-corners");
  const line = {
    ...plot,
    details: {
      beacons: [
        { id: "A", lat: 6.5, lng: 3.5 },
        { id: "B", lat: 6.501, lng: 3.5 },
        { id: "C", lat: 6.502, lng: 3.5 },
      ],
    },
  };
  assert.equal(publicationChecklist(line, files)[0].code, "boundary-area");
});
