import React, { useState, useRef } from "react";
import {
  Home, Plus, Clock, Settings, ChevronLeft, FileText, Check, RotateCcw,
  Paperclip, ShieldCheck, HelpCircle, Wrench, ClipboardList, Ruler, TrendingUp,
  Download, Loader2, Layers, Settings2, Lock, X, ChevronRight,
} from "lucide-react";

/* =========================================================================
   HOMELEDGER — MVP (Milestone 2)
   Adds: a seeded, multi-project sample home + a "Home Report" — a tabbed,
   blueprint-styled view of the house (Overview / Structural / Systems /
   Cosmetic / Landscaping) that surfaces adjusted cost basis and doubles
   as a generous handoff packet for a future buyer.

   Still no AI APIs — same local rule-based classification engine as v1.
   Still no persistence — in-memory only for this artifact sandbox.
   ========================================================================= */

/* -------------------------------------------------------------------------
   DESIGN TOKENS
   ------------------------------------------------------------------------- */
const COLOR = {
  paper: "#F3F0E6", paperDark: "#E9E3D2", ink: "#232A24", inkSoft: "#5B6459",
  teal: "#2B5F5A", tealDark: "#1D433F", brass: "#B8863B", brassSoft: "#DDC088",
  card: "#FFFEFA", line: "#D8D0BC", rust: "#B4614A", rustSoft: "#EAD6CE",
};

// A distinct palette for the Home Report — deliberately "blueprint," to
// separate the ledger (daily use) from the report (handoff artifact).
const BLUE = {
  bg: "#123147", bgDeep: "#0D2537", grid: "rgba(180,225,235,0.09)",
  dim: "rgba(198,230,236,0.32)", bright: "#EAF7FA", brass: "#E8B662",
  card: "#173A54", line: "rgba(198,230,236,0.18)",
};

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";

/* -------------------------------------------------------------------------
   DATA MODEL HELPERS
   ------------------------------------------------------------------------- */
const CATEGORIES = [
  "Roof", "HVAC", "Plumbing", "Electrical", "Kitchen", "Bathroom",
  "Flooring", "Windows", "Doors", "Landscaping", "Deck", "Patio",
  "Driveway", "Other",
];

const CATEGORY_PRIOR = {
  Roof: 8, HVAC: 6, Kitchen: 10, Bathroom: 8, Windows: 6, Doors: 2,
  Deck: 8, Patio: 6, Driveway: 4, Landscaping: 2, Flooring: 2,
  Plumbing: -6, Electrical: -4, Other: 0,
};

// (Category → layer/level/hotspot mappings now live near the House View
// components further down, where the new isometric report lives.)

function currency(n, opts = {}) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, ...opts });
}
function yearOf(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? "Undated" : String(d.getFullYear());
}
function shortDate(dateStr) {
  const d = new Date(dateStr);
  return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function finalClass(p) { return p.userClassification || p.aiClassification?.label; }
function isCapital(p) { return finalClass(p) === "Likely Capital Improvement"; }
function yearsAgo(dateStr, today = new Date("2026-07-09")) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.max(0, Math.floor((today - d) / (1000 * 60 * 60 * 24 * 365.25)));
}

/* -------------------------------------------------------------------------
   LOCAL RULE-BASED CLASSIFICATION ENGINE (unchanged from v1)
   ------------------------------------------------------------------------- */
function classifyProject({ category, cost }, answers) {
  let score = 50;
  const notes = [];
  let uncertainty = 0;

  if (answers.improved === "yes") { score += 22; notes.push("marked as going beyond the home's original condition"); }
  else if (answers.improved === "no") { score -= 22; notes.push("marked as restoring something to its original condition"); }
  else if (answers.improved === "not_sure") { uncertainty += 20; notes.push("marked as unsure whether this went beyond original condition"); }

  if (answers.replaceOrAdd === "add") { score += 14; notes.push("added something that wasn't there before"); }
  else if (answers.replaceOrAdd === "replace") { score -= 6; notes.push("replaced an existing feature"); }

  if (answers.largerReno === "yes") { score += 14; notes.push("connected to a larger renovation"); }
  else if (answers.largerReno === "no") { score -= 4; }

  score += CATEGORY_PRIOR[category] ?? 0;

  const costNum = Number(cost) || 0;
  if (costNum >= 5000) { score += 10; notes.push("a larger cost, which often accompanies bigger improvements"); }
  else if (costNum > 0 && costNum < 500) { score -= 10; notes.push("a smaller cost, which often accompanies routine upkeep"); }

  score = Math.max(0, Math.min(100, score));

  let label = "Unclear — worth a closer look";
  if (score >= 62) label = "Likely Capital Improvement";
  else if (score <= 38) label = "Likely Repair / Maintenance";

  let confidence = Math.round(Math.abs(score - 50) * 1.9);
  confidence = Math.max(5, Math.min(97, confidence - uncertainty));
  if (label.startsWith("Unclear")) confidence = Math.min(confidence, 55);

  const reasonIntro = label === "Likely Capital Improvement"
    ? "This appears to permanently improve the property, based on what you shared"
    : label === "Likely Repair / Maintenance"
    ? "This looks like routine upkeep, based on what you shared"
    : "There's a mix of signals here, so it's worth a second look";

  const reason = notes.length ? `${reasonIntro} — it ${notes.slice(0, 2).join(" and ")}.` : `${reasonIntro}.`;
  return { label, confidence, reason, score };
}

/* -------------------------------------------------------------------------
   SEED DATA — one house, a realistic multi-year project history
   ------------------------------------------------------------------------- */
const SAMPLE_PROPERTY = { address: "123 Main Street", purchaseDate: "2018-04-01", purchasePrice: "350000" };

function seedProject(overrides) {
  return {
    id: crypto.randomUUID(),
    description: "", documents: [], userClassification: null,
    ...overrides,
  };
}

