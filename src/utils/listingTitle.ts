// বিক্রেতার লেখা বিবরণ থেকে কার্ডের জন্য পরিষ্কার শিরোনাম বানায়, যেমন
// "Toyota Axio 2008" বা "Yamaha Fazer"। বিক্রেতাকে কোনো বাড়তি ঘর পূরণ করতে হয় না --
// ব্র্যান্ড/মডেল/সাল বিবরণ থেকেই খুঁজে নেওয়া হয়। কিছু না পেলে শুরুর
// "সালাম / বিক্রি হবে / জরুরি" ধরনের অংশ বাদ দিয়ে বিবরণের প্রথম অর্থবহ কথা নেওয়া হয়।

const nfc = (s: string): string => s.normalize("NFC");
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toEn = (s: string): string => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

type Entry = { name: string; aliases: string[]; model?: boolean };
const B = (name: string, aliases: string[]): Entry => ({ name, aliases });
const M = (name: string, aliases: string[]): Entry => ({ name, aliases, model: true });

const ENTRIES: Entry[] = [
  // ব্র্যান্ড -- নামের পরের ১-২টা শব্দ (মডেল) শিরোনামে যোগ হয়
  B("Toyota", ["toyota", "টয়োটা", "টয়েটা", "টয়ওটা"]),
  B("Honda", ["honda", "হোন্ডা", "হন্ডা"]),
  B("Nissan", ["nissan", "নিসান"]),
  B("Mitsubishi", ["mitsubishi", "মিতসুবিশি", "মিৎসুবিশি"]),
  B("Suzuki", ["suzuki", "সুজুকি"]),
  B("Mazda", ["mazda", "মাজদা"]),
  B("Subaru", ["subaru", "সুবারু"]),
  B("Daihatsu", ["daihatsu", "ডাইহাটসু"]),
  B("Hyundai", ["hyundai", "হুন্ডাই"]),
  B("Kia", ["kia", "কিয়া"]),
  B("Lexus", ["lexus", "লেক্সাস"]),
  B("BMW", ["bmw", "বিএমডব্লিউ"]),
  B("Mercedes", ["mercedes", "মার্সিডিজ"]),
  B("Volvo", ["volvo", "ভলভো"]),
  B("Tata", ["tata", "টাটা"]),
  B("Ashok Leyland", ["ashok leyland", "অশোক লেল্যান্ড"]),
  B("Mahindra", ["mahindra", "মাহিন্দ্রা"]),
  B("Isuzu", ["isuzu", "ইসুজু"]),
  B("Hino", ["hino", "হিনো"]),
  B("Yamaha", ["yamaha", "ইয়ামাহা"]),
  B("Bajaj", ["bajaj", "বাজাজ"]),
  B("TVS", ["tvs", "টিভিএস"]),
  B("Hero", ["hero", "হিরো"]),
  B("Runner", ["runner", "রানার"]),
  B("Lifan", ["lifan", "লিফান"]),
  B("KTM", ["ktm"]),
  B("Royal Enfield", ["royal enfield"]),
  B("Komatsu", ["komatsu", "কোমাৎসু", "কোমাতসু"]),
  B("Caterpillar", ["caterpillar", "ক্যাটারপিলার"]),
  B("JCB", ["jcb", "জেসিবি"]),
  B("Hitachi", ["hitachi", "হিটাচি"]),
  B("Kobelco", ["kobelco", "কোবেলকো"]),
  // শুধু মডেলের নাম লেখা থাকলে পুরো নামটা বসানো হয়
  M("Toyota Axio", ["axio", "অ্যাক্সিও", "এক্সিও"]),
  M("Toyota Premio", ["premio", "প্রিমিও"]),
  M("Toyota Allion", ["allion", "এলিয়ন"]),
  M("Toyota Corolla", ["corolla", "করোলা"]),
  M("Toyota Noah", ["noah", "noha", "নোয়া", "নোহা"]),
  M("Toyota Voxy", ["voxy", "ভক্সি"]),
  M("Toyota Hiace", ["hiace", "হাইয়েস", "হাইস"]),
  M("Toyota Probox", ["probox", "প্রোবক্স"]),
  M("Toyota Prius", ["prius", "প্রিয়াস"]),
  M("Toyota Aqua", ["aqua", "একুয়া", "অ্যাকুয়া"]),
  M("Toyota Fielder", ["fielder", "ফিল্ডার"]),
  M("Toyota Vitz", ["vitz", "ভিটজ"]),
  M("Toyota Starlet", ["starlet", "স্টারলেট"]),
  M("Honda Civic", ["civic", "সিভিক"]),
  M("Honda Vezel", ["vezel", "ভেজেল"]),
  M("Honda Grace", ["honda grace"]),
  M("Bajaj Pulsar", ["pulsar", "পালসার"]),
  M("Bajaj Discover", ["discover", "ডিসকভার"]),
  M("Suzuki Gixxer", ["gixxer", "জিক্সার"]),
  M("Yamaha Fazer", ["fazer", "ফেজার"]),
  M("Yamaha R15", ["r15", "আর১৫"]),
  M("TVS Apache", ["apache", "অ্যাপাচি", "এপাচি"]),
  M("Honda CBR", ["cbr"]),
];

