// Mock demo data - replace with API calls when the backend is connected.
export type VerifStatus = "verified" | "in_progress" | "pending" | "unchecked";
export type CheckResult = "ok" | "further" | "nodata";
export type PlotState = "Lagos" | "Ogun";

export interface Beacon {
  id: string;
  lat: number;
  lng: number;
}
export interface Doc {
  name: string;
  status: "available" | "review" | "pending";
  reviewed?: string | undefined;
  reviewer: string;
}
export interface SiteCheck {
  key: string;
  label: string;
  result: CheckResult;
  source: string;
  date: string;
  reliability: 1 | 2 | 3;
  meaning: string;
}

export interface Plot {
  code: string;
  location: string;
  lga: string;
  state: PlotState;
  size: number;
  price: number;
  plans: ("Outright" | "3mo" | "6mo")[];
  status: VerifStatus;
  siteStatus:
    | "Not yet checked"
    | "Desk check complete"
    | "Specialist visit recommended"
    | "Site visit complete"
    | "Information needs updating";
  docSummary: string;
  beacons: Beacon[];
  shape: [number, number][];
  docs: Doc[];
  checks: SiteCheck[];
  photo: number;
  centre: [number, number];
}

export const RESERVATION_FEE = 30000;

const shapes: [number, number][][] = [
  [
    [10, 20],
    [80, 10],
    [90, 75],
    [20, 88],
  ],
  [
    [15, 15],
    [85, 22],
    [78, 85],
    [12, 70],
  ],
  [
    [20, 10],
    [88, 30],
    [70, 90],
    [10, 60],
  ],
  [
    [12, 25],
    [70, 12],
    [90, 60],
    [35, 90],
  ],
];

const checkTemplate = (seed: number): SiteCheck[] => {
  const r = (i: number): CheckResult =>
    (["ok", "ok", "further", "nodata"] as const)[(seed + i) % 4]!;
  return [
    {
      key: "flood",
      label: "Flooding",
      result: r(0),
      source: "NIHSA flood outlook + satellite history",
      date: "Sep 2026",
      reliability: 2,
      meaning: "Looks at past flood extents and seasonal outlooks near the plot.",
    },
    {
      key: "slope",
      label: "Height & Slope",
      result: r(1),
      source: "SRTM 30m elevation model",
      date: "Aug 2026",
      reliability: 2,
      meaning: "Estimated ground height and how steep the land is.",
    },
    {
      key: "drain",
      label: "Drainage",
      result: r(2),
      source: "Desk review of OSM waterways",
      date: "Aug 2026",
      reliability: 1,
      meaning: "Whether rainwater has a likely path away from the plot.",
    },
    {
      key: "soil",
      label: "Soil & Ground",
      result: r(3),
      source: "FAO soil map (regional)",
      date: "Jul 2026",
      reliability: 1,
      meaning: "General soil type in the area. This is not a geotechnical test.",
    },
    {
      key: "road",
      label: "Road Access",
      result: "ok",
      source: "Site visit + OSM roads",
      date: "Sep 2026",
      reliability: 3,
      meaning: "Whether a usable road reaches the plot today.",
    },
    {
      key: "landuse",
      label: "Land-Use Limits",
      result: r(1),
      source: "State master plan (public copy)",
      date: "Jun 2026",
      reliability: 2,
      meaning: "Known zoning or government acquisition overlaps.",
    },
    {
      key: "surround",
      label: "Surroundings",
      result: "ok",
      source: "Site visit photos",
      date: "Sep 2026",
      reliability: 3,
      meaning: "What's around the plot: homes, farms, industry.",
    },
    {
      key: "climate",
      label: "Climate",
      result: r(2),
      source: "NiMet seasonal data",
      date: "Sep 2026",
      reliability: 2,
      meaning: "Rainfall and heat patterns for the area.",
    },
    {
      key: "visit",
      label: "Site Visits",
      result: seed % 3 === 0 ? "nodata" : "ok",
      source: "MIRAI field team",
      date: "Sep 2026",
      reliability: 3,
      meaning: "Whether someone has physically walked the boundaries.",
    },
  ];
};

