// ─────────────────────────────────────────────────────────────
// Tomavine location backbone (Feature: Location Backbone v1).
//
// Static, dependency-free district data for Telangana, Andhra
// Pradesh and Karnataka — the three states we serve. Kept in the
// repo (not the DB) so seed runs can never wipe it and the header
// chip never needs a network round-trip.
//
// Coordinates are district-HQ centroids, accurate enough for
// delivery ETA banding and nearest-first sorting (they are not
// routing coordinates).
//
// Codes are stable identifiers (e.g. "TG-HYD") — stored on
// Nursery.districtCode and in localStorage. Never rename them.
// ─────────────────────────────────────────────────────────────

export type GeoState = "TG" | "AP" | "KA";

export type GeoDistrict = {
  code: string;
  name: string;
  state: GeoState;
  lat: number;
  lng: number;
  te?: string; // Telugu name
  kn?: string; // Kannada name
};

export const STATES: { code: GeoState; name: string }[] = [
  { code: "TG", name: "Telangana" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "KA", name: "Karnataka" },
];

export const DISTRICTS: GeoDistrict[] = [
  // ── Telangana (33) ──
  { code: "TG-ADB", name: "Adilabad", state: "TG", lat: 19.6638, lng: 78.5319, te: "ఆదిలాబాద్" },
  { code: "TG-BBK", name: "Bhadradri Kothagudem", state: "TG", lat: 17.5541, lng: 80.7795, te: "భద్రాద్రి కొత్తగూడెం" },
  { code: "TG-HNK", name: "Hanumakonda", state: "TG", lat: 17.9689, lng: 79.4906, te: "హనుమకొండ" },
  { code: "TG-HYB", name: "Hyderabad", state: "TG", lat: 17.385, lng: 78.4867, te: "హైదరాబాద్" },
  { code: "TG-JGT", name: "Jagtial", state: "TG", lat: 18.7906, lng: 78.9119, te: "జగ్తియల్" },
  { code: "TG-JGN", name: "Jangaon", state: "TG", lat: 17.7229, lng: 79.1529, te: "జనగాం" },
  { code: "TG-JBS", name: "Jayashankar Bhupalpally", state: "TG", lat: 18.4361, lng: 79.8869, te: "జయశంకర్ భూపాలపల్లి" },
  { code: "TG-JGD", name: "Jogulamba Gadwal", state: "TG", lat: 16.2348, lng: 77.7952, te: "జోగులాంబ గద్వాల" },
  { code: "TG-KMR", name: "Kamareddy", state: "TG", lat: 18.3207, lng: 78.3374, te: "కామారెడ్డి" },
  { code: "TG-KRN", name: "Karimnagar", state: "TG", lat: 18.4386, lng: 79.1288, te: "కరీంనగర్" },
  { code: "TG-KHM", name: "Khammam", state: "TG", lat: 17.2473, lng: 80.1514, te: "ఖమ్మం" },
  { code: "TG-KBA", name: "Komaram Bheem Asifabad", state: "TG", lat: 19.3586, lng: 79.2842, te: "కొమరం భీమ్ ఆసిఫాబాద్" },
  { code: "TG-MBD", name: "Mahabubabad", state: "TG", lat: 17.5981, lng: 80.0035, te: "మహబూబాబాద్" },
  { code: "TG-MBN", name: "Mahabubnagar", state: "TG", lat: 16.7488, lng: 77.9848, te: "మహబూబ్ నగర్" },
  { code: "TG-MCL", name: "Mancherial", state: "TG", lat: 18.8716, lng: 79.4436, te: "మంచిర్యాల" },
  { code: "TG-MDK", name: "Medak", state: "TG", lat: 18.045, lng: 78.265, te: "మెదక్" },
  { code: "TG-MML", name: "Medchal–Malkajgiri", state: "TG", lat: 17.6329, lng: 78.4833, te: "మేడ్చల్–మల్కాజిగిరి" },
  { code: "TG-MLG", name: "Mulugu", state: "TG", lat: 18.1877, lng: 79.9459, te: "ములుగు" },
  { code: "TG-NKN", name: "Nagarkurnool", state: "TG", lat: 16.4821, lng: 78.3245, te: "నాగర్‌కర్నూల్" },
  { code: "TG-NLG", name: "Nalgonda", state: "TG", lat: 17.0544, lng: 79.2674, te: "నల్గొండ" },
  { code: "TG-NRP", name: "Narayanpet", state: "TG", lat: 16.7435, lng: 77.4971, te: "నారాయణపేట" },
  { code: "TG-NRL", name: "Nirmal", state: "TG", lat: 19.0969, lng: 78.3441, te: "నిర్మల్" },
  { code: "TG-NZB", name: "Nizamabad", state: "TG", lat: 18.6725, lng: 78.0941, te: "నిజామాబాద్" },
  { code: "TG-PDP", name: "Peddapalli", state: "TG", lat: 18.6158, lng: 79.3794, te: "పెద్దపల్లి" },
  { code: "TG-RSC", name: "Rajanna Sircilla", state: "TG", lat: 18.3847, lng: 78.8093, te: "రాజన్న సిరిసిల్ల" },
  { code: "TG-RR", name: "Rangareddy", state: "TG", lat: 17.3434, lng: 78.2425, te: "రంగారెడ్డి" },
  { code: "TG-SRD", name: "Sangareddy", state: "TG", lat: 17.6244, lng: 78.0866, te: "సంగారెడ్డి" },
  { code: "TG-SPT", name: "Siddipet", state: "TG", lat: 18.1034, lng: 78.8493, te: "సిద్ధిపేట" },
  { code: "TG-SRP", name: "Suryapet", state: "TG", lat: 17.14, lng: 79.6239, te: "సూర్యాపేట" },
  { code: "TG-VKB", name: "Vikarabad", state: "TG", lat: 17.3384, lng: 77.9029, te: "వికారాబాద్" },
  { code: "TG-WNP", name: "Wanaparthy", state: "TG", lat: 16.3611, lng: 78.0658, te: "వనపర్తి" },
  { code: "TG-WGL", name: "Warangal", state: "TG", lat: 17.9689, lng: 79.5941, te: "వరంగల్" },
  { code: "TG-YBG", name: "Yadadri Bhuvanagiri", state: "TG", lat: 17.4946, lng: 79.0465, te: "యాదాద్రి భువనగిరి" },

  // ── Andhra Pradesh (26) ──
  { code: "AP-ASR", name: "Alluri Sitharama Raju", state: "AP", lat: 18.0761, lng: 82.6591, te: "అల్లూరి సీతారామ రాజు" },
  { code: "AP-AKP", name: "Anakapalli", state: "AP", lat: 17.6913, lng: 83.0039, te: "అనకాపల్లి" },
  { code: "AP-ATP", name: "Ananthapuramu", state: "AP", lat: 14.6819, lng: 77.5986, te: "అనంతపురం" },
  { code: "AP-ANY", name: "Annamayya", state: "AP", lat: 14.4483, lng: 78.7083, te: "అన్నమయ్య" },
  { code: "AP-BPT", name: "Bapatla", state: "AP", lat: 15.9042, lng: 80.4675, te: "బాపట్ల" },
  { code: "AP-CTR", name: "Chittoor", state: "AP", lat: 13.2172, lng: 79.1003, te: "చిత్తూరు" },
  { code: "AP-KNS", name: "Dr. B.R. Ambedkar Konaseema", state: "AP", lat: 16.6458, lng: 82.0056, te: "డా. బి.ఆర్. అంబేద్కర్ కోనసీమ" },
  { code: "AP-EGD", name: "East Godavari", state: "AP", lat: 17.0005, lng: 81.804, te: "తూర్పు గోదావరి" },
  { code: "AP-ELR", name: "Eluru", state: "AP", lat: 16.7107, lng: 81.0945, te: "ఏలూరు" },
  { code: "AP-GNT", name: "Guntur", state: "AP", lat: 16.3067, lng: 80.4365, te: "గుంటూరు" },
  { code: "AP-KAK", name: "Kakinada", state: "AP", lat: 16.9891, lng: 82.2475, te: "కాకినాడ" },
  { code: "AP-KRS", name: "Krishna", state: "AP", lat: 16.1873, lng: 81.1389, te: "కృష్ణ" },
  { code: "AP-KRL", name: "Kurnool", state: "AP", lat: 15.8281, lng: 78.0373, te: "కర్నూలు" },
  { code: "AP-NDY", name: "Nandyal", state: "AP", lat: 15.4781, lng: 78.4871, te: "నంద్యాల" },
  { code: "AP-NTR", name: "NTR", state: "AP", lat: 16.5062, lng: 80.648, te: "ఎన్టీఆర్" },
  { code: "AP-PLN", name: "Palnadu", state: "AP", lat: 16.2313, lng: 80.0502, te: "పల్నాడు" },
  { code: "AP-PVM", name: "Parvathipuram Manyam", state: "AP", lat: 18.7833, lng: 83.4167, te: "పార్వతీపురం మన్యం" },
  { code: "AP-PRK", name: "Prakasam", state: "AP", lat: 15.5057, lng: 80.0499, te: "ప్రకాశం" },
  { code: "AP-NLR", name: "Sri Potti Sriramulu Nellore", state: "AP", lat: 14.4426, lng: 79.9865, te: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" },
  { code: "AP-SSS", name: "Sri Sathya Sai", state: "AP", lat: 14.1681, lng: 77.8136, te: "శ్రీ సత్య సాయి" },
  { code: "AP-SKM", name: "Srikakulam", state: "AP", lat: 18.2949, lng: 83.8878, te: "శ్రీకాకుళం" },
  { code: "AP-TPT", name: "Tirupati", state: "AP", lat: 13.6288, lng: 79.4192, te: "తిరుపతి" },
  { code: "AP-VSP", name: "Visakhapatnam", state: "AP", lat: 17.6868, lng: 83.2185, te: "విశాఖపట్నం" },
  { code: "AP-VZM", name: "Vizianagaram", state: "AP", lat: 18.1067, lng: 83.4058, te: "విజయనగరం" },
  { code: "AP-WGD", name: "West Godavari", state: "AP", lat: 16.5449, lng: 81.5212, te: "పశ్చిమ గోదావరి" },
  { code: "AP-YSR", name: "YSR Kadapa", state: "AP", lat: 14.4676, lng: 78.8241, te: "వైఎస్ఆర్ కడప" },

  // ── Karnataka (31) ──
  { code: "KA-BGK", name: "Bagalkote", state: "KA", lat: 16.1851, lng: 75.6965, kn: "ಬಾಗಲಕೋಟೆ" },
  { code: "KA-BLR", name: "Ballari", state: "KA", lat: 15.1394, lng: 76.9214, kn: "ಬಳ್ಳಾರಿ" },
  { code: "KA-BGM", name: "Belagavi", state: "KA", lat: 15.8497, lng: 74.4977, kn: "ಬೆಳಗಾವಿ" },
  { code: "KA-BRR", name: "Bengaluru Rural", state: "KA", lat: 13.2299, lng: 77.747, kn: "ಬೆಂಗಳೂರು ಗ್ರಾಮೀಣ" },
  { code: "KA-BUR", name: "Bengaluru Urban", state: "KA", lat: 12.9716, lng: 77.5946, kn: "ಬೆಂಗಳೂರು ನಗರ" },
  { code: "KA-BDR", name: "Bidar", state: "KA", lat: 17.9104, lng: 77.519, kn: "ಬೀದರ್" },
  { code: "KA-CMR", name: "Chamarajanagar", state: "KA", lat: 11.9261, lng: 76.9437, kn: "ಚಾಮರಾಜನಗರ" },
  { code: "KA-CKB", name: "Chikkaballapur", state: "KA", lat: 13.4351, lng: 77.7312, kn: "ಚಿಕ್ಕಬಳ್ಳಾಪುರ" },
  { code: "KA-CKM", name: "Chikkamagaluru", state: "KA", lat: 13.3189, lng: 75.7721, kn: "ಚಿಕ್ಕಮಗಳೂರು" },
  { code: "KA-CTG", name: "Chitradurga", state: "KA", lat: 14.2251, lng: 76.398, kn: "ಚಿತ್ರದುರ್ಗ" },
  { code: "KA-DKD", name: "Dakshina Kannada", state: "KA", lat: 12.9141, lng: 74.856, kn: "ದಕ್ಷಿಣ ಕನ್ನಡ" },
  { code: "KA-DVG", name: "Davanagere", state: "KA", lat: 14.4644, lng: 75.9217, kn: "ದಾವಣಗೆರೆ" },
  { code: "KA-DHW", name: "Dharwad", state: "KA", lat: 15.3647, lng: 75.124, kn: "ಧಾರವಾಡ" },
  { code: "KA-GDG", name: "Gadag", state: "KA", lat: 15.4315, lng: 75.6329, kn: "ಗದಗ" },
  { code: "KA-HSN", name: "Hassan", state: "KA", lat: 13.0064, lng: 76.0978, kn: "ಹಾಸನ" },
  { code: "KA-HVR", name: "Haveri", state: "KA", lat: 14.7937, lng: 75.3985, kn: "ಹಾವೇರಿ" },
  { code: "KA-KLB", name: "Kalaburagi", state: "KA", lat: 17.3297, lng: 76.8343, kn: "ಕಲಬುರಗಿ" },
  { code: "KA-KDG", name: "Kodagu", state: "KA", lat: 12.4241, lng: 75.7387, kn: "ಕೊಡಗು" },
  { code: "KA-KLR", name: "Kolar", state: "KA", lat: 13.1362, lng: 78.1293, kn: "ಕೋಲಾರ" },
  { code: "KA-KPL", name: "Koppal", state: "KA", lat: 15.3554, lng: 76.1542, kn: "ಕೊಪ್ಪಳ" },
  { code: "KA-MDY", name: "Mandya", state: "KA", lat: 12.5222, lng: 76.8952, kn: "ಮಂಡ್ಯ" },
  { code: "KA-MYS", name: "Mysuru", state: "KA", lat: 12.2958, lng: 76.6394, kn: "ಮೈಸೂರು" },
  { code: "KA-RCR", name: "Raichur", state: "KA", lat: 15.9312, lng: 77.111, kn: "ರಾಯಚೂರು" },
  { code: "KA-RMN", name: "Ramanagara", state: "KA", lat: 12.7231, lng: 77.2811, kn: "ರಾಮನಗರ" },
  { code: "KA-SMG", name: "Shivamogga", state: "KA", lat: 13.9299, lng: 75.5681, kn: "ಶಿವಮೊಗ್ಗ" },
  { code: "KA-TMK", name: "Tumakuru", state: "KA", lat: 13.3392, lng: 77.114, kn: "ತುಮಕೂರು" },
  { code: "KA-UDP", name: "Udupi", state: "KA", lat: 13.3409, lng: 74.7421, kn: "ಉಡುಪಿ" },
  { code: "KA-UKR", name: "Uttara Kannada", state: "KA", lat: 14.8138, lng: 74.129, kn: "ಉತ್ತರ ಕನ್ನಡ" },
  { code: "KA-VJR", name: "Vijayanagara", state: "KA", lat: 15.2687, lng: 76.3883, kn: "ವಿಜಯನಗರ" },
  { code: "KA-VJP", name: "Vijayapura", state: "KA", lat: 16.8302, lng: 75.71, kn: "ವಿಜಯಪುರ" },
  { code: "KA-YDG", name: "Yadgir", state: "KA", lat: 16.769, lng: 77.1386, kn: "ಯಾದಗಿರ್" },
];

// City-name aliases used by the one-shot nursery backfill script
// (scripts/backfill-nursery-geo.mjs) — lowercase, trimmed.
export const CITY_ALIASES: Record<string, string> = {
  bengaluru: "KA-BUR",
  bangalore: "KA-BUR",
  "bengaluru urban": "KA-BUR",
  bengaluru_north: "KA-BUR",
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
  "adilabad (u)": "TG-ADB",
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
  "puttaparthi": "AP-SSS",
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
  manyam: "AP-PVM",
};

const DISTRICT_BY_CODE = new Map(DISTRICTS.map((d) => [d.code, d]));

export function districtByCode(code: string | null | undefined): GeoDistrict | null {
  if (!code) return null;
  return DISTRICT_BY_CODE.get(code) ?? null;
}

export function districtName(code: string | null | undefined, lang = "en"): string {
  const d = districtByCode(code);
  if (!d) return "";
  if (lang === "te" && d.te) return d.te;
  if (lang === "kn" && d.kn) return d.kn;
  return d.name;
}

// Great-circle distance in km (Haversine). Good to ~0.5% — plenty
// for ETA banding and "nearest first" sorting.
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

// Snap browser coordinates to the nearest district centroid.
export function nearestDistrict(lat: number, lng: number): { district: GeoDistrict; distanceKm: number } {
  let best = DISTRICTS[0];
  let bestKm = haversineKm({ lat, lng }, { lat: best.lat, lng: best.lng });
  for (const d of DISTRICTS) {
    const km = haversineKm({ lat, lng }, { lat: d.lat, lng: d.lng });
    if (km < bestKm) {
      best = d;
      bestKm = km;
    }
  }
  return { district: best, distanceKm: bestKm };
}

// ── Delivery ETA bands ────────────────────────────────────────
// Same district      → 1–2 days
// ≤ 150 km away      → 2–4 days   (adjacent-district proxy)
// Same state         → 4–6 days
// Elsewhere          → 5–8 days
// Unknown (no geo)   → 3–5 days

export type EtaBand = "same" | "nearby" | "state" | "far" | "unknown";

export type DeliveryEta = {
  band: EtaBand;
  minDays: number;
  maxDays: number;
  km: number | null;
};

const BAND_DAYS: Record<EtaBand, { minDays: number; maxDays: number }> = {
  same: { minDays: 1, maxDays: 2 },
  nearby: { minDays: 2, maxDays: 4 },
  state: { minDays: 4, maxDays: 6 },
  far: { minDays: 5, maxDays: 8 },
  unknown: { minDays: 3, maxDays: 5 },
};

export function etaForDistance(km: number | null, sameState: boolean): DeliveryEta {
  const band: EtaBand = km === null ? "unknown" : km <= 150 ? "nearby" : sameState ? "state" : "far";
  return { band: band, ...BAND_DAYS[band], km: km };
}

// Full ETA for a nursery seen by a customer in a known district.
// Same-district wins over raw distance (a 60 km intra-district hop
// still reads as "1–2 days").
export function deliveryEta(opts: {
  userCode: string | null;
  userLatLng: { lat: number; lng: number } | null;
  nurseryCode: string | null;
  nurseryLatLng: { lat: number; lng: number } | null;
}): DeliveryEta {
  const { userCode, userLatLng, nurseryCode, nurseryLatLng } = opts;
  const userD = districtByCode(userCode);
  const nurseryD = districtByCode(nurseryCode);

  if (userCode && nurseryCode && userCode === nurseryCode) {
    return { band: "same", ...BAND_DAYS.same, km: userLatLng && nurseryLatLng ? haversineKm(userLatLng, nurseryLatLng) : null };
  }

  let km: number | null = null;
  if (userLatLng && nurseryLatLng) {
    km = haversineKm(userLatLng, nurseryLatLng);
  } else if (userD && nurseryD) {
    km = haversineKm(userD, nurseryD);
  }

  const sameState = !!userD && !!nurseryD && userD.state === nurseryD.state;
  return etaForDistance(km, sameState);
}
