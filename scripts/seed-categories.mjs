// Seed the two-level Category browse tree (phase 2a).
//
//   node scripts/seed-categories.mjs
//
// Creates/updates 11 top-level categories + 45 subs by upserting on
// slug — idempotent, safe to re-run. It never deletes: categories that
// exist in the DB but not in TREE below are left alone (retire them
// via active=false in the admin editor once it exists).
//
// NOTE: a re-run OVERWRITES names/emoji/gstRate/sortOrder/parentId of
// the categories in TREE with the values below. If you hand-edit tree
// data in the DB and then re-run this script, your edits are reset.
//
// GST rates seeded here reproduce the CURRENT EFFECTIVE behavior of
// taxRateFor()/SUPPLY_CATEGORIES (pots & tools 18%, plants, saplings &
// inputs 5%) so the phase-2c storefront flip is behavior-neutral.
//   - seeds: seeded at 5% — seeds for sowing are often GST-exempt in
//     practice; review before the flip.
//   - plant-protection/decor/irrigation/gifts: seeded at 18% (the old
//     supply-goods default); legal rates for pesticides (HSN 3808) and
//     clay articles may be lower — review before the flip.
//   - subs have gstRate null = inherit the parent top's rate.
//
// Top names for the 5 legacy categories reuse the exact i18n.tsx
// translations so nothing visibly changes when the storefront flips.

import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";

loadDbEnv();

const prisma = new PrismaClient();