const base: Omit<Plot, "beacons" | "shape" | "docs" | "checks" | "photo" | "centre">[] = [
  {
    code: "MR-4092",
    location: "Epe",
    lga: "Epe",
    state: "Lagos",
    size: 600,
    price: 6800000,
    plans: ["Outright", "3mo", "6mo"],
    status: "verified",
    siteStatus: "Site visit complete",
    docSummary: "Survey plan + deed on file",
  },
  {
    code: "MR-4105",
    location: "Ibeju-Lekki",
    lga: "Ibeju-Lekki",
    state: "Lagos",
    size: 500,
    price: 9500000,
    plans: ["Outright", "6mo"],
    status: "verified",
    siteStatus: "Desk check complete",
    docSummary: "Survey plan + C of O on file",
  },
  {
    code: "MR-4117",
    location: "Ikorodu",
    lga: "Ikorodu",
    state: "Lagos",
    size: 450,
    price: 4200000,
    plans: ["Outright", "3mo"],
    status: "in_progress",
    siteStatus: "Specialist visit recommended",
    docSummary: "Survey plan on file · deed under review",
  },
  {
    code: "MR-4121",
    location: "Lakowe",
    lga: "Ibeju-Lekki",
    state: "Lagos",
    size: 600,
    price: 12500000,
    plans: ["Outright", "3mo", "6mo"],
    status: "verified",
    siteStatus: "Site visit complete",
    docSummary: "Survey plan + Governor's consent on file",
  },
  {
    code: "MR-4133",
    location: "Eredo",
    lga: "Epe",
    state: "Lagos",
    size: 300,
    price: 2900000,
    plans: ["Outright", "3mo", "6mo"],
    status: "pending",
    siteStatus: "Not yet checked",
    docSummary: "Survey plan pending",
  },
  {
    code: "MR-4140",
    location: "Imota",
    lga: "Ikorodu",
    state: "Lagos",
    size: 500,
    price: 3600000,
    plans: ["Outright", "6mo"],
    status: "in_progress",
    siteStatus: "Desk check complete",
    docSummary: "Survey plan on file",
  },
  {
    code: "MR-5011",
    location: "Sagamu",
    lga: "Sagamu",
    state: "Ogun",
    size: 600,
    price: 3200000,
    plans: ["Outright", "3mo", "6mo"],
    status: "verified",
    siteStatus: "Site visit complete",
    docSummary: "Survey plan + deed on file",
  },
  {
    code: "MR-5024",
    location: "Mowe",
    lga: "Obafemi Owode",
    state: "Ogun",
    size: 450,
    price: 2700000,
    plans: ["Outright", "3mo"],
    status: "verified",
    siteStatus: "Desk check complete",
    docSummary: "Survey plan + deed on file",
  },
  {
    code: "MR-5032",
    location: "Ofada",
    lga: "Obafemi Owode",
    state: "Ogun",
    size: 600,
    price: 2400000,
    plans: ["Outright", "6mo"],
    status: "unchecked",
    siteStatus: "Not yet checked",
    docSummary: "Documents being collected",
  },
  {
    code: "MR-5047",
    location: "Abeokuta North",
    lga: "Abeokuta North",
    state: "Ogun",
    size: 700,
    price: 1950000,
    plans: ["Outright", "3mo", "6mo"],
    status: "in_progress",
    siteStatus: "Information needs updating",
    docSummary: "Survey plan on file · title under review",
  },
  {
    code: "MR-5053",
    location: "Ibafo",
    lga: "Obafemi Owode",
    state: "Ogun",
    size: 500,
    price: 3900000,
    plans: ["Outright", "3mo"],
    status: "verified",
    siteStatus: "Site visit complete",
    docSummary: "Survey plan + deed on file",
  },
  {
    code: "MR-5068",
    location: "Sagamu Interchange",
    lga: "Sagamu",
    state: "Ogun",
    size: 300,
    price: 1800000,
    plans: ["Outright", "3mo", "6mo"],
    status: "pending",
    siteStatus: "Desk check complete",
    docSummary: "Survey plan under review",
  },
];

// Real approximate site centres (lat, lng) in each named town.
const CENTRES: [number, number][] = [
  [6.5935, 3.9802],
  [6.4598, 3.9361],
  [6.6402, 3.531],
  [6.4672, 3.7046],
  [6.5627, 3.9341],
  [6.6554, 3.6571],
  [6.8423, 3.6402],
  [6.8133, 3.4421],
  [6.8569, 3.4101],
  [7.1802, 3.3263],
  [6.7502, 3.4169],
  [6.8188, 3.6083],
];