const SAMPLE_PROJECTS = [
  seedProject({ title: "Roof Replacement", category: "Roof", date: "2019-08-10", cost: "14000",
    description: "Full tear-off, upgraded to architectural shingles.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 81, reason: "This appears to permanently improve the property — it added something that wasn't there before and involved a larger cost." } }),
  seedProject({ title: "HVAC Replacement", category: "HVAC", date: "2020-06-01", cost: "9200",
    description: "Old unit was over 15 years old, replaced with high-efficiency system.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 76, reason: "This appears to permanently improve the property — it added something that wasn't there before and involved a larger cost." } }),
  seedProject({ title: "Water Heater Repair", category: "Plumbing", date: "2020-11-15", cost: "450",
    description: "Replaced heating element and thermostat.",
    aiClassification: { label: "Likely Repair / Maintenance", confidence: 68, reason: "This looks like routine upkeep, based on what you shared — it replaced an existing feature and a smaller cost." } }),
  seedProject({ title: "Kitchen Remodel", category: "Kitchen", date: "2021-09-20", cost: "32000",
    description: "New cabinets, counters, layout opened to dining room.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 93, reason: "This appears to permanently improve the property — it added something that wasn't there before and was connected to a larger renovation." } }),
  seedProject({ title: "Bathroom Refresh", category: "Bathroom", date: "2021-09-25", cost: "3800",
    description: "New paint, fixtures, and vanity — same layout.",
    aiClassification: { label: "Likely Repair / Maintenance", confidence: 58, reason: "This looks like routine upkeep, based on what you shared — it replaced an existing feature." } }),
  seedProject({ title: "Electrical Panel Upgrade", category: "Electrical", date: "2022-03-14", cost: "4200",
    description: "Upgraded to 200-amp service, added circuits for future EV charger.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 74, reason: "This appears to permanently improve the property — it added something that wasn't there before." } }),
  seedProject({ title: "Deck Addition", category: "Deck", date: "2022-07-01", cost: "11000",
    description: "New 300 sq ft deck off the back of the house — none existed before.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 88, reason: "This appears to permanently improve the property — it added something that wasn't there before and involved a larger cost." } }),
  seedProject({ title: "Driveway Resurfacing", category: "Driveway", date: "2023-05-10", cost: "5200",
    description: "Resurfaced existing driveway, no expansion.",
    aiClassification: { label: "Likely Repair / Maintenance", confidence: 61, reason: "This looks like routine upkeep, based on what you shared — it replaced an existing feature." } }),
  seedProject({ title: "Whole-House Window Replacement", category: "Windows", date: "2023-10-02", cost: "18500",
    description: "All original single-pane windows replaced with double-pane.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 85, reason: "This appears to permanently improve the property — it involved a larger cost and went beyond original condition." } }),
  seedProject({ title: "Landscaping Overhaul", category: "Landscaping", date: "2024-04-18", cost: "7600",
    description: "New hardscape patio area, plantings, and irrigation zones added.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 71, reason: "This appears to permanently improve the property — it added something that wasn't there before." } }),
  seedProject({ title: "Plumbing Leak Repair", category: "Plumbing", date: "2024-08-09", cost: "600",
    description: "Fixed a slow leak under the kitchen sink.",
    aiClassification: { label: "Likely Repair / Maintenance", confidence: 72, reason: "This looks like routine upkeep, based on what you shared — a smaller cost." } }),
  seedProject({ title: "First-Floor Flooring Replacement", category: "Flooring", date: "2025-02-11", cost: "9800",
    description: "Replaced worn carpet and vinyl with luxury vinyl plank throughout.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 69, reason: "This appears to permanently improve the property — it went beyond original condition and involved a larger cost." } }),
  seedProject({ title: "Furnace Tune-Up", category: "HVAC", date: "2025-11-01", cost: "220",
    description: "Annual seasonal maintenance visit.",
    aiClassification: { label: "Likely Repair / Maintenance", confidence: 80, reason: "This looks like routine upkeep, based on what you shared — a smaller cost." } }),
  seedProject({ title: "Primary Bathroom Remodel", category: "Bathroom", date: "2026-01-15", cost: "15400",
    description: "Full gut remodel — new layout, walk-in shower added.",
    aiClassification: { label: "Likely Capital Improvement", confidence: 89, reason: "This appears to permanently improve the property — it added something that wasn't there before and was connected to a larger renovation." } }),
];

/* -------------------------------------------------------------------------
   ZIP EXPORT
   HomeLedger has no backend and this artifact sandbox can't import a zip
   library, so this is a small hand-written ZIP writer (store/uncompressed
   method — no deflate). It's plain, well-documented ZIP format, so any zip
   tool on the receiving end opens it normally.
   ------------------------------------------------------------------------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDateTime(d) {
  const year = Math.max(1980, d.getFullYear()) - 1980;
  const dosDate = (year << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return { dosDate, dosTime };
}
// entries: [{ name: 'folder/file.txt', data: Uint8Array }]
function buildZip(entries) {
  const encoder = new TextEncoder();
  const { dosDate, dosTime } = dosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const size = data.length;

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    localParts.push(new Uint8Array(lh.buffer), nameBytes, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  });

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, new Uint8Array(eocd.buffer)], { type: "application/zip" });
}
function slugify(s) {
  return (s || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "untitled";
}
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toBytes(str) { return new TextEncoder().encode(str); }

// Walks every project/document, pulls real bytes where we have them
// (files actually uploaded this session), writes a clear placeholder
// note where we only have seed metadata, and adds a CSV ledger + a
// cost-basis summary at the root of the package.
async function buildExportZip(property, projects) {
  const entries = [];
  const capitalTotal = projects.filter(isCapital).reduce((s, p) => s + (Number(p.cost) || 0), 0);
  const purchasePrice = Number(property.purchasePrice) || 0;

  for (const p of projects) {
    const folder = `Documents/${slugify(p.category)}/${p.date || "undated"}_${slugify(p.title)}`;
    if (p.documents.length === 0) {
      entries.push({ name: `${folder}/.keep`, data: toBytes("No documents attached to this project yet.\n") });
      continue;
    }
    for (const doc of p.documents) {
      if (doc.file) {
        const buf = await doc.file.arrayBuffer();
        entries.push({ name: `${folder}/${doc.name}`, data: new Uint8Array(buf) });
      } else {
        // Seed/demo document — no real file bytes exist behind it in this artifact.
        entries.push({
          name: `${folder}/${doc.name}.NOTE.txt`,
          data: toBytes(`Placeholder for demo data: "${doc.name}" (${doc.type}).\nNo real file is attached in this sample — in the full app this would be the actual uploaded file.\n`),
        });
      }
    }
  }

  const csvHeader = "Title,Category,Date,Cost,Classification,AI Confidence,Notes";
  const csvRows = projects.map((p) => [
    p.title, p.category, p.date, p.cost, finalClass(p) || "", p.aiClassification?.confidence ?? "", p.description || "",
  ].map(csvEscape).join(","));
  entries.push({ name: "project-ledger.csv", data: toBytes([csvHeader, ...csvRows].join("\n") + "\n") });

  const summary = [
    `HomeLedger export — ${property.address}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    `Original purchase price: ${currency(purchasePrice)}`,
    `Capital improvements total: ${currency(capitalTotal)}`,
    `Adjusted cost basis (estimate): ${currency(purchasePrice + capitalTotal)}`,
    "",
    "This is an estimate only, not tax advice. Repairs and routine",
    "maintenance are excluded from the capital improvement total above.",
    "A tax professional can confirm what qualifies for your situation.",
  ].join("\n") + "\n";
  entries.push({ name: "cost-basis-summary.txt", data: toBytes(summary) });

  const readme = [
    `This package was exported from HomeLedger for ${property.address}.`,
    "",
    "Contents:",
    "- Documents/            Every project's receipts, invoices, and photos,",
    "                        organized by category and project.",
    "- project-ledger.csv    A spreadsheet-friendly list of every project,",
    "                        its cost, and its classification.",
    "- cost-basis-summary.txt  A plain-language summary of the adjusted",
    "                        cost basis math.",
    "",
    "This file works with any standard zip tool and isn't tied to the",
    "HomeLedger app — keep it wherever you keep other important home records.",
  ].join("\n") + "\n";
  entries.push({ name: "README.txt", data: toBytes(readme) });

  return buildZip(entries);
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* -------------------------------------------------------------------------
   SMALL UI PRIMITIVES
   ------------------------------------------------------------------------- */
function Screen({ children, bg = COLOR.paper, color = COLOR.ink }) {
  return (
    <div style={{ background: bg, fontFamily: "Inter, sans-serif", color }} className="w-full h-full flex flex-col relative">
      {children}
    </div>
  );
}
function TopRule({ color = COLOR.line }) {
  return <div style={{ height: 1, background: color }} className="w-full" />;
}
function BigButton({ children, onClick, variant = "primary", icon: Icon, disabled }) {
  const styles = {
    primary: { background: COLOR.teal, color: "#fff" },
    brass: { background: COLOR.brass, color: "#fff" },
    ghost: { background: "transparent", color: COLOR.ink, border: `1.5px solid ${COLOR.line}` },
    rust: { background: COLOR.rust, color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], opacity: disabled ? 0.5 : 1 }}
      className="w-full py-3.5 rounded-xl font-medium text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}
function Pill({ children, tone = "ink" }) {
  const tones = {
    ink: { background: COLOR.paperDark, color: COLOR.inkSoft },
    teal: { background: "#DEEAE8", color: COLOR.tealDark },
    brass: { background: COLOR.brassSoft, color: "#5C4419" },
    rust: { background: COLOR.rustSoft, color: "#7A3A29" },
  };
  return (
    <span style={{ ...tones[tone] }} className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full">
      {children}
    </span>
  );
}
function CategoryIcon({ size = 16 }) { return <Wrench size={size} />; }

// A tiny, dependency-free step-area chart. Replaces recharts, which was
// heavy enough in this single-file sandbox to slow first load on mobile.
function MiniBasisChart({ data }) {
  const w = 320, h = 120, pad = 6;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(data.length - 1, 1);
  const xAt = (i) => pad + i * stepX;
  const yAt = (v) => pad + (1 - (v - min) / range) * (h - pad * 2);

  let linePath = "";
  data.forEach((d, i) => {
    const x = xAt(i), y = yAt(d.value);
    linePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    if (i < data.length - 1) linePath += ` L ${xAt(i + 1)} ${y}`; // step
  });
  const areaPath = `${linePath} L ${xAt(data.length - 1)} ${h - pad} L ${xAt(0)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="basisFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BLUE.brass} stopOpacity="0.4" />
          <stop offset="100%" stopColor={BLUE.brass} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke={BLUE.grid} strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#basisFill)" stroke="none" />
      <path d={linePath} fill="none" stroke={BLUE.brass} strokeWidth="2" />
      {data.map((d, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(d.value)} r={i === data.length - 1 ? 3 : 2} fill={BLUE.brass} />
      ))}
    </svg>
  );
}
function Header({ title, onBack, dark }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={onBack} style={{ color: dark ? BLUE.bright : COLOR.ink }} className="p-1 -ml-1">
          <ChevronLeft size={22} />
        </button>
        <div style={{ fontFamily: "Fraunces, serif", color: dark ? BLUE.bright : COLOR.ink }} className="text-[16px] font-semibold">{title}</div>
        <div className="w-6" />
      </div>
      <TopRule color={dark ? BLUE.line : COLOR.line} />
    </>
  );
}
const inputStyle = { background: COLOR.card, border: `1.5px solid ${COLOR.line}` };
function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-[12px] font-medium" style={{ color: COLOR.inkSoft }}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   ONBOARDING
   ------------------------------------------------------------------------- */
function Onboarding({ onCreate }) {
  const [address, setAddress] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const canSubmit = address.trim().length > 2;

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="mb-8">
          <div style={{ color: COLOR.brass }} className="text-[13px] font-semibold tracking-wide mb-2">WELCOME TO HOMELEDGER</div>
          <h1 style={{ fontFamily: "Fraunces, serif" }} className="text-[28px] leading-tight font-semibold">Let's start your home's record.</h1>
          <p style={{ color: COLOR.inkSoft }} className="text-[14px] mt-2 leading-relaxed">Just the basics for now. You can add more detail any time — nothing here is final.</p>
        </div>
        <div className="space-y-4">
          <Field label="Address">
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street"
              style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none" />
          </Field>
          <Field label="Purchase date (optional)">
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
              style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none" />
          </Field>
          <Field label="Purchase price (optional)">
            <input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="425000" inputMode="numeric" style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none" />
          </Field>
        </div>
        <div className="mt-8">
          <BigButton disabled={!canSubmit} onClick={() => onCreate({ address, purchaseDate, purchasePrice })}>Create home record</BigButton>
        </div>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   DASHBOARD
   ------------------------------------------------------------------------- */
function LedgerRow({ label, value, sub, bold, noBorder, dark }) {
  return (
    <div style={{ borderBottom: noBorder ? "none" : `1px solid ${dark ? BLUE.line : COLOR.line}` }} className="flex items-center justify-between px-4 py-3">
      <span className="text-[14px]" style={{ color: dark ? BLUE.dim : COLOR.inkSoft }}>{label}</span>
      <div className="text-right">
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontWeight: bold ? 600 : 500, color: dark ? BLUE.bright : COLOR.ink }} className="text-[15px]">{value}</span>
        {sub && <div className="text-[11px]" style={{ color: dark ? BLUE.dim : COLOR.inkSoft }}>{sub}</div>}
      </div>
    </div>
  );
}
function ProjectRow({ project, onClick }) {
  const cls = finalClass(project);
  const tone = cls?.includes("Capital") ? "teal" : cls?.includes("Repair") ? "brass" : "ink";
  return (
    <button onClick={onClick} style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }}
      className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left">
      <div className="flex items-center gap-3 min-w-0">
        <div style={{ background: COLOR.paperDark, color: COLOR.tealDark }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0">
          <CategoryIcon />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-medium truncate">{project.title}</div>
          <div className="text-[12px]" style={{ color: COLOR.inkSoft }}>{project.category} · {yearOf(project.date)}</div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <div style={{ fontFamily: "IBM Plex Mono, monospace" }} className="text-[14px] font-semibold">{currency(project.cost)}</div>
        {cls && <Pill tone={tone}>{cls.replace("Likely ", "")}</Pill>}
      </div>
    </button>
  );
}
function Dashboard({ property, projects, onAdd, onOpenProject, onOpenReport }) {
  const total = projects.reduce((s, p) => s + (Number(p.cost) || 0), 0);
  const capitalTotal = projects.filter(isCapital).reduce((s, p) => s + (Number(p.cost) || 0), 0);
  const adjustedBasis = (Number(property.purchasePrice) || 0) + capitalTotal;
  const last = [...projects].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  return (
    <Screen>
      <div className="px-5 pt-8 pb-4">
        <div style={{ color: COLOR.brass }} className="text-[12px] font-semibold tracking-wide">HOME RECORD</div>
        <h1 style={{ fontFamily: "Fraunces, serif" }} className="text-[24px] font-semibold leading-tight mt-0.5">{property.address}</h1>
      </div>
      <TopRule />
      <div className="px-5 py-5">
        <div style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }} className="rounded-xl overflow-hidden">
          <LedgerRow label="Projects" value={String(projects.length)} />
          <LedgerRow label="Documented investment" value={currency(total)} bold />
          <LedgerRow label="Adjusted cost basis" value={currency(adjustedBasis)} bold
            sub={property.purchasePrice ? `${currency(property.purchasePrice)} purchase + ${currency(capitalTotal)} improvements` : null} noBorder />
        </div>
      </div>
      <div className="px-5 space-y-2.5">
        <BigButton icon={Plus} onClick={onAdd}>Add a project</BigButton>
        <BigButton icon={Ruler} variant="brass" onClick={onOpenReport}>View home report</BigButton>
      </div>
      <div className="px-5 mt-6 flex-1 overflow-auto pb-4">
        <div className="text-[12px] font-semibold tracking-wide mb-2" style={{ color: COLOR.inkSoft }}>RECENT PROJECTS</div>
        {projects.length === 0 && (
          <div style={{ color: COLOR.inkSoft }} className="text-[14px] py-6 text-center leading-relaxed">
            Nothing logged yet. Add your first project and we'll help you sort it out.
          </div>
        )}
        <div className="space-y-2.5">
          {[...projects].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6).map((p) => (
            <ProjectRow key={p.id} project={p} onClick={() => onOpenProject(p.id)} />
          ))}
        </div>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   ADD PROJECT
   ------------------------------------------------------------------------- */
function AddProject({ onCancel, onNext }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [documents, setDocuments] = useState([]);
  const fileRef = useRef(null);

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const docs = files.map((f) => ({
      id: crypto.randomUUID(), name: f.name,
      type: f.type.includes("pdf") ? "PDF" : f.type.startsWith("image") ? "Photo" : "File",
      previewUrl: f.type.startsWith("image") ? URL.createObjectURL(f) : null,
      file: f,
    }));
    setDocuments((d) => [...d, ...docs]);
  }
  const canContinue = title.trim().length > 1 && cost !== "";

  return (
    <Screen>
      <Header title="New project" onBack={onCancel} />
      <div className="flex-1 overflow-auto px-5 py-5 space-y-4">
        <p style={{ color: COLOR.inkSoft }} className="text-[13px] leading-relaxed -mt-1">
          Add what you have — a title and cost is enough to start. Documentation available is always optional.
        </p>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kitchen cabinets"
            style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="flex gap-3">
          <Field label="Date" className="flex-1">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none" />
          </Field>
          <Field label="Cost" className="flex-1">
            <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="8200"
              style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[15px] outline-none" />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything worth remembering about this project" rows={3}
            style={inputStyle} className="w-full px-3.5 py-3 rounded-lg text-[14px] outline-none resize-none" />
        </Field>
        <Field label="Documentation (optional)">
          <button onClick={() => fileRef.current?.click()} style={{ border: `1.5px dashed ${COLOR.line}`, color: COLOR.inkSoft }}
            className="w-full py-4 rounded-lg flex items-center justify-center gap-2 text-[13px]">
            <Paperclip size={16} /> Add a receipt, invoice, or photo
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} accept="image/*,.pdf" />
          {documents.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {documents.map((d) => (
                <div key={d.id} style={{ background: COLOR.card, border: `1px solid ${COLOR.line}` }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px]">
                  {d.previewUrl ? <img src={d.previewUrl} alt="" className="w-4 h-4 rounded object-cover" /> : <FileText size={13} />}
                  <span className="max-w-[100px] truncate">{d.name}</span>
                </div>
              ))}
            </div>
          )}
        </Field>
      </div>
      <div className="px-5 pb-6 pt-3" style={{ borderTop: `1px solid ${COLOR.line}` }}>
        <BigButton disabled={!canContinue} onClick={() => onNext({ title, description, date, cost, category, documents })}>
          Continue to categorizing
        </BigButton>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   SWIPE CLASSIFICATION FLOW
   ------------------------------------------------------------------------- */
const QUESTIONS = [
  { key: "improved", text: "Was this beyond the home's original condition?", sub: "Think upgrade or addition vs. putting something back the way it was.",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_sure", label: "Not sure" }] },
  { key: "replaceOrAdd", text: "Did this replace something existing, or add something new?", sub: "",
    options: [{ value: "replace", label: "Replaced existing" }, { value: "add", label: "Added new" }] },
  { key: "largerReno", text: "Was this part of a larger renovation?", sub: "",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No, standalone" }] },
];

function ClassifyFlow({ draft, onCancel, onDone }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  function choose(value) {
    const key = QUESTIONS[step].key;
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else setResult(classifyProject(draft, next));
  }

  if (result) {
    return (
      <ResultCard draft={draft} result={result}
        onConfirm={(finalLabel) => onDone({ answers, aiClassification: result, userClassification: finalLabel })}
        onRedo={() => { setStep(0); setAnswers({}); setResult(null); }} />
    );
  }
  const q = QUESTIONS[step];
  return (
    <Screen>
      <Header title="Let's categorize this" onBack={onCancel} />
      <div className="flex-1 flex flex-col justify-between px-5 py-6">
        <div>
          <div className="flex gap-1.5 mb-6">
            {QUESTIONS.map((_, i) => <div key={i} style={{ background: i <= step ? COLOR.teal : COLOR.line }} className="h-1 flex-1 rounded-full" />)}
          </div>
          <div style={{
              background: COLOR.card, border: `1.5px solid ${COLOR.line}`, borderTop: "none",
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 7px, ${COLOR.paperDark} 7px, ${COLOR.paperDark} 9px)`,
              backgroundSize: "100% 6px", backgroundRepeat: "no-repeat", backgroundPosition: "top",
            }} className="rounded-2xl p-6 pt-8 shadow-sm relative">
            <div style={{ color: COLOR.brass }} className="text-[11px] font-semibold tracking-wide mb-3">
              QUESTION {step + 1} OF {QUESTIONS.length} · {draft.title.toUpperCase()}
            </div>
            <div style={{ fontFamily: "Fraunces, serif" }} className="text-[20px] font-semibold leading-snug">{q.text}</div>
            {q.sub && <div style={{ color: COLOR.inkSoft }} className="text-[13px] mt-2">{q.sub}</div>}
          </div>
        </div>
        <div className="space-y-2.5">
          {q.options.map((opt) => (
            <button key={opt.value} onClick={() => choose(opt.value)} style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }}
              className="w-full py-3.5 rounded-xl text-[15px] font-medium active:scale-[0.98] transition-transform">
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
function ResultCard({ draft, result, onConfirm, onRedo }) {
  const [override, setOverride] = useState(null);
  const finalLabel = override || result.label;
  return (
    <Screen>
      <Header title="AI assessment" onBack={onRedo} />
      <div className="flex-1 flex flex-col justify-between px-5 py-6">
        <div>
          <div style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }} className="rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div style={{ background: COLOR.paperDark, color: COLOR.tealDark }} className="w-9 h-9 rounded-full flex items-center justify-center"><ShieldCheck size={18} /></div>
              <div style={{ color: COLOR.inkSoft }} className="text-[12px]">AI classification estimate</div>
            </div>
            <div style={{ fontFamily: "Fraunces, serif" }} className="text-[21px] font-semibold leading-snug">{finalLabel}</div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full" style={{ background: COLOR.line }}>
                <div className="h-full rounded-full" style={{ background: COLOR.teal, width: `${result.confidence}%` }} />
              </div>
              <span style={{ fontFamily: "IBM Plex Mono, monospace" }} className="text-[13px]">{result.confidence}%</span>
            </div>
            <p style={{ color: COLOR.inkSoft }} className="text-[13.5px] leading-relaxed mt-4">{result.reason}</p>
            <div style={{ background: COLOR.paperDark }} className="rounded-lg p-3 mt-4 flex gap-2 items-start">
              <HelpCircle size={15} style={{ color: COLOR.inkSoft, marginTop: 1 }} />
              <p style={{ color: COLOR.inkSoft }} className="text-[12px] leading-relaxed">
                This is a suggestion, not a final answer — you know this project best. HomeLedger isn't a tax authority or inspector.
              </p>
            </div>
          </div>
          {override !== null && (
            <div className="mt-4">
              <div className="text-[12px] font-medium mb-2" style={{ color: COLOR.inkSoft }}>Change classification to:</div>
              <div className="flex flex-wrap gap-2">
                {["Likely Capital Improvement", "Likely Repair / Maintenance", "Unclear — worth a closer look"].map((l) => (
                  <button key={l} onClick={() => setOverride(l)}
                    style={{ background: l === override ? COLOR.teal : COLOR.card, color: l === override ? "#fff" : COLOR.ink, border: `1.5px solid ${l === override ? COLOR.teal : COLOR.line}` }}
                    className="px-3 py-2 rounded-lg text-[12.5px] font-medium">
                    {l.replace("Likely ", "")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2.5">
          <BigButton icon={Check} onClick={() => onConfirm(finalLabel)}>{override ? "Save with my classification" : "Confirm classification"}</BigButton>
          {override === null
            ? <BigButton variant="ghost" onClick={() => setOverride(result.label)}>Change classification</BigButton>
            : <BigButton variant="ghost" icon={RotateCcw} onClick={() => setOverride(null)}>Use AI suggestion instead</BigButton>}
        </div>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   PROJECT DETAIL
   ------------------------------------------------------------------------- */
function ProjectDetail({ project, onBack }) {
  const cls = finalClass(project);
  const tone = cls?.includes("Capital") ? "teal" : cls?.includes("Repair") ? "brass" : "ink";
  return (
    <Screen>
      <Header title={project.category} onBack={onBack} />
      <div className="flex-1 overflow-auto px-5 py-6">
        <h1 style={{ fontFamily: "Fraunces, serif" }} className="text-[22px] font-semibold leading-tight">{project.title}</h1>
        <div style={{ color: COLOR.inkSoft }} className="text-[13px] mt-1">
          {new Date(project.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
        <div className="flex items-center gap-2 mt-3">
          {cls && <Pill tone={tone}>{cls.replace("Likely ", "")}</Pill>}
          {project.aiClassification && <span style={{ color: COLOR.inkSoft }} className="text-[11px]">AI confidence {project.aiClassification.confidence}%</span>}
        </div>
        <div style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }} className="rounded-xl mt-5 overflow-hidden">
          <LedgerRow label="Cost" value={currency(project.cost)} bold />
          <LedgerRow label="Category" value={project.category} noBorder />
        </div>
        {project.description && (
          <div className="mt-5">
            <div className="text-[12px] font-semibold tracking-wide" style={{ color: COLOR.inkSoft }}>NOTES</div>
            <p className="text-[14px] leading-relaxed mt-1.5">{project.description}</p>
          </div>
        )}
        {project.aiClassification?.reason && (
          <div className="mt-5">
            <div className="text-[12px] font-semibold tracking-wide" style={{ color: COLOR.inkSoft }}>AI REASONING</div>
            <p className="text-[13.5px] leading-relaxed mt-1.5" style={{ color: COLOR.inkSoft }}>{project.aiClassification.reason}</p>
          </div>
        )}
        <div className="mt-5">
          <div className="text-[12px] font-semibold tracking-wide" style={{ color: COLOR.inkSoft }}>DOCUMENTS ({project.documents.length})</div>
          {project.documents.length === 0 ? (
            <p style={{ color: COLOR.inkSoft }} className="text-[13px] mt-1.5">No documentation added yet — that's okay, you can add it any time.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {project.documents.map((d) => (
                <div key={d.id} style={{ background: COLOR.card, border: `1px solid ${COLOR.line}` }} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px]">
                  {d.previewUrl ? <img src={d.previewUrl} alt="" className="w-5 h-5 rounded object-cover" /> : <FileText size={14} />}
                  <span className="max-w-[120px] truncate">{d.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   TIMELINE
   ------------------------------------------------------------------------- */
function Timeline({ projects, onOpenProject }) {
  const byYear = {};
  projects.forEach((p) => { const y = yearOf(p.date); byYear[y] = byYear[y] || []; byYear[y].push(p); });
  const years = Object.keys(byYear).sort((a, b) => b - a);
  return (
    <Screen>
      <div className="px-5 pt-8 pb-4">
        <div style={{ color: COLOR.brass }} className="text-[12px] font-semibold tracking-wide">TIMELINE</div>
        <h1 style={{ fontFamily: "Fraunces, serif" }} className="text-[22px] font-semibold">Your home's history</h1>
      </div>
      <TopRule />
      <div className="flex-1 overflow-auto px-5 py-5">
        {years.length === 0 && <p style={{ color: COLOR.inkSoft }} className="text-[14px] text-center py-10">Once you log a project, it'll show up here.</p>}
        {years.map((y) => (
          <div key={y} className="mb-6">
            <div style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }} className="text-[15px] font-semibold mb-2.5">{y}</div>
            <div className="space-y-2.5 pl-3" style={{ borderLeft: `2px solid ${COLOR.line}` }}>
              {byYear[y].sort((a, b) => new Date(b.date) - new Date(a.date)).map((p) => (
                <ProjectRow key={p.id} project={p} onClick={() => onOpenProject(p.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   SETTINGS
   ------------------------------------------------------------------------- */
function SettingsScreen({ property, onReset, onExport, exportState }) {
  return (
    <Screen>
      <div className="px-5 pt-8 pb-4">
        <div style={{ color: COLOR.brass }} className="text-[12px] font-semibold tracking-wide">SETTINGS</div>
        <h1 style={{ fontFamily: "Fraunces, serif" }} className="text-[22px] font-semibold">Your home record</h1>
      </div>
      <TopRule />
      <div className="flex-1 overflow-auto px-5 py-5 space-y-5">
        <div style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }} className="rounded-xl overflow-hidden">
          <LedgerRow label="Address" value={property.address} />
          <LedgerRow label="Purchase date" value={property.purchaseDate || "—"} />
          <LedgerRow label="Purchase price" value={property.purchasePrice ? currency(property.purchasePrice) : "—"} noBorder />
        </div>

        <div style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }} className="rounded-xl p-4">
          <div className="text-[13px] font-semibold mb-1.5">Export & backup</div>
          <p style={{ color: COLOR.inkSoft }} className="text-[12.5px] leading-relaxed mb-3">
            Download every document, organized into the same category/project folders you see in the app, plus a
            spreadsheet-friendly ledger and a cost-basis summary — all in one .zip. Useful for a buyer handoff, an
            insurance claim, or just keeping a copy outside the app if you switch phones.
          </p>
          <BigButton icon={exportState === "working" ? Loader2 : Download} variant="brass" disabled={exportState === "working"} onClick={onExport}>
            {exportState === "working" ? "Preparing zip…" : "Export documents (.zip)"}
          </BigButton>
          {exportState === "error" && (
            <p style={{ color: COLOR.rust }} className="text-[12px] mt-2">
              Something went wrong building the export. Try again — if it keeps failing, it's worth a bug report.
            </p>
          )}
          {exportState === "done" && (
            <p style={{ color: COLOR.inkSoft }} className="text-[12px] mt-2">Downloaded. Check your browser's downloads.</p>
          )}
        </div>

        <div style={{ background: COLOR.card, border: `1.5px solid ${COLOR.line}` }} className="rounded-xl p-4">
          <div className="text-[13px] font-semibold mb-1.5">How classification works</div>
          <p style={{ color: COLOR.inkSoft }} className="text-[12.5px] leading-relaxed">
            HomeLedger currently uses a local, rule-based engine — no data leaves your device and no AI service is called.
            It weighs your answers, the project category, and cost to suggest a classification. You can always override it.
          </p>
        </div>
        <BigButton variant="ghost" onClick={onReset}>Reset all data</BigButton>
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   HOUSE VIEW — anatomy-style isometric house + per-level floorplan.
   Two visual themes (kept as a permanent toggle, not a decision we made
   for the user): a dark "anatomy" render and a light muted "sketch model."
   Feature checkboxes shape the drawing, but any feature implied by a
   logged project locks on — the record always wins over the picture.
   ------------------------------------------------------------------------- */
const HOUSE_THEMES = {
  anatomy: {
    name: "Dark", bg: "#14171C", card: "#1E232B", cardAlt: "#242A33",
    line: "rgba(255,255,255,0.09)", lineBright: "rgba(255,255,255,0.22)",
    bright: "#F2F4F7", dim: "rgba(242,244,247,0.56)", dimmer: "rgba(242,244,247,0.32)",
    amber: "#E3B15C", pinRing: "#F2F4F7",
    wallFront: "#242A33", wallSide: "#171B21", roofFront: "#242A33", roofSide: "#171B21",
    windowFill: "none", groundShadow: null,
    layerColors: { structural: "#A6B3BF", systems: "#5AA9E6", cosmetic: "#E8748B" },
  },
  sketch: {
    name: "Sketch", bg: "#EDEAE2", card: "#F7F5EF", cardAlt: "#EDE9DF",
    line: "rgba(43,38,30,0.10)", lineBright: "rgba(43,38,30,0.35)",
    bright: "#2B261E", dim: "rgba(43,38,30,0.6)", dimmer: "rgba(43,38,30,0.38)",
    amber: "#B8763E", pinRing: "#2B261E",
    wallFront: "#CBC0AC", wallSide: "#AFA284", roofFront: "#B98368", roofSide: "#9C6E57",
    windowFill: "#D9E2E1", groundShadow: "rgba(43,38,30,0.14)",
    layerColors: { structural: "#5B6672", systems: "#2E77A6", cosmetic: "#B14A62" },
  },
};

const HOUSE_LAYERS = [
  { key: "structural", label: "Structural" },
  { key: "systems", label: "Systems" },
  { key: "cosmetic", label: "Cosmetic" },
];
const LAYER_OF_CATEGORY = {
  Roof: "structural", Windows: "structural", Doors: "structural", Deck: "structural", Patio: "structural", Driveway: "structural",
  HVAC: "systems", Electrical: "systems", Plumbing: "systems",
  Kitchen: "cosmetic", Bathroom: "cosmetic", Flooring: "cosmetic", Landscaping: "cosmetic", Other: "cosmetic",
};
const LEVEL_OF_CATEGORY = {
  Roof: "attic", HVAC: "basement", Plumbing: "basement", Electrical: "basement",
  Kitchen: "1st", Bathroom: "2nd", Flooring: "1st", Windows: "2nd", Doors: "1st",
  Landscaping: "exterior", Deck: "1st", Patio: "1st", Driveway: "exterior", Other: "1st",
};
const HOUSE_LEVELS = ["attic", "2nd", "1st", "basement", "exterior"];
const HOUSE_LEVEL_LABEL = { attic: "Attic", "2nd": "2nd Floor", "1st": "1st Floor", basement: "Basement", exterior: "Exterior" };

const FEATURE_GROUPS = [
  { title: "Levels", keys: ["basement", "secondFloor", "attic"] },
  { title: "Exterior", keys: ["frontYard", "backYard", "driveway", "deck"] },
];
const FEATURE_LABEL = {
  basement: "Basement (below grade)", secondFloor: "2nd Floor", attic: "Attic",
  frontYard: "Front Yard", backYard: "Back Yard", driveway: "Driveway", deck: "Deck",
};
const DEFAULT_MANUAL_FEATURES = {
  basement: true, secondFloor: true, attic: true,
  frontYard: true, backYard: true, driveway: true, deck: false,
};
function computeImpliedFeatures(projects) {
  const implied = {};
  projects.forEach((p) => {
    const level = LEVEL_OF_CATEGORY[p.category];
    if (level === "basement") implied.basement = true;
    if (level === "2nd") implied.secondFloor = true;
    if (level === "attic") implied.attic = true;
    if (p.category === "Deck") implied.deck = true;
    if (p.category === "Driveway") implied.driveway = true;
    if (p.category === "Landscaping") implied.backYard = true;
  });
  return implied;
}

// Fixed hotspot positions per category. `requires` names the feature that
// must be on for the point to render at all.
const CATEGORY_HOTSPOTS = {
  structural: [
    { category: "Roof", x: 180, dynamicY: "roof", requires: null },
    { category: "Windows", x: 138, y: 208, requires: "secondFloor" },
    { category: "Doors", x: 205, y: 296, requires: null },
    { category: "Deck", x: 322, y: 265, requires: "deck" },
    { category: "Patio", x: 300, y: 285, requires: "backYard" },
    { category: "Driveway", x: 55, y: 288, requires: "driveway" },
  ],
  systems: [
    { category: "Electrical", x: 120, y: 320, requires: "basement" },
    { category: "HVAC", x: 300, y: 320, requires: "basement" },
    { category: "Plumbing", x: 232, y: 328, requires: "basement" },
  ],
  cosmetic: [
    { category: "Kitchen", x: 138, y: 268, requires: null },
    { category: "Bathroom", x: 222, y: 206, requires: "secondFloor" },
    { category: "Flooring", x: 190, y: 290, requires: null },
    { category: "Landscaping", x: 342, y: 268, requires: "backYard" },
    { category: "Other", x: 225, y: 268, requires: null },
  ],
};

const HFX0 = 100, HFX1 = 260, HDX = 78, HDY = -38, HGROUND_Y = 300, HFLOOR_H = 60, HBASEMENT_H = 40, HKNEE_H = 20;
function hFaceFront(y0, y1) { return `${HFX0},${y0} ${HFX1},${y0} ${HFX1},${y1} ${HFX0},${y1}`; }
function hFaceSide(y0, y1) { return `${HFX1},${y0} ${HFX1 + HDX},${y0 + HDY} ${HFX1 + HDX},${y1 + HDY} ${HFX1},${y1}`; }
function buildHouseGeometry(f) {
  const secondY0 = HGROUND_Y - HFLOOR_H - HFLOOR_H, secondY1 = HGROUND_Y - HFLOOR_H;
  const roofBaseTop = f.secondFloor ? secondY0 : secondY1;
  const kneeY0 = f.attic ? roofBaseTop - HKNEE_H : roofBaseTop;
  const apexY = f.attic ? kneeY0 - 50 : roofBaseTop - 28;
  return {
    basement: f.basement ? { y0: HGROUND_Y, y1: HGROUND_Y + HBASEMENT_H } : null,
    first: { y0: HGROUND_Y - HFLOOR_H, y1: HGROUND_Y },
    second: f.secondFloor ? { y0: secondY0, y1: secondY1 } : null,
    knee: f.attic ? { y0: kneeY0, y1: roofBaseTop } : null,
    roofBaseTop, apexY, roofHotspotY: (apexY + kneeY0) / 2,
  };
}

function IsoHouse({ theme, layer, features, projects, onHotspot, onBand }) {
  const t = HOUSE_THEMES[theme];
  const g = buildHouseGeometry(features);
  const layerColor = t.layerColors[layer];
  const hotspots = CATEGORY_HOTSPOTS[layer].filter((h) =>
    (!h.requires || features[h.requires]) && projects.some((p) => p.category === h.category));

  return (
    <div style={{ background: t.card, border: `1px solid ${t.line}` }} className="rounded-2xl overflow-hidden relative">
      <svg viewBox="0 0 420 360" className="w-full h-auto block">
        {t.groundShadow && <ellipse cx="200" cy={HGROUND_Y + 6} rx="150" ry="14" fill={t.groundShadow} />}
        <line x1="50" y1={HGROUND_Y} x2="290" y2={HGROUND_Y} stroke={t.dimmer} strokeWidth="1.5" strokeDasharray="2 4" />

        {features.driveway && <polygon points="20,300 55,300 68,262 38,262" fill={t.wallSide} stroke={t.lineBright} strokeWidth="1" opacity="0.8" />}
        {features.frontYard && (
          <g stroke={t.lineBright} strokeWidth="1.3" fill={t.roofFront} opacity="0.75">
            <line x1="35" y1="300" x2="35" y2="278" /><circle cx="35" cy="270" r="11" />
          </g>
        )}
        {features.backYard && (
          <g stroke={t.lineBright} strokeWidth="1.3" fill={t.roofFront} opacity="0.75">
            <circle cx="345" cy="252" r="9" /><circle cx="360" cy="255" r="6" />
          </g>
        )}
        {features.deck && (
          <polygon stroke={t.lineBright} strokeWidth="1.3" fill={t.wallSide} opacity="0.7"
            points={`${HFX1 + HDX},${g.first.y1 + HDY - 6} ${HFX1 + HDX + 52},${g.first.y1 + HDY - 30} ${HFX1 + HDX + 52},${g.first.y1 + HDY - 6} ${HFX1 + HDX},${g.first.y1 + HDY + 18}`} />
        )}

        {g.basement && (
          <>
            <polygon points={hFaceFront(g.basement.y0, g.basement.y1)} fill={t.wallFront} stroke={t.lineBright} strokeWidth="1" />
            <polygon points={hFaceSide(g.basement.y0, g.basement.y1)} fill={t.wallSide} stroke={t.lineBright} strokeWidth="1" />
          </>
        )}
        <polygon points={hFaceFront(g.first.y0, g.first.y1)} fill={t.wallFront} stroke={t.lineBright} strokeWidth="1" />
        <polygon points={hFaceSide(g.first.y0, g.first.y1)} fill={t.wallSide} stroke={t.lineBright} strokeWidth="1" />
        {g.second && (
          <>
            <polygon points={hFaceFront(g.second.y0, g.second.y1)} fill={t.wallFront} stroke={t.lineBright} strokeWidth="1" />
            <polygon points={hFaceSide(g.second.y0, g.second.y1)} fill={t.wallSide} stroke={t.lineBright} strokeWidth="1" />
          </>
        )}
        {g.knee && (
          <>
            <polygon points={hFaceFront(g.knee.y0, g.knee.y1)} fill={t.wallFront} stroke={t.lineBright} strokeWidth="1" opacity="0.85" />
            <polygon points={hFaceSide(g.knee.y0, g.knee.y1)} fill={t.wallSide} stroke={t.lineBright} strokeWidth="1" opacity="0.85" />
          </>
        )}

        <polygon points={`${HFX0 - 10},${g.knee ? g.knee.y0 : g.roofBaseTop} ${HFX1 + 10},${g.knee ? g.knee.y0 : g.roofBaseTop} 180,${g.apexY}`} fill={t.roofFront} stroke={t.lineBright} strokeWidth="1" />
        <polygon points={`${HFX1 + 10},${g.knee ? g.knee.y0 : g.roofBaseTop} ${HFX1 + 10 + HDX},${(g.knee ? g.knee.y0 : g.roofBaseTop) + HDY} ${180 + HDX},${g.apexY + HDY} 180,${g.apexY}`} fill={t.roofSide} stroke={t.lineBright} strokeWidth="1" />
        {features.attic && <rect x="228" y={g.apexY - 14} width="16" height="38" fill={t.wallFront} stroke={t.lineBright} strokeWidth="1" />}

        <g stroke={t.dim} strokeWidth="1" fill={t.windowFill}>
          <rect x="118" y="196" width="30" height="30" />
          <rect x="118" y="256" width="30" height="30" />
          {g.second && <rect x="212" y="196" width="30" height="30" />}
          <rect x="185" y="266" width="26" height="34" fill="none" />
        </g>

        {hotspots.map((h) => {
          const y = h.dynamicY === "roof" ? g.roofHotspotY : h.y;
          return (
            <g key={h.category} onClick={() => onHotspot(h.category)} className="cursor-pointer">
              <circle cx={h.x} cy={y} r="10" fill={layerColor} opacity="0.25" />
              <circle cx={h.x} cy={y} r="5.5" fill={layerColor} stroke={t.pinRing} strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>

      <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-[8%] pl-1.5">
        {["attic", "2nd", "1st", "basement"].map((lv) => {
          const present = lv === "1st" || (lv === "attic" ? features.attic : lv === "2nd" ? features.secondFloor : features.basement);
          if (!present) return <div key={lv} />;
          return (
            <button key={lv} onClick={() => onBand(lv)}
              style={{ color: t.dim, background: theme === "sketch" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)", border: `1px solid ${t.line}` }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-medium">
              {HOUSE_LEVEL_LABEL[lv]} <ChevronRight size={10} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOUSE_FLOORPLANS = {
  basement: { rooms: [
    { name: "Utility Room", x: 10, y: 10, w: 120, h: 90, categories: ["HVAC", "Electrical"] },
    { name: "Mechanical", x: 140, y: 10, w: 110, h: 90, categories: ["Plumbing"] },
    { name: "Storage", x: 10, y: 110, w: 240, h: 60, categories: [] },
  ]},
  "1st": { rooms: [
    { name: "Kitchen", x: 10, y: 10, w: 100, h: 90, categories: ["Kitchen"] },
    { name: "Living Room", x: 120, y: 10, w: 130, h: 90, categories: ["Flooring"] },
    { name: "Entry", x: 10, y: 110, w: 60, h: 60, categories: ["Doors"] },
    { name: "Dining", x: 80, y: 110, w: 90, h: 60, categories: ["Other"] },
    { name: "Deck / Patio", x: 180, y: 110, w: 70, h: 60, categories: ["Deck", "Patio"] },
  ]},
  "2nd": { rooms: [
    { name: "Primary Bedroom", x: 10, y: 10, w: 120, h: 90, categories: [] },
    { name: "Primary Bath", x: 140, y: 10, w: 110, h: 90, categories: ["Bathroom"] },
    { name: "Bedroom 2", x: 10, y: 110, w: 110, h: 60, categories: [] },
    { name: "Hall", x: 130, y: 110, w: 120, h: 60, categories: ["Windows"] },
  ]},
  attic: { rooms: [{ name: "Attic Storage", x: 10, y: 10, w: 240, h: 160, categories: ["Roof"] }] },
  exterior: { rooms: [
    { name: "Driveway", x: 10, y: 10, w: 110, h: 160, categories: ["Driveway"] },
    { name: "Yard", x: 130, y: 10, w: 120, h: 160, categories: ["Landscaping"] },
  ]},
};

function HouseFloorplan({ theme, level, projects, onRoom }) {
  const t = HOUSE_THEMES[theme];
  const plan = HOUSE_FLOORPLANS[level];
  return (
    <div style={{ background: t.card, border: `1px solid ${t.line}` }} className="rounded-2xl p-3">
      <svg viewBox="0 0 260 180" className="w-full h-auto block">
        {plan.rooms.map((r) => {
          const count = projects.filter((p) => r.categories.includes(p.category)).length;
          return (
            <g key={r.name} onClick={() => onRoom(r)} className="cursor-pointer">
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={count ? t.wallFront : t.cardAlt} stroke={t.lineBright} strokeWidth="1.2" />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (count ? 6 : 0)} fontSize="9.5" fill={t.bright} textAnchor="middle" fontFamily="Inter, sans-serif">{r.name}</text>
              {count > 0 && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 9} fontSize="8" fill={t.amber} textAnchor="middle" fontFamily="monospace">{count} project{count > 1 ? "s" : ""}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HouseFeaturesScreen({ theme, manual, implied, onToggle, onClose }) {
  const t = HOUSE_THEMES[theme];
  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: t.bg }}>
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <div style={{ color: t.amber }} className="text-[11px] font-semibold tracking-wide">CUSTOMIZE</div>
          <h1 style={{ color: t.bright, fontFamily: "Fraunces, serif" }} className="text-[19px] font-semibold mt-0.5">What does your house have?</h1>
        </div>
        <button onClick={onClose} style={{ color: t.dim }}><X size={20} /></button>
      </div>
      <p style={{ color: t.dim }} className="text-[12.5px] px-5 leading-relaxed">
        This just shapes the drawing so it feels a little more like your place — it'll never be exact, and that's on purpose.
        Anything you've already logged a project for is locked on, since the real record always wins.
      </p>
      <div className="flex-1 overflow-auto px-5 py-5 space-y-6">
        {FEATURE_GROUPS.map((group) => (
          <div key={group.title}>
            <div style={{ color: t.dim }} className="text-[11.5px] font-semibold tracking-wide mb-2">{group.title.toUpperCase()}</div>
            <div className="space-y-2">
              {group.keys.map((key) => {
                const locked = !!implied[key];
                const checked = locked || manual[key];
                return (
                  <button key={key} onClick={() => !locked && onToggle(key)}
                    style={{ background: t.card, border: `1.5px solid ${checked ? t.amber : t.line}` }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left">
                    <div>
                      <div style={{ color: t.bright }} className="text-[14px] font-medium">{FEATURE_LABEL[key]}</div>
                      {locked && <div style={{ color: t.amber }} className="text-[11px] mt-0.5 flex items-center gap-1"><Lock size={10} /> Locked on — a logged project needs it</div>}
                    </div>
                    <div style={{ background: checked ? t.amber : "transparent", border: `1.5px solid ${checked ? t.amber : t.lineBright}` }}
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                      {checked && <Check size={14} color={theme === "sketch" ? "#fff" : "#101317"} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HouseBottomSheet({ theme, title, projects, onClose }) {
  const t = HOUSE_THEMES[theme];
  const items = [...projects].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div className="absolute inset-0 flex items-end z-20" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.card, borderTop: `1px solid ${t.lineBright}` }}
        className="relative w-full rounded-t-2xl p-5 max-h-[70%] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div style={{ color: t.bright }} className="text-[15px] font-semibold">{title}</div>
          <button onClick={onClose} style={{ color: t.dim }}><X size={18} /></button>
        </div>
        {items.length === 0 ? (
          <p style={{ color: t.dim }} className="text-[13px] leading-relaxed">No projects logged here yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((p) => {
              const cls = finalClass(p);
              return (
                <div key={p.id} style={{ background: t.cardAlt, border: `1px solid ${t.line}` }} className="rounded-xl p-3.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div style={{ color: t.bright }} className="text-[13.5px] font-medium truncate">{p.title}</div>
                    <div style={{ color: t.dim }} className="text-[11.5px] mt-0.5">{p.category} · {shortDate(p.date)}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div style={{ color: t.bright, fontFamily: "monospace" }} className="text-[13px] font-semibold">{currency(p.cost)}</div>
                    <div style={{ color: t.layerColors[LAYER_OF_CATEGORY[p.category]] }} className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{cls?.replace("Likely ", "")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HouseView({ projects }) {
  const [theme, setTheme] = useState("anatomy");
  const [mode, setMode] = useState("iso");
  const [layer, setLayer] = useState("structural");
  const [level, setLevel] = useState("1st");
  const [sheet, setSheet] = useState(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [manualFeatures, setManualFeatures] = useState(DEFAULT_MANUAL_FEATURES);

  const t = HOUSE_THEMES[theme];
  const implied = computeImpliedFeatures(projects);
  const features = {};
  Object.keys(FEATURE_LABEL).forEach((k) => { features[k] = manualFeatures[k] || !!implied[k]; });

  const availableLevels = HOUSE_LEVELS.filter((lv) =>
    lv === "1st" || lv === "exterior" || (lv === "2nd" ? features.secondFloor : lv === "attic" ? features.attic : features.basement));

  return (
    <div className="space-y-2.5">
      {/* compact controls — kept small on purpose so the house stays the focus */}
      <div className="flex items-center gap-1.5">
        {Object.keys(HOUSE_THEMES).map((k) => (
          <button key={k} onClick={() => setTheme(k)}
            style={{ background: theme === k ? t.amber : "transparent", color: theme === k ? "#fff" : BLUE.dim, border: `1.5px solid ${theme === k ? t.amber : BLUE.line}` }}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold">
            {HOUSE_THEMES[k].name}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setMode("iso")}
          style={{ background: mode === "iso" ? BLUE.brass : "transparent", color: mode === "iso" ? BLUE.bgDeep : BLUE.dim, border: `1.5px solid ${mode === "iso" ? BLUE.brass : BLUE.line}` }}
          className="px-2 py-1 rounded-full"><Layers size={13} /></button>
        <button onClick={() => setMode("floorplan")}
          style={{ background: mode === "floorplan" ? BLUE.brass : "transparent", color: mode === "floorplan" ? BLUE.bgDeep : BLUE.dim, border: `1.5px solid ${mode === "floorplan" ? BLUE.brass : BLUE.line}` }}
          className="px-2 py-1 rounded-full"><Home size={13} /></button>
        <button onClick={() => setShowFeatures(true)}
          style={{ background: "transparent", color: BLUE.dim, border: `1.5px solid ${BLUE.line}` }}
          className="px-2 py-1 rounded-full"><Settings2 size={13} /></button>
      </div>

      {mode === "iso" ? (
        <>
          <div className="flex gap-1.5">
            {HOUSE_LAYERS.map((l) => (
              <button key={l.key} onClick={() => setLayer(l.key)}
                style={{ background: layer === l.key ? t.layerColors[l.key] : "transparent", color: layer === l.key ? "#fff" : BLUE.dim, border: `1.5px solid ${layer === l.key ? t.layerColors[l.key] : BLUE.line}` }}
                className="flex-1 py-1 rounded-full text-[10.5px] font-semibold">
                {l.label}
              </button>
            ))}
          </div>
          <IsoHouse theme={theme} layer={layer} features={features} projects={projects}
            onHotspot={(cat) => setSheet({ title: cat, projects: projects.filter((p) => p.category === cat) })}
            onBand={(lv) => { setLevel(lv); setMode("floorplan"); }} />
        </>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {availableLevels.map((lv) => (
              <button key={lv} onClick={() => setLevel(lv)}
                style={{ background: level === lv ? BLUE.brass : "transparent", color: level === lv ? BLUE.bgDeep : BLUE.dim, border: `1.5px solid ${level === lv ? BLUE.brass : BLUE.line}` }}
                className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap shrink-0">
                {HOUSE_LEVEL_LABEL[lv]}
              </button>
            ))}
          </div>
          <HouseFloorplan theme={theme} level={level} projects={projects}
            onRoom={(r) => setSheet({ title: r.name, projects: projects.filter((p) => r.categories.includes(p.category)) })} />
        </>
      )}

      {sheet && <HouseBottomSheet theme={theme} title={sheet.title} projects={sheet.projects} onClose={() => setSheet(null)} />}
      {showFeatures && (
        <HouseFeaturesScreen theme={theme} manual={manualFeatures} implied={implied}
          onToggle={(key) => setManualFeatures((f) => ({ ...f, [key]: !f[key] }))}
          onClose={() => setShowFeatures(false)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   HOME REPORT
   ------------------------------------------------------------------------- */
function ReportOverview({ property, projects, onExport, exportState }) {
  const capitalProjects = projects.filter(isCapital).sort((a, b) => new Date(a.date) - new Date(b.date));
  const capitalTotal = capitalProjects.reduce((s, p) => s + (Number(p.cost) || 0), 0);
  const investmentTotal = projects.reduce((s, p) => s + (Number(p.cost) || 0), 0);
  const purchasePrice = Number(property.purchasePrice) || 0;
  const adjustedBasis = purchasePrice + capitalTotal;

  const chartData = [{ label: yearOf(property.purchaseDate) || "Purchase", value: purchasePrice }];
  let running = purchasePrice;
  capitalProjects.forEach((p) => { running += Number(p.cost) || 0; chartData.push({ label: shortDate(p.date), value: running }); });
  chartData.push({ label: "Today", value: running });

  const systemKeys = ["Roof", "HVAC", "Electrical", "Windows", "Plumbing", "Kitchen"];
  const snapshot = systemKeys.map((cat) => {
    const items = projects.filter((p) => p.category === cat).sort((a, b) => new Date(b.date) - new Date(a.date));
    return items[0] ? { cat, last: items[0], age: yearsAgo(items[0].date) } : null;
  }).filter(Boolean);

  return (
    <div className="space-y-5">
      <div>
        <div style={{ color: BLUE.brass }} className="text-[11.5px] font-semibold tracking-wide mb-2">ADJUSTED COST BASIS</div>
        <div style={{ background: BLUE.card, border: `1px solid ${BLUE.line}` }} className="rounded-xl overflow-hidden">
          <LedgerRow dark label="Original purchase price" value={currency(purchasePrice)} />
          <LedgerRow dark label="+ Capital improvements" value={currency(capitalTotal)} sub={`${capitalProjects.length} projects`} />
          <LedgerRow dark label="= Adjusted cost basis" value={currency(adjustedBasis)} bold noBorder />
        </div>
        <p style={{ color: BLUE.dim }} className="text-[11.5px] leading-relaxed mt-2">
          Estimate only — repairs and routine maintenance aren't included. A tax professional can confirm what qualifies for your situation.
        </p>
      </div>

      <div>
        <div style={{ color: BLUE.brass }} className="text-[11.5px] font-semibold tracking-wide mb-2">BASIS OVER TIME</div>
        <div style={{ background: BLUE.card, border: `1px solid ${BLUE.line}` }} className="rounded-xl p-3">
          <div className="h-[120px]">
            <MiniBasisChart data={chartData} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span style={{ color: BLUE.dim }} className="text-[10.5px]">{chartData[0].label} · {currency(chartData[0].value)}</span>
            <span style={{ color: BLUE.brass, fontFamily: "IBM Plex Mono, monospace" }} className="text-[11.5px] font-semibold">
              {currency(chartData[chartData.length - 1].value)}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ color: BLUE.brass }} className="text-[11.5px] font-semibold tracking-wide mb-2">FOR THE NEXT OWNER</div>
        <div style={{ background: BLUE.card, border: `1px solid ${BLUE.line}` }} className="rounded-xl overflow-hidden">
          <LedgerRow dark label="Total documented investment" value={currency(investmentTotal)} sub={`${projects.length} projects on record`} noBorder />
        </div>
        <div className="mt-2.5 space-y-2">
          {snapshot.map((s) => (
            <div key={s.cat} style={{ background: BLUE.card, border: `1px solid ${BLUE.line}` }} className="flex items-center justify-between px-3.5 py-2.5 rounded-lg">
              <span style={{ color: BLUE.bright }} className="text-[13px] font-medium">{s.cat}</span>
              <span style={{ color: BLUE.dim }} className="text-[12px]">{s.last.title} · {s.age === 0 ? "this year" : `${s.age} yr${s.age === 1 ? "" : "s"} ago`}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button onClick={onExport} disabled={exportState === "working"}
          style={{ background: BLUE.brass, color: BLUE.bgDeep, opacity: exportState === "working" ? 0.6 : 1 }}
          className="w-full py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2">
          {exportState === "working" ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {exportState === "working" ? "Preparing handoff packet…" : "Export handoff packet (.zip)"}
        </button>
        {exportState === "done" && <p style={{ color: BLUE.dim }} className="text-[11.5px] text-center mt-2">Downloaded — documents, ledger, and this summary, all in one file.</p>}
        {exportState === "error" && <p style={{ color: BLUE.brass }} className="text-[11.5px] text-center mt-2">Export failed — try again.</p>}
      </div>
    </div>
  );
}

function HomeReport({ property, projects, onBack, onExport, exportState }) {
  const [tab, setTab] = useState("overview");

  return (
    <Screen bg={BLUE.bg} color={BLUE.bright}>
      <Header title="Home report" onBack={onBack} dark />
      <div className="px-5 pt-4">
        <div style={{ color: BLUE.brass }} className="text-[11.5px] font-semibold tracking-wide">{property.address.toUpperCase()}</div>
        <h1 style={{ fontFamily: "Fraunces, serif" }} className="text-[20px] font-semibold mt-0.5">A generous handoff for the next owner</h1>
      </div>

      <div className="px-5 mt-4 flex gap-2">
        {[{ key: "overview", label: "Overview" }, { key: "house", label: "House" }].map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            style={{
              background: tab === tb.key ? BLUE.brass : "transparent",
              color: tab === tb.key ? BLUE.bgDeep : BLUE.dim,
              border: `1.5px solid ${tab === tb.key ? BLUE.brass : BLUE.line}`,
            }} className="flex-1 py-2 rounded-full text-[12.5px] font-semibold">
            {tb.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        {tab === "overview"
          ? <ReportOverview property={property} projects={projects} onExport={onExport} exportState={exportState} />
          : <HouseView projects={projects} />}
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------
   BOTTOM NAV
   ------------------------------------------------------------------------- */
function BottomNav({ screen, setScreen }) {
  const items = [
    { key: "dashboard", label: "Home", icon: Home },
    { key: "add", label: "Add", icon: Plus },
    { key: "report", label: "Report", icon: ClipboardList },
    { key: "timeline", label: "Timeline", icon: Clock },
    { key: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <div style={{ background: COLOR.card, borderTop: `1px solid ${COLOR.line}` }} className="flex items-stretch">
      {items.map((it) => {
        const active = screen === it.key;
        return (
          <button key={it.key} onClick={() => setScreen(it.key)} className="flex-1 flex flex-col items-center gap-1 py-2.5"
            style={{ color: active ? COLOR.teal : COLOR.inkSoft }}>
            <it.icon size={19} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px] font-medium">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   ROOT APP
   ------------------------------------------------------------------------- */
export default function App() {
  // Seeded with a populated sample home so multi-project behavior (cost
  // basis, report tabs) is visible immediately. Use Settings > Reset to
  // start from a blank onboarding flow instead.
  const [property, setProperty] = useState(SAMPLE_PROPERTY);
  const [projects, setProjects] = useState(SAMPLE_PROJECTS);
  const [screen, setScreen] = useState("dashboard");
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [exportState, setExportState] = useState("idle"); // idle | working | done | error

  async function handleExport() {
    setExportState("working");
    try {
      const zip = await buildExportZip(property, projects);
      downloadBlob(zip, `HomeLedger-${slugify(property.address)}-export.zip`);
      setExportState("done");
      setTimeout(() => setExportState("idle"), 4000);
    } catch (err) {
      console.error("Export failed:", err);
      setExportState("error");
      setTimeout(() => setExportState("idle"), 4000);
    }
  }

  if (!property) {
    return (
      <div style={{ width: "100%", maxWidth: 390, height: "100dvh", maxHeight: 780, margin: "0 auto", overflow: "hidden" }} className="rounded-[2rem] shadow-2xl">
        <style>{`@import url('${FONT_IMPORT_URL}');`}</style>
        <Onboarding onCreate={(p) => setProperty(p)} />
      </div>
    );
  }

  let body;
  if (screen === "dashboard") {
    body = <Dashboard property={property} projects={projects}
      onAdd={() => setScreen("add")}
      onOpenProject={(id) => { setSelectedId(id); setScreen("detail"); }}
      onOpenReport={() => setScreen("report")} />;
  } else if (screen === "add") {
    body = <AddProject onCancel={() => setScreen("dashboard")} onNext={(d) => { setDraft(d); setScreen("classify"); }} />;
  } else if (screen === "classify") {
    body = <ClassifyFlow draft={draft} onCancel={() => setScreen("add")}
      onDone={({ aiClassification, userClassification }) => {
        const newProject = { id: crypto.randomUUID(), ...draft, aiClassification,
          userClassification: userClassification !== aiClassification.label ? userClassification : null };
        setProjects((ps) => [newProject, ...ps]);
        setDraft(null);
        setScreen("dashboard");
      }} />;
  } else if (screen === "detail") {
    const p = projects.find((x) => x.id === selectedId);
    body = <ProjectDetail project={p} onBack={() => setScreen("dashboard")} />;
  } else if (screen === "report") {
    body = <HomeReport property={property} projects={projects} onBack={() => setScreen("dashboard")} onExport={handleExport} exportState={exportState} />;
  } else if (screen === "timeline") {
    body = <Timeline projects={projects} onOpenProject={(id) => { setSelectedId(id); setScreen("detail"); }} />;
  } else if (screen === "settings") {
    body = <SettingsScreen property={property} onReset={() => { setProperty(null); setProjects([]); setScreen("dashboard"); }}
      onExport={handleExport} exportState={exportState} />;
  }

  const showNav = ["dashboard", "timeline", "settings", "report"].includes(screen);

  return (
    <div style={{ width: "100%", maxWidth: 390, height: "100dvh", maxHeight: 780, margin: "0 auto", overflow: "hidden", display: "flex", flexDirection: "column" }} className="rounded-[2rem] shadow-2xl">
      <style>{`@import url('${FONT_IMPORT_URL}');`}</style>
      <div className="flex-1 overflow-hidden">{body}</div>
      {showNav && <BottomNav screen={screen} setScreen={setScreen} />}
    </div>
  );
}