// names: {en, hi, te, kn, ta, mr} — en is the fallback label everywhere.
const TREE = [
  {
    slug: "plants", emoji: "🪴", gstRate: 5, legacyKey: "plants",
    names: { en: "Plants", hi: "पौधे", te: "మొక్కలు", kn: "ಗಿಡಗಳು", ta: "செடிகள்", mr: "झाडे" },
    subs: [
      { slug: "indoor", names: { en: "Indoor plants", hi: "इनडोर पौधे", te: "ఇండోర్ మొక్కలు", kn: "ಒಳಾಂಗಣ ಗಿಡಗಳು", ta: "உள்ளரங்கு செடிகள்", mr: "घरगुती झाडे" } },
      { slug: "flowering", names: { en: "Flowering plants", hi: "फूलदार पौधे", te: "పూల మొక్కలు", kn: "ಹೂಬಿಡುವ ಗಿಡಗಳು", ta: "பூக்கும் செடிகள்", mr: "फुलदार झाडे" } },
      { slug: "succulents", names: { en: "Succulents & cacti", hi: "सक्युलेंट और कैक्टस", te: "సక్యులెంట్స్ మరియు క్యాక్టస్", kn: "ಸಕ್ಯುಲೆಂಟ್ ಮತ್ತು ಕ್ಯಾಕ್ಟಸ್", ta: "சதைத்தாவரங்கள் மற்றும் கேக்டஸ்", mr: "सक्युलंट व कॅक्टस" } },
      { slug: "herbs", names: { en: "Herbs & medicinal", hi: "जड़ी-बूटियाँ और औषधीय", te: "మూలికలు మరియు ఔషధీయ", kn: "ಮೂಲಿಕೆ ಮತ್ತು ಔಷಧೀಯ", ta: "மூலிகை மற்றும் மருத்துவ", mr: "औषधी वनस्पती" } },
      { slug: "aromatic", names: { en: "Aromatic & fragrant", hi: "सुगंधित पौधे", te: "సుగంధ మొక్కలు", kn: "ಸುಗಂಧಿತ ಗಿಡಗಳು", ta: "நறுமண செடிகள்", mr: "सुगंधी झाडे" } },
      { slug: "fruit-plants", names: { en: "Fruit plants", hi: "फल के पौधे", te: "పండ్ల మొక్కలు", kn: "ಹಣ್ಣಿನ ಗಿಡಗಳು", ta: "பழச் செடிகள்", mr: "फळझाडे" } },
      { slug: "palms", names: { en: "Palms", hi: "पाम पौधे", te: "పామ్ మొక్కలు", kn: "ಪಾಮ್ ಗಿಡಗಳು", ta: "பனை இனங்கள்", mr: "पाम झाडे" } },
    ],
  },
  {
    slug: "saplings", emoji: "🌾", gstRate: 5, legacyKey: "saplings",
    names: { en: "Saplings", hi: "रोप", te: "నారు", kn: "ಮೊಳಕೆ", ta: "நாற்று", mr: "रोपे" },
    subs: [
      { slug: "vegetable", names: { en: "Vegetable saplings", hi: "सब्ज़ी के रोप", te: "కూరగాయ నారు", kn: "ತರಕಾರಿ ಸಸಿ", ta: "காய்கறி நாற்று", mr: "भाजी रोपे" } },
      { slug: "fruit", names: { en: "Fruit saplings", hi: "फल के रोप", te: "పండ్ల నారు", kn: "ಹಣ್ಣಿನ ಸಸಿ", ta: "பழ நாற்று", mr: "फळ रोपे" } },
      { slug: "flower", names: { en: "Flower saplings", hi: "फूल के रोप", te: "పూల నారు", kn: "ಹೂವಿನ ಸಸಿ", ta: "பூ நாற்று", mr: "फुलांची रोपे" } },
      { slug: "forestry", names: { en: "Forestry & avenue", hi: "वानिकी और एवेन्यू पौधे", te: "అటవీ మరియు అవెన్యూ నారు", kn: "ಅರಣ್ಯ ಮತ್ತು ದಾರಿಬದಿ ಸಸಿ", ta: "காடு மற்றும் சாலை நாற்று", mr: "वन व रस्त्याकडील रोपे" } },
    ],
  },
  {
    slug: "seeds", emoji: "🌱", gstRate: 5,
    names: { en: "Seeds", hi: "बीज", te: "విత్తనాలు", kn: "ಬೀಜಗಳು", ta: "விதைகள்", mr: "बियाणे" },
    subs: [
      { slug: "vegetable-seeds", names: { en: "Vegetable seeds", hi: "सब्ज़ी के बीज", te: "కూరగాయ విత్తనాలు", kn: "ತರಕಾರಿ ಬೀಜಗಳು", ta: "காய்கறி விதைகள்", mr: "भाजी बियाणे" } },
      { slug: "flower-seeds", names: { en: "Flower seeds", hi: "फूल के बीज", te: "పూల విత్తనాలు", kn: "ಹೂವಿನ ಬೀಜಗಳು", ta: "பூ விதைகள்", mr: "फुलांची बियाणे" } },
      { slug: "herb-seeds", names: { en: "Herb seeds", hi: "जड़ी-बूटी के बीज", te: "మూలికా విత్తనాలు", kn: "ಮೂಲಿಕೆ ಬೀಜಗಳು", ta: "மூலிகை விதைகள்", mr: "औषधी बियाणे" } },
      { slug: "microgreen-seeds", names: { en: "Microgreen seeds", hi: "माइक्रोग्रीन बीज", te: "మైక్రోగ్రీన్ విత్తనాలు", kn: "ಮೈಕ್ರೋಗ್ರೀನ್ ಬೀಜಗಳು", ta: "மைக்ரோகிரீன் விதைகள்", mr: "मायक्रोग्रीन बियाणे" } },
    ],
  },
  {
    slug: "inputs", emoji: "🧪", gstRate: 5, legacyKey: "inputs",
    names: { en: "Organic inputs", hi: "जैविक इनपुट", te: "సేంద్రీయ ఇన్‌పుట్లు", kn: "ಸಾವಯವ ಇನ್‌ಪುಟ್", ta: "இயற்கை உள்ளீடுகள்", mr: "सेंद्रिय इनपुट" },
    subs: [
      { slug: "soil", names: { en: "Soil & potting mixes", hi: "मिट्टी और पॉटिंग मिक्स", te: "నేల మరియు పాటింగ్ మిశ్రమాలు", kn: "ಮಣ್ಣು ಮತ್ತು ಪಾಟಿಂಗ್ ಮಿಶ್ರಣ", ta: "மண் மற்றும் பாட்டிங் கலவை", mr: "माती व पॉटिंग मिक्स" } },
      { slug: "compost", names: { en: "Compost & manure", hi: "कंपोस्ट और खाद", te: "కంపోస్ట్ మరియు ఎరువు", kn: "ಕಂಪೋಸ್ಟ್ ಮತ್ತು ಗೊಬ್ಬರ", ta: "கம்போஸ்ட் மற்றும் உரம்", mr: "कंपोस्ट व खत" } },
      { slug: "fertilizer", names: { en: "Fertilizers & bio-boosters", hi: "उर्वरक और बायो-बूस्टर", te: "ఎరువులు మరియు బయో-బూస్టర్లు", kn: "ಗೊಬ್ಬರಗಳು ಮತ್ತು ಜೈವಿಕ ವರ್ಧಕಗಳು", ta: "உரங்கள் மற்றும் உயிரி வளர்ச்சிக் கூறுகள்", mr: "खते व बायो-बूस्टर" } },
      { slug: "mulch", names: { en: "Mulch", hi: "मल्च", te: "మల్చ్ (కప్పు)", kn: "ಮಲ್ಚ್ (ಹೊದಿಕೆ)", ta: "தழை மூடாம்", mr: "मल्च" } },
      { slug: "coco-peat", names: { en: "Coco peat & substrates", hi: "कोको पीट और सब्सट्रेट", te: "కొకోపీట్ మరియు సబ్‌స్ట్రేట్లు", kn: "ಕೊಕೊಪೀಟ್ ಮತ್ತು ತಳ ಪದಾರ್ಥಗಳು", ta: "தேங்காய்நார் மூட்டான் மற்றும் அடித்தளம்", mr: "कोकोपीट व सबस्ट्रेट" } },
    ],
  },
  {
    slug: "pots", emoji: "🏺", gstRate: 18, legacyKey: "pots",
    names: { en: "Pots", hi: "गमले", te: "కుండలు", kn: "ಮಡಕೆಗಳು", ta: "சட்டிகள்", mr: "गमले" },
    subs: [
      { slug: "plastic", names: { en: "Plastic pots", hi: "प्लास्टिक गमले", te: "ప్లాస్టిక్ కుండలు", kn: "ಪ್ಲಾಸ್ಟಿಕ್ ಮಡಕೆಗಳು", ta: "பிளாஸ்டிக் சட்டிகள்", mr: "प्लास्टिक गमले" } },
      { slug: "terracotta", names: { en: "Terracotta & ceramic", hi: "टेराकोटा और सिरेमिक", te: "టెర్రకోటా మరియు సిరామిక్", kn: "ಟೆರಾಕೋಟಾ ಮತ್ತು ಸೆರಾಮಿಕ್", ta: "களிமண் மற்றும் சிராமிக்", mr: "मातीची व सिरॅमिक भांडी" } },
      { slug: "growbags", names: { en: "Grow bags", hi: "ग्रो बैग", te: "గ్రో బ్యాగ్‌లు", kn: "ಗ್ರೋ ಬ್ಯಾಗ್‌ಗಳು", ta: "க்ரோ பைகள்", mr: "ग्रो बॅग" } },
      { slug: "hanging", names: { en: "Hanging & vertical", hi: "लटकने वाले गमले", te: "వేలాడే కుండలు", kn: "ಜೋತು ಬಿಡುವ ಮಡಕೆಗಳು", ta: "தொங்கு சட்டிகள்", mr: "झुंडणारी गमले" } },
      { slug: "trays", names: { en: "Seedling trays", hi: "नर्सरी ट्रे", te: "మొలక ట్రేలు", kn: "ಸಸಿ ಟ್ರೇಗಳು", ta: "நாற்று தட்டுகள்", mr: "रोप ट्रे" } },
    ],
  },
  {
    slug: "tools", emoji: "🛠️", gstRate: 18, legacyKey: "tools",
    names: { en: "Tools", hi: "औज़ार", te: "పనిముట్లు", kn: "ಸಲಕರಣೆಗಳು", ta: "கருவிகள்", mr: "औजारे" },
    subs: [
      { slug: "hand", names: { en: "Hand tools", hi: "हाथ के औज़ार", te: "చేతి పనిముట్లు", kn: "ಕೈ ಉಪಕರಣಗಳು", ta: "கை கருவிகள்", mr: "हात साधने" } },
      { slug: "watering", names: { en: "Watering", hi: "पानी देने के औज़ार", te: "నీరు పెట్టే పనిముట్లు", kn: "ನೀರು ಹಾಯಿಸುವ ಉಪಕರಣ", ta: "நீர்பாய்ச்சும் கருவிகள்", mr: "पाणी देण्याची साधने" } },
      { slug: "pruning", names: { en: "Pruning & cutting", hi: "छँटाई और कटाई", te: "కత్తిరింపు పనిముట్లు", kn: "ಸವರುವಿಕೆ ಮತ್ತು ಕತ್ತರಿಸುವಿಕೆ", ta: "கத்தரிப்பு கருவிகள்", mr: "छाटणी व कापणी साधने" } },
      { slug: "kits", names: { en: "Kits & accessories", hi: "किट और सहायक उपकरण", te: "కిట్‌లు మరియు సహాయక సామగ్రి", kn: "ಕಿಟ್ ಮತ್ತು ಪರಿಕರಗಳು", ta: "கிட் மற்றும் துணைப்பொருட்கள்", mr: "किट व इतर साधने" } },
      { slug: "safety", names: { en: "Gloves & safety", hi: "दस्ताने और सुरक्षा", te: "చేతి తొడుగులు మరియు భద్రత", kn: "ಕೈಗವಸು ಮತ್ತು ಸುರಕ್ಷತೆ", ta: "கையுறை மற்றும் பாதுகாப்பு", mr: "हातमोजे व सुरक्षा" } },
    ],
  },
  {
    slug: "plant-protection", emoji: "🐛", gstRate: 18,
    names: { en: "Plant protection", hi: "पौध सुरक्षा", te: "మొక్కల రక్షణ", kn: "ಸಸ್ಯ ರಕ್ಷಣೆ", ta: "தாவர பாதுகாப்பு", mr: "झाड संरक्षण" },
    subs: [
      { slug: "organic-controls", names: { en: "Organic controls", hi: "जैविक नियंत्रण", te: "సేంద్రియ నియంత్రణ", kn: "ಸಾವಯವ ನಿಯಂತ್ರಣ", ta: "இயற்கை கட்டுப்பாடு", mr: "सेंद्रिय नियंत्रण" } },
      { slug: "pest-traps", names: { en: "Traps & lures", hi: "ट्रैप और ल्यूर", te: "బోనులు మరియు ఆకర్షకాలు", kn: "ಬಲೆ ಮತ್ತು ಆಕರ್ಷಕಗಳು", ta: "வலைகள் மற்றும் ஈர்ப்பான்கள்", mr: "ट्रॅप व ल्यूर" } },
      { slug: "neem", names: { en: "Neem products", hi: "नीम उत्पाद", te: "వేప ఉత్పత్తులు", kn: "ಬೇವಿನ ಉತ್ಪನ್ನಗಳು", ta: "வேப்பமர பொருட்கள்", mr: "कडुनिंब उत्पादने" } },
    ],
  },
  {
    slug: "landscaping", emoji: "🌳", gstRate: 5,
    names: { en: "Landscaping", hi: "लैंडस्केपिंग", te: "ల్యాండ్‌స్కేపింగ్", kn: "ಲ್ಯಾಂಡ್‌ಸ್ಕೇಪಿಂಗ್", ta: "நிலத்தோற்றம்", mr: "लँडस्केपिंग" },
    subs: [
      { slug: "lawn-grass", names: { en: "Lawn grass", hi: "लॉन घास", te: "లాన్ గడ్డి", kn: "ಹುಲ್ಲುಹಾಸು", ta: "புல்வெளி புல்", mr: "हिरवळ गवत" } },
      { slug: "hedges", names: { en: "Hedge & boundary", hi: "बाड़ और सीमा", te: "వేలి మరియు సరిహద్దు", kn: "ಬೇಲಿ ಮತ್ತು ಗಡಿ", ta: "வேலி மற்றும் எல்லை", mr: "मोठ व सीमा" } },
      { slug: "avenue-trees", names: { en: "Avenue & shade trees", hi: "एवेन्यू और छाया के पेड़", te: "అవెన్యూ మరియు నీడ చెట్లు", kn: "ದಾರಿ ಮತ್ತು ನೆರಳಿನ ಮರಗಳು", ta: "சாலை மற்றும் நிழல் மரங்கள்", mr: "रस्ता व सावलीची झाडे" } },
      { slug: "ground-covers", names: { en: "Ground covers", hi: "ज़मीन को ढकने वाले पौधे", te: "నేలను కప్పే మొక్కలు", kn: "ನೆಲ ಹೊದಿಕೆ ಗಿಡಗಳು", ta: "நிலமூடி செடிகள்", mr: "जमिनीला झाकणारी झाडे" } },
    ],
  },
  {
    slug: "decor", emoji: "🪨", gstRate: 18,
    names: { en: "Garden decor", hi: "गार्डन डेकोर", te: "తోట అలంకారం", kn: "ಉದ್ಯಾನ ಅಲಂಕಾರ", ta: "தோட்ட அலங்காரம்", mr: "बाग सजावट" },
    subs: [
      { slug: "pebbles-stones", names: { en: "Pebbles & stones", hi: "कंकड़ और पत्थर", te: "కంకర మరియు రాళ్లు", kn: "ಸಣ್ಣ ಕಲ್ಲುಗಳು", ta: "கூழாங்கல் மற்றும் கற்கள்", mr: "खडू व दगड" } },
      { slug: "garden-figures", names: { en: "Figurines & art", hi: "मूर्तियाँ और कला", te: "బొమ్మలు మరియు కళాఖండాలు", kn: "ಪ್ರತಿಮೆ ಮತ್ತು ಕಲೆ", ta: "சிலைகள் மற்றும் கலை", mr: "मूर्ती व कला" } },
      { slug: "edging-fences", names: { en: "Edging & mini fences", hi: "एजिंग और छोटी बाड़", te: "అంచులు మరియు చిన్న వేలులు", kn: "ಅಂಚು ಮತ್ತು ಸಣ್ಣ ಬೇಲಿ", ta: "விளிம்பு மற்றும் சிறிய வேலி", mr: "कडा व लहान कुंपण" } },
    ],
  },
  {
    slug: "irrigation", emoji: "💧", gstRate: 18,
    names: { en: "Watering & irrigation", hi: "सिंचाई", te: "నీటి పారుదల", kn: "ನೀರಾವರಿ", ta: "பாசனம்", mr: "सिंचन" },
    subs: [
      { slug: "drip-kits", names: { en: "Drip kits", hi: "ड्रिप किट", te: "డ్రిప్ కిట్‌లు", kn: "ಡ್ರಿಪ್ ಕಿಟ್‌ಗಳು", ta: "சொட்டு நீர் கிட்டுகள்", mr: "ठिबक किट" } },
      { slug: "sprinklers", names: { en: "Sprinklers", hi: "स्प्रिंकलर", te: "స్ప్రింక్లర్లు", kn: "ಸ್ಪ್ರಿಂಕ್ಲರ್‌ಗಳು", ta: "தெளிப்பான்கள்", mr: "स्प्रिंकलर" } },
      { slug: "hoses-fittings", names: { en: "Hoses & fittings", hi: "नली और फिटिंग", te: "గొట్టాలు మరియు ఫిట్టింగ్‌లు", kn: "ಕೊಳವೆ ಮತ್ತು ಸಂಪರ್ಕಕಗಳು", ta: "குழாய் மற்றும் பாகங்கள்", mr: "नळ्या व फिटिंग्ज" } },
    ],
  },
  {
    slug: "gifts", emoji: "🎁", gstRate: 18,
    names: { en: "Plant gifts", hi: "पौधा उपहार", te: "మొక్కల బహుమతులు", kn: "ಗಿಡಗಳ ಉಡುಗೊರೆ", ta: "செடி பரிசுகள்", mr: "झाडे भेटवस्तू" },
    subs: [
      { slug: "plant-gifts", names: { en: "Plant gift sets", hi: "पौधा गिफ्ट सेट", te: "మొక్క గిఫ్ట్ సెట్‌లు", kn: "ಗಿಡ ಉಡುಗೊರೆ ಸೆಟ್", ta: "செடி பரிசு தொகுப்பு", mr: "झाड गिफ्ट सेट" } },
      { slug: "festive-hampers", names: { en: "Festive hampers", hi: "त्योहारी हैम्पर", te: "పండుగ హ్యాంపర్లు", kn: "ಹಬ್ಬದ ಹ್ಯಾಂಪರ್", ta: "பண்டிகை கூடைகள்", mr: "सणाची हॅम्पर" } },
    ],
  },
];