export const PLOTS: Plot[] = base.map((p, i) => {
  const [clat, clng] = CENTRES[i]!;
  const shape = shapes[i % 4]!;
  const d = 0.00028 * Math.sqrt(p.size / 500);
  const beacons = ["A", "B", "C", "D"].map((id, j) => ({
    id,
    lat: +(clat + ((50 - shape[j]![1]) / 100) * d).toFixed(6),
    lng: +(clng + ((shape[j]![0] - 50) / 100) * d).toFixed(6),
  }));
  const st = p.status;
  return {
    ...p,
    beacons,
    shape,
    photo: i % 3,
    centre: [clat, clng] as [number, number],
    docs: [
      {
        name: "Survey plan",
        status: st === "pending" || st === "unchecked" ? "review" : "available",
        reviewed: "12 Sep 2026",
        reviewer: "Licensed surveyor",
      },
      {
        name: "Title document",
        status: st === "verified" ? "available" : "review",
        reviewed: st === "verified" ? "18 Sep 2026" : undefined,
        reviewer: "Verification reviewer",
      },
      {
        name: "Sale agreement",
        status: "available",
        reviewed: "20 Sep 2026",
        reviewer: "Legal partner",
      },
      { name: "Payment receipts", status: "pending", reviewer: "Payment support" },
      {
        name: "Deed of assignment",
        status: st === "verified" ? "review" : "pending",
        reviewer: "Legal partner",
      },
    ],
    checks: checkTemplate(i).map((c) =>
      p.siteStatus === "Not yet checked"
        ? {
            ...c,
            result: "nodata" as const,
            source: "No source reviewed",
            date: "Not checked",
            reliability: 1 as const,
          }
        : c,
    ),
  };
});

