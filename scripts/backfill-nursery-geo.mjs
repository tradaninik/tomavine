// One-shot geo backfill for EXISTING Tomavine nurseries.
//
//   node scripts/backfill-nursery-geo.mjs
//
// Matches each nursery's existing `city` string (case-insensitive,
// with common aliases like "Bangalore" -> "Bengaluru Urban") to the
// district list in src/lib/geo.ts, then writes districtCode + the
// district centroid into lat/lng.
//
// Safe for production (Neon): it only UPDATEs the three new geo
// fields on matched rows — it never deletes or recreates rows, and
// never touches names, prices, stock or any other column. Re-running
// overwrites only districtCode/lat/lng with the same values.
//
// Run AFTER applying the migration: npx prisma migrate deploy
// Nurseries whose city does not match are left untouched and
// reported at the end (they simply sort last until fixed).

import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Tiny .env loader (no dotenv dependency needed) — same pattern as
// scripts/add-photos.mjs.
if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim();
    }
  }
}

// The geo table is a TypeScript module; for this .mjs script we
// re-derive what we need from a small embedded snapshot that mirrors
// src/lib/geo.ts (codes + centroids + aliases). If you add districts
// there, mirror them here.
const DISTRICTS = {
  "TG-ADB": { lat: 19.6638, lng: 78.5319, name: "Adilabad" },
  "TG-BBK": { lat: 17.5541, lng: 80.7795, name: "Bhadradri Kothagudem" },
  "TG-HNK": { lat: 17.9689, lng: 79.4906, name: "Hanumakonda" },
  "TG-HYB": { lat: 17.385, lng: 78.4867, name: "Hyderabad" },
  "TG-JGT": { lat: 18.7906, lng: 78.9119, name: "Jagtial" },
  "TG-JGN": { lat: 17.7229, lng: 79.1529, name: "Jangaon" },
  "TG-JBS": { lat: 18.4361, lng: 79.8869, name: "Jayashankar Bhupalpally" },
  "TG-JGD": { lat: 16.2348, lng: 77.7952, name: "Jogulamba Gadwal" },
  "TG-KMR": { lat: 18.3207, lng: 78.3374, name: "Kamareddy" },
  "TG-KRN": { lat: 18.4386, lng: 79.1288, name: "Karimnagar" },
  "TG-KHM": { lat: 17.2473, lng: 80.1514, name: "Khammam" },
  "TG-KBA": { lat: 19.3586, lng: 79.2842, name: "Komaram Bheem Asifabad" },
  "TG-MBD": { lat: 17.5981, lng: 80.0035, name: "Mahabubabad" },
  "TG-MBN": { lat: 16.7488, lng: 77.9848, name: "Mahabubnagar" },
  "TG-MCL": { lat: 18.8716, lng: 79.4436, name: "Mancherial" },
  "TG-MDK": { lat: 18.045, lng: 78.265, name: "Medak" },
  "TG-MML": { lat: 17.6329, lng: 78.4833, name: "Medchal–Malkajgiri" },
  "TG-MLG": { lat: 18.1877, lng: 79.9459, name: "Mulugu" },
  "TG-NKN": { lat: 16.4821, lng: 78.3245, name: "Nagarkurnool" },
  "TG-NLG": { lat: 17.0544, lng: 79.2674, name: "Nalgonda" },
  "TG-NRP": { lat: 16.7435, lng: 77.4971, name: "Narayanpet" },
  "TG-NRL": { lat: 19.0969, lng: 78.3441, name: "Nirmal" },
  "TG-NZB": { lat: 18.6725, lng: 78.0941, name: "Nizamabad" },
  "TG-PDP": { lat: 18.6158, lng: 79.3794, name: "Peddapalli" },
  "TG-RSC": { lat: 18.3847, lng: 78.8093, name: "Rajanna Sircilla" },
  "TG-RR": { lat: 17.3434, lng: 78.2425, name: "Rangareddy" },
  "TG-SRD": { lat: 17.6244, lng: 78.0866, name: "Sangareddy" },
  "TG-SPT": { lat: 18.1034, lng: 78.8493, name: "Siddipet" },
  "TG-SRP": { lat: 17.14, lng: 79.6239, name: "Suryapet" },
  "TG-VKB": { lat: 17.3384, lng: 77.9029, name: "Vikarabad" },
  "TG-WNP": { lat: 16.3611, lng: 78.0658, name: "Wanaparthy" },
  "TG-WGL": { lat: 17.9689, lng: 79.5941, name: "Warangal" },
  "TG-YBG": { lat: 17.4946, lng: 79.0465, name: "Yadadri Bhuvanagiri" },
  "AP-ASR": { lat: 18.0761, lng: 82.6591, name: "Alluri Sitharama Raju" },
  "AP-AKP": { lat: 17.6913, lng: 83.0039, name: "Anakapalli" },
  "AP-ATP": { lat: 14.6819, lng: 77.5986, name: "Ananthapuramu" },
  "AP-ANY": { lat: 14.4483, lng: 78.7083, name: "Annamayya" },
  "AP-BPT": { lat: 15.9042, lng: 80.4675, name: "Bapatla" },
  "AP-CTR": { lat: 13.2172, lng: 79.1003, name: "Chittoor" },
  "AP-KNS": { lat: 16.6458, lng: 82.0056, name: "Dr. B.R. Ambedkar Konaseema" },
  "AP-EGD": { lat: 17.0005, lng: 81.804, name: "East Godavari" },
  "AP-ELR": { lat: 16.7107, lng: 81.0945, name: "Eluru" },
  "AP-GNT": { lat: 16.3067, lng: 80.4365, name: "Guntur" },
  "AP-KAK": { lat: 16.9891, lng: 82.2475, name: "Kakinada" },
  "AP-KRS": { lat: 16.1873, lng: 81.1389, name: "Krishna" },
  "AP-KRL": { lat: 15.8281, lng: 78.0373, name: "Kurnool" },
  "AP-NDY": { lat: 15.4781, lng: 78.4871, name: "Nandyal" },
  "AP-NTR": { lat: 16.5062, lng: 80.648, name: "NTR" },
  "AP-PLN": { lat: 16.2313, lng: 80.0502, name: "Palnadu" },
  "AP-PVM": { lat: 18.7833, lng: 83.4167, name: "Parvathipuram Manyam" },
  "AP-PRK": { lat: 15.5057, lng: 80.0499, name: "Prakasam" },
  "AP-NLR": { lat: 14.4426, lng: 79.9865, name: "Sri Potti Sriramulu Nellore" },
  "AP-SSS": { lat: 14.1681, lng: 77.8136, name: "Sri Sathya Sai" },
  "AP-SKM": { lat: 18.2949, lng: 83.8878, name: "Srikakulam" },
  "AP-TPT": { lat: 13.6288, lng: 79.4192, name: "Tirupati" },
  "AP-VSP": { lat: 17.6868, lng: 83.2185, name: "Visakhapatnam" },
  "AP-VZM": { lat: 18.1067, lng: 83.4058, name: "Vizianagaram" },
  "AP-WGD": { lat: 16.5449, lng: 81.5212, name: "West Godavari" },
  "AP-YSR": { lat: 14.4676, lng: 78.8241, name: "YSR Kadapa" },
  "KA-BGK": { lat: 16.1851, lng: 75.6965, name: "Bagalkote" },
  "KA-BLR": { lat: 15.1394, lng: 76.9214, name: "Ballari" },
  "KA-BGM": { lat: 15.8497, lng: 74.4977, name: "Belagavi" },
  "KA-BRR": { lat: 13.2299, lng: 77.747, name: "Bengaluru Rural" },
  "KA-BUR": { lat: 12.9716, lng: 77.5946, name: "Bengaluru Urban" },
  "KA-BDR": { lat: 17.9104, lng: 77.519, name: "Bidar" },
  "KA-CMR": { lat: 11.9261, lng: 76.9437, name: "Chamarajanagar" },
  "KA-CKB": { lat: 13.4351, lng: 77.7312, name: "Chikkaballapur" },
  "KA-CKM": { lat: 13.3189, lng: 75.7721, name: "Chikkamagaluru" },
  "KA-CTG": { lat: 14.2251, lng: 76.398, name: "Chitradurga" },
  "KA-DKD": { lat: 12.9141, lng: 74.856, name: "Dakshina Kannada" },
  "KA-DVG": { lat: 14.4644, lng: 75.9217, name: "Davanagere" },
  "KA-DHW": { lat: 15.3647, lng: 75.124, name: "Dharwad" },
  "KA-GDG": { lat: 15.4315, lng: 75.6329, name: "Gadag" },
  "KA-HSN": { lat: 13.0064, lng: 76.0978, name: "Hassan" },
  "KA-HVR": { lat: 14.7937, lng: 75.3985, name: "Haveri" },
  "KA-KLB": { lat: 17.3297, lng: 76.8343, name: "Kalaburagi" },
  "KA-KDG": { lat: 12.4241, lng: 75.7387, name: "Kodagu" },
  "KA-KLR": { lat: 13.1362, lng: 78.1293, name: "Kolar" },
  "KA-KPL": { lat: 15.3554, lng: 76.1542, name: "Koppal" },
  "KA-MDY": { lat: 12.5222, lng: 76.8952, name: "Mandya" },
  "KA-MYS": { lat: 12.2958, lng: 76.6394, name: "Mysuru" },
  "KA-RCR": { lat: 15.9312, lng: 77.111, name: "Raichur" },
  "KA-RMN": { lat: 12.7231, lng: 77.2811, name: "Ramanagara" },
  "KA-SMG": { lat: 13.9299, lng: 75.5681, name: "Shivamogga" },
  "KA-TMK": { lat: 13.3392, lng: 77.114, name: "Tumakuru" },
  "KA-UDP": { lat: 13.3409, lng: 74.7421, name: "Udupi" },
  "KA-UKR": { lat: 14.8138, lng: 74.129, name: "Uttara Kannada" },
  "KA-VJR": { lat: 15.2687, lng: 76.3883, name: "Vijayanagara" },
  "KA-VJP": { lat: 16.8302, lng: 75.71, name: "Vijayapura" },
  "KA-YDG": { lat: 16.769, lng: 77.1386, name: "Yadgir" },
};