// ব্র্যান্ডের পরের যে শব্দে থামতে হবে (এগুলো মডেলের অংশ না)
const STOP = new Set<string>([
  "model", "মডেল", "for", "sale", "sell", "বিক্রি", "বিক্রয়", "বিক্রী", "হবে", "হইবে",
  "বাইক", "গাড়ি", "গাড়ী", "car", "bike", "truck", "ট্রাক", "এর", "কার", "বাইকটি", "গাড়িটি",
  "owner", "post", "urgent", "জরুরি", "জরুরী", "আছে", "ভালো", "ভাল", "fresh",
].map(nfc));

// শিরোনামের শুরুতে থাকলে বাদ যাবে: বিক্রির ঘোষণা + সালাম
const FILLER = new Set<string>([
  "বিক্রি", "বিক্রয়", "বিক্রী", "বিক্রির", "হবে", "হইবে", "করা", "করতে", "দিবো", "দিব", "দিবেন",
  "সেল", "sale", "sell", "for", "urgent", "emergency", "জরুরি", "জরুরী", "ইমারজেন্সি",
  "এমারজেন্সি", "ভিত্তিতে", "ভিত্তিতেই", "আছে",
  "আস", "আসসালামু", "সালামু", "সালাম", "আলাইকুম", "ওয়া", "ওয়ারাহমাতুল্লাহ", "রহমাতুল্লাহ",
  "রহমাতুল্লাহি", "রহমতুল্লাহ", "বারাকাতুহু", "ওয়াবারাকাতুহ", "assalamu", "assalamualaikum",
  "alaikum", "walaikum", "salam",
].map(nfc));

const CATEGORY_LABEL: Record<string, string> = {
  car: "গাড়ি",
  bike: "বাইক",
  truck: "ট্রাক",
  heavy: "হেভি ইকুইপমেন্ট",
  parts: "পার্টস",
};

const HAS_LETTER = /[A-Za-z\u0980-\u09E5]/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normToken = (t: string) => t.replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "").toLowerCase();

function findFirst(text: string): { entry: Entry; start: number; end: number } | null {
  const lower = text.toLowerCase();
  let best: { entry: Entry; start: number; end: number; len: number } | null = null;
  for (const entry of ENTRIES) {
    for (const rawAlias of entry.aliases) {
      const alias = nfc(rawAlias);
      let idx = -1;
      if (/^[a-z0-9 +\-]+$/.test(alias)) {
        const m = new RegExp("(^|[^a-z0-9])" + escapeRe(alias) + "(?![a-z0-9])", "i").exec(lower);
        if (m) idx = m.index + m[1].length;
      } else {
        idx = lower.indexOf(alias);
      }
      if (idx < 0) continue;
      if (!best || idx < best.start || (idx === best.start && alias.length > best.len)) {
        best = { entry, start: idx, end: idx + alias.length, len: alias.length };
      }
    }
  }
  return best;
}

function findYear(text: string): string {
  const max = new Date().getFullYear() + 1;
  const re = /(^|\D)(19[89]\d|20[0-3]\d)(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const y = Number(m[2]);
    if (y >= 1985 && y <= max) return m[2];
  }
  return "";
}

function followingTokens(text: string, from: number, max: number): string[] {
  const rest = text.slice(from).split(/[\n।.,;:()!?|]/)[0];
  const out: string[] = [];
  for (const raw of rest.split(/\s+/)) {
    const t = raw.replace(/^[-–—]+|[-–—]+$/g, "");
    if (!t) continue;
    if (STOP.has(t.toLowerCase()) || /^(19|20)\d\d$/.test(t)) break;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

const isFiller = (tok: string): boolean => {
  const n = normToken(tok);
  return n === "" || FILLER.has(n);
};

function fallbackTitle(original: string, kind: string, year: string): string {
  const lines = original.split("\n").map((l) => l.trim()).filter(Boolean);
  let leftover = "";
  for (const line of lines) {
    const toks = line.split(/\s+/);
    let i = 0;
    while (i < toks.length && isFiller(toks[i])) i++;
    const rest = toks.slice(i);
    if (rest.length === 0) continue;
    const joined = rest.join(" ");
    if (HAS_LETTER.test(joined)) return rest.slice(0, 8).join(" ");
    if (!leftover) leftover = joined;
  }
  return [CATEGORY_LABEL[kind] || "গাড়ি", leftover, year].filter(Boolean).join(" ");
}

export function buildListingTitle(description: string, kind: string): string {
  const original = nfc((description || "").trim());
  if (!original) return "";
  const text = toEn(original);
  const year = findYear(text);
  let title = "";

  // পার্টসের বিবরণে ব্র্যান্ডের নাম সাধারণত "কোন গাড়ির জন্য" বোঝাতে থাকে, তাই পার্টসে অনুমান করা হয় না।
  if (kind !== "parts") {
    const hit = findFirst(text);
    if (hit) {
      const parts: string[] = [hit.entry.name];
      if (hit.entry.model) {
        const cc = text.match(/(\d{2,4})\s?(cc|সিসি)/i);
        if (cc) parts.push(`${cc[1]}cc`);
      } else {
        parts.push(...followingTokens(text, hit.end, 2));
      }
      if (year && !parts.join(" ").includes(year)) parts.push(year);
      title = parts.join(" ");
    }
  }

  if (!title) title = fallbackTitle(original, kind, year);
  return title.replace(/\s+/g, " ").trim().slice(0, 60);
}