export const getPlot = (code: string) => PLOTS.find((p) => p.code === code);

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");
export const nairaShort = (n: number) =>
  n >= 1e6 ? `₦${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : naira(n);

export const costBreakdown = (price: number) => [
  { label: "Land price", amount: price, note: "Price of the plot itself" },
  {
    label: "Legal fees",
    amount: Math.round(price * 0.05),
    note: "Lawyer review and agreement drafting (5%)",
  },
  {
    label: "Documentation",
    amount: 250000,
    note: "Deed of assignment preparation and registration",
  },
  { label: "Survey", amount: 350000, note: "Licensed survey plan in your name" },
];

export const planSchedule = (price: number, plan: "Outright" | "3mo" | "6mo") => {
  const months = plan === "Outright" ? 1 : plan === "3mo" ? 3 : 6;
  const markup = plan === "6mo" ? 1.05 : 1;
  const total = price * markup;
  return { months, total, monthly: total / months };
};

// ---------- Dashboard demo ----------
export type Stage = "Reservation" | "Payment" | "Verification" | "Documentation" | "Complete";
export const STAGES: Stage[] = [
  "Reservation",
  "Verification",
  "Payment",
  "Documentation",
  "Complete",
];

export interface Owned {
  code: string;
  stage: Stage;
  plan: "Outright" | "3mo" | "6mo";
  paid: number;
  reservedAt?: string;
  accessExpiresAt?: string;
  instalments: { due: string; amount: number; status: "Paid" | "Upcoming" | "Overdue" }[];
}

export const OWNED: Owned[] = [
  {
    code: "MR-4092",
    stage: "Payment",
    plan: "6mo",
    paid: 3570000,
    instalments: [
      { due: "05 May 2026", amount: 1190000, status: "Paid" },
      { due: "05 Jun 2026", amount: 1190000, status: "Paid" },
      { due: "05 Jul 2026", amount: 1190000, status: "Paid" },
      { due: "05 Aug 2026", amount: 1190000, status: "Overdue" },
      { due: "05 Nov 2026", amount: 1190000, status: "Upcoming" },
      { due: "05 Dec 2026", amount: 1190000, status: "Upcoming" },
    ],
  },
  {
    code: "MR-5011",
    stage: "Documentation",
    plan: "Outright",
    paid: 3200000,
    instalments: [{ due: "02 Mar 2026", amount: 3200000, status: "Paid" }],
  },
  {
    code: "MR-5024",
    stage: "Reservation",
    plan: "3mo",
    paid: 0,
    instalments: [
      { due: "01 Nov 2026", amount: 900000, status: "Upcoming" },
      { due: "01 Dec 2026", amount: 900000, status: "Upcoming" },
      { due: "01 Jan 2027", amount: 900000, status: "Upcoming" },
    ],
  },
];

export type AlertType =
  "verification" | "payment" | "document" | "site" | "announcement" | "matching";
export const ALERTS: {
  id: number;
  type: AlertType;
  title: string;
  body: string;
  time: string;
  code: string;
  unread: boolean;
  scope?: "all-buyers";
}[] = [
  {
    id: 1,
    type: "payment",
    title: "Instalment overdue",
    body: "Your August instalment for MR-4092 is 70 days overdue. No penalty fees have been added. Please contact support to agree a plan.",
    time: "2h ago",
    code: "MR-4092",
    unread: true,
  },
  {
    id: 2,
    type: "verification",
    title: "Title document verified",
    body: "The title for MR-5011 was reviewed and marked Verified by a verification reviewer.",
    time: "Yesterday",
    code: "MR-5011",
    unread: true,
  },
  {
    id: 3,
    type: "site",
    title: "Site visit complete",
    body: "Field team walked all four beacons on MR-4092. Photos added to the record.",
    time: "3 days ago",
    code: "MR-4092",
    unread: false,
  },
  {
    id: 4,
    type: "document",
    title: "Deed draft uploaded",
    body: "A new version (v2) of the deed of assignment for MR-5011 is available to review.",
    time: "5 days ago",
    code: "MR-5011",
    unread: false,
  },
  {
    id: 5,
    type: "payment",
    title: "Reservation confirmed",
    body: "₦30,000 reservation received for MR-5024. Your first instalment is due 01 Nov.",
    time: "1 week ago",
    code: "MR-5024",
    unread: false,
  },
];

export const DOC_HISTORY = [
  { v: "v3", date: "20 Sep 2026", actor: "Legal partner", change: "Final signed copy uploaded" },
  {
    v: "v2",
    date: "11 Sep 2026",
    actor: "Document admin",
    change: "Corrected buyer name spelling",
  },
  { v: "v1", date: "02 Sep 2026", actor: "Document admin", change: "Initial draft uploaded" },
];

// ---------- Admin demo ----------
export type StaffRole =
  | "Super Admin"
  | "Admin"
  | "Listing Manager"
  | "Verification Reviewer"
  | "Payment Support"
  | "Document Administrator"
  | "Site Check Contributor";
export const STAFF: { name: string; email: string; role: StaffRole; active: boolean }[] = [
  { name: "Adaeze Okafor", email: "adaeze@mirai.ng", role: "Super Admin", active: true },
  { name: "Tunde Bakare", email: "tunde@mirai.ng", role: "Listing Manager", active: true },
  { name: "Ifeoma Nwosu", email: "ifeoma@mirai.ng", role: "Verification Reviewer", active: true },
  { name: "Kunle Adeyemi", email: "kunle@mirai.ng", role: "Payment Support", active: true },
  { name: "Zainab Bello", email: "zainab@mirai.ng", role: "Document Administrator", active: true },
  {
    name: "Segun Olatunji",
    email: "segun@mirai.ng",
    role: "Site Check Contributor",
    active: false,
  },
];

export const AUDIT = [
  {
    t: "17 Oct 2026 11:42",
    actor: "Ifeoma Nwosu",
    role: "Verification Reviewer",
    action: "Document status",
    target: "MR-5011 · Title",
    before: "Under review",
    after: "Verified",
    ip: "102.89.4.17",
  },
  {
    t: "17 Oct 2026 10:05",
    actor: "Kunle Adeyemi",
    role: "Payment Support",
    action: "Payment confirmed",
    target: "MR-5024 · ₦30,000",
    before: "Pending",
    after: "Confirmed",
    ip: "102.89.4.22",
  },
  {
    t: "16 Oct 2026 16:30",
    actor: "Tunde Bakare",
    role: "Listing Manager",
    action: "Price change",
    target: "MR-4121",
    before: "₦12,000,000",
    after: "₦12,500,000",
    ip: "41.58.112.9",
  },
  {
    t: "16 Oct 2026 09:12",
    actor: "Segun Olatunji",
    role: "Site Check Contributor",
    action: "Site report submitted",
    target: "MR-4092 · Site visit",
    before: "Not set",
    after: "Submitted",
    ip: "105.112.33.1",
  },
  {
    t: "15 Oct 2026 14:48",
    actor: "Zainab Bello",
    role: "Document Administrator",
    action: "Version uploaded",
    target: "MR-5011 · Deed v3",
    before: "v2",
    after: "v3",
    ip: "102.89.4.30",
  },
  {
    t: "15 Oct 2026 08:20",
    actor: "Adaeze Okafor",
    role: "Super Admin",
    action: "Role assigned",
    target: "segun@mirai.ng",
    before: "Not set",
    after: "Site Check Contributor",
    ip: "41.58.112.2",
  },
];

export const PERMISSIONS: Record<StaffRole, string[]> = {
  Admin: [
    "dashboard",
    "plots",
    "documents",
    "customers",
    "reservations",
    "payments",
    "site-checks",
    "co-ownership",
    "announcements",
    "audit",
    "settings",
    "catalogue",
  ],
  "Super Admin": [
    "dashboard",
    "plots",
    "payments",
    "documents",
    "site-checks",
    "customers",
    "announcements",
    "audit",
    "staff",
  ],
  "Listing Manager": ["dashboard", "plots"],
  "Verification Reviewer": ["dashboard", "documents"],
  "Payment Support": ["dashboard", "payments"],
  "Document Administrator": ["dashboard", "documents"],
  "Site Check Contributor": ["dashboard", "site-checks"],
};