const ALIASES = {
  bengaluru: "KA-BUR",
  bangalore: "KA-BUR",
  "bengaluru urban": "KA-BUR",
  "bengaluru rural": "KA-BRR",
  devanahalli: "KA-BRR",
  hoskote: "KA-BRR",
  ballari: "KA-BLR",
  bellary: "KA-BLR",
  belagavi: "KA-BGM",
  belgaum: "KA-BGM",
  bidar: "KA-BDR",
  chamarajanagar: "KA-CMR",
  chikkaballapur: "KA-CKB",
  chikkaballapura: "KA-CKB",
  chikkamagaluru: "KA-CKM",
  chikmagalur: "KA-CKM",
  chitradurga: "KA-CTG",
  mangaluru: "KA-DKD",
  mangalore: "KA-DKD",
  davanagere: "KA-DVG",
  hubballi: "KA-DHW",
  hubli: "KA-DHW",
  dharwad: "KA-DHW",
  gadag: "KA-GDG",
  hassan: "KA-HSN",
  haveri: "KA-HVR",
  kalaburagi: "KA-KLB",
  gulbarga: "KA-KLB",
  madikeri: "KA-KDG",
  kodagu: "KA-KDG",
  coorg: "KA-KDG",
  kolar: "KA-KLR",
  koppal: "KA-KPL",
  mandya: "KA-MDY",
  mysuru: "KA-MYS",
  mysore: "KA-MYS",
  raichur: "KA-RCR",
  ramanagara: "KA-RMN",
  ramanagaram: "KA-RMN",
  shivamogga: "KA-SMG",
  shimoga: "KA-SMG",
  tumakuru: "KA-TMK",
  tumkur: "KA-TMK",
  udupi: "KA-UDP",
  karwar: "KA-UKR",
  "uttara kannada": "KA-UKR",
  hosapete: "KA-VJR",
  hospet: "KA-VJR",
  vijayanagara: "KA-VJR",
  vijayapura: "KA-VJP",
  bijapur: "KA-VJP",
  yadgir: "KA-YDG",
  hyderabad: "TG-HYB",
  secunderabad: "TG-HYB",
  warangal: "TG-WGL",
  hanumakonda: "TG-HNK",
  nizamabad: "TG-NZB",
  karimnagar: "TG-KRN",
  khammam: "TG-KHM",
  nalgonda: "TG-NLG",
  siddipet: "TG-SPT",
  sangareddy: "TG-SRD",
  mahabubnagar: "TG-MBN",
  adilabad: "TG-ADB",
  medak: "TG-MDK",
  rangareddy: "TG-RR",
  "rangareddy district": "TG-RR",
  shamshabad: "TG-RR",
  vikarabad: "TG-VKB",
  suryapet: "TG-SRP",
  jagtial: "TG-JGT",
  kamareddy: "TG-KMR",
  mancherial: "TG-MCL",
  peddapalli: "TG-PDP",
  sircilla: "TG-RSC",
  "rajanna sircilla": "TG-RSC",
  nirmal: "TG-NRL",
  wanaparthy: "TG-WNP",
  gadwal: "TG-JGD",
  "jogulamba gadwal": "TG-JGD",
  nagarkurnool: "TG-NKN",
  narayanpet: "TG-NRP",
  bhongir: "TG-YBG",
  "yadadri bhuvanagiri": "TG-YBG",
  kothagudem: "TG-BBK",
  palwancha: "TG-BBK",
  vijayawada: "AP-NTR",
  guntur: "AP-GNT",
  tirupati: "AP-TPT",
  visakhapatnam: "AP-VSP",
  vizag: "AP-VSP",
  anakapalli: "AP-AKP",
  kakinada: "AP-KAK",
  rajahmundry: "AP-EGD",
  "east godavari": "AP-EGD",
  kurnool: "AP-KRL",
  nandyal: "AP-NDY",
  nellore: "AP-NLR",
  "sri potti sriramulu nellore": "AP-NLR",
  chittoor: "AP-CTR",
  kadapa: "AP-YSR",
  "ysr kadapa": "AP-YSR",
  srikakulam: "AP-SKM",
  vizianagaram: "AP-VZM",
  eluru: "AP-ELR",
  machilipatnam: "AP-KRS",
  krishna: "AP-KRS",
  ongole: "AP-PRK",
  prakasam: "AP-PRK",
  bapatla: "AP-BPT",
  ananthapuramu: "AP-ATP",
  anantapur: "AP-ATP",
  puttaparthi: "AP-SSS",
  "sri sathya sai": "AP-SSS",
  paderu: "AP-ASR",
  amalapuram: "AP-KNS",
  narasaraopet: "AP-PLN",
  palnadu: "AP-PLN",
  bhimavaram: "AP-WGD",
  "west godavari": "AP-WGD",
  rayachoti: "AP-ANY",
  annamayya: "AP-ANY",
  parvathipuram: "AP-PVM",
};