const LEGACY_KEYS = ["plants", "saplings", "inputs", "pots", "tools"];

async function main() {
  // Sanity: globally unique slugs in TREE.
  const allSlugs = TREE.flatMap((t) => [t.slug, ...t.subs.map((s) => s.slug)]);
  const dupes = allSlugs.filter((s, i) => allSlugs.indexOf(s) !== i);
  if (dupes.length > 0) {
    throw new Error(`Duplicate slugs in TREE: ${dupes.join(", ")}`);
  }

  let tops = 0;
  let subs = 0;
  for (const [ti, top] of TREE.entries()) {
    await prisma.category.upsert({
      where: { slug: top.slug },
      create: {
        slug: top.slug, parentId: null, names: top.names, emoji: top.emoji,
        gstRate: top.gstRate, legacyKey: top.legacyKey ?? null, sortOrder: (ti + 1) * 10,
      },
      update: {
        parentId: null, names: top.names, emoji: top.emoji,
        gstRate: top.gstRate, legacyKey: top.legacyKey ?? null, sortOrder: (ti + 1) * 10,
      },
    });
    tops += 1;

    const topRow = await prisma.category.findUniqueOrThrow({ where: { slug: top.slug } });
    for (const [si, sub] of top.subs.entries()) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        create: {
          slug: sub.slug, parentId: topRow.id, names: sub.names,
          gstRate: null, legacyKey: null, sortOrder: (si + 1) * 10,
        },
        update: {
          parentId: topRow.id, names: sub.names,
          gstRate: null, legacyKey: null, sortOrder: (si + 1) * 10,
        },
      });
      subs += 1;
    }
  }

  console.log(`Seeded ${tops} top-level + ${subs} sub categories (${tops + subs} total).`);

  // Verification: legacy coverage + tree print.
  const rows = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    select: { id: true, slug: true, parentId: true, names: true, emoji: true, gstRate: true, legacyKey: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const withLegacy = rows.filter((r) => r.legacyKey !== null).map((r) => r.legacyKey);
  const missing = LEGACY_KEYS.filter((k) => !withLegacy.includes(k));
  const extra = withLegacy.filter((k) => !LEGACY_KEYS.includes(k));
  if (missing.length > 0 || extra.length > 0) {
    console.log(`  ⚠ legacyKey mismatch — missing: ${missing.join(", ") || "none"}; unexpected: ${extra.join(", ") || "none"}`);
  } else {
    console.log(`  ✔ all 5 legacy category keys map to a top: ${withLegacy.join(", ")}`);
  }

  console.log("");
  console.log("Tree (slug | gst | en name):");
  for (const t of TREE) {
    const trow = rows.find((r) => r.slug === t.slug);
    const gst = trow?.gstRate === null ? "inherit" : `${trow?.gstRate}%`;
    const legacy = t.legacyKey ? ` [legacy:${t.legacyKey}]` : "";
    console.log(`  ${t.emoji ?? "  "} ${t.slug} | ${gst}${legacy} — ${t.names.en}`);
    for (const s of t.subs) {
      console.log(`       - ${s.slug} — ${s.names.en}`);
    }
  }

  const dbTotal = await prisma.category.count();
  if (dbTotal !== tops + subs) {
    console.log("");
    console.log(`  ~ note: DB has ${dbTotal} categories total (${dbTotal - tops - subs} exist beyond this seed — left untouched).`);
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