function normalize(s) {
  return String(s ?? "").trim().toLowerCase();
}

async function main() {
  const nurseries = await prisma.nursery.findMany({
    select: { id: true, name: true, slug: true, city: true, districtCode: true },
    orderBy: { createdAt: "asc" },
  });

  let matched = 0;
  const unmatched = [];

  for (const n of nurseries) {
    const key = normalize(n.city);
    const code = ALIASES[key] ?? null;
    const d = code ? DISTRICTS[code] : null;

    if (code && d) {
      await prisma.nursery.updateMany({
        where: { id: n.id },
        data: { districtCode: code, lat: d.lat, lng: d.lng },
      });
      matched += 1;
      const mark = n.districtCode === code ? "(unchanged)" : "";
      console.log(`  ✔ ${n.name} [${n.slug}] "${n.city}" -> ${code} ${mark}`);
    } else {
      unmatched.push(n);
    }
  }

  console.log("");
  console.log(`Done. ${matched} of ${nurseries.length} nursery(ies) geo-bound.`);
  if (unmatched.length > 0) {
    console.log("");
    console.log("No district matched (nursery left untouched — fix the city field in Prisma Studio, or add an alias to this script):");
    for (const n of unmatched) console.log(`  - ${n.name} [${n.slug}] city="${n.city}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
