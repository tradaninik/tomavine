"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
// Tomavine language layer (storefront).
// Six languages, chosen from the header pill, persisted in
// localStorage. Missing keys fall back to English, then to the
// key itself — pages never crash on a missing string.
// ─────────────────────────────────────────────────────────────

export type Lang = "en" | "hi" | "te" | "kn" | "ta" | "mr";

export const LANG_KEY = "tomavine_lang";

export const LANGS: { code: Lang; short: string; label: string }[] = [
  { code: "en", short: "EN", label: "English" },
  { code: "hi", short: "हिं", label: "हिन्दी" },
  { code: "te", short: "తె", label: "తెలుగు" },
  { code: "kn", short: "ಕನ್", label: "ಕನ್ನಡ" },
  { code: "ta", short: "த", label: "தமிழ்" },
  { code: "mr", short: "मरा", label: "मराठी" },
];

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    hero_eyebrow: "One shop for all nursery needs",
    hero_t: "Plants, saplings & garden care from real nurseries",
    hero_s: "For homes, farmers and landscapers — retail plants, saplings by the tray, organic inputs and monthly garden care, from physically-verified nurseries near you.",
    search_ph: "Search plants, saplings, pots, jeevamrutam…",
    trust_verified: "Physically verified nurseries",
    trust_cod: "Cash on delivery",
    trust_delivery: "Doorstep delivery",
    browse: "Browse the shop",
    fresh: "Fresh from our nurseries",
    featured: "Featured nurseries",
    view_all: "View all",
    shop_by_category: "Shop by category",
    plants: "Plants",
    saplings: "Saplings",
    inputs: "Organic inputs",
    pots: "Pots",
    tools: "Tools",
    nurseries: "Nurseries",
    rescue: "Rescue Corner",
    rescue_pitch: "Plants that need a home — rescue them at a discount before their time is up.",
    cart: "Cart",
    login: "Login",
    my_orders: "My Orders",
    add_to_cart: "Add to cart",
    added: "Added to cart",
    out_of_stock: "Out of stock",
    in_stock: "In stock",
    only_left: "Only {n} left",
    sell_title: "Selling? Run your whole nursery from WhatsApp.",
    sell_s: "New orders arrive as WhatsApp alerts. Reply to accept or reject — and track everything in your seller dashboard.",
    nursery_login: "Nursery login",
    pincode: "Pincode",
    delivers_to: "Delivers to {pin}",
    products_count: "{n} products",
    starts_at: "Starts at",
    qty: "Qty",
    go_to_cart: "View cart",
    rescue_ends: "price ends",
    care: "Care",
    per_acre: "Per-acre guidance",
    origin: "Provenance",
    reviews: "reviews",
    no_reviews: "No reviews yet — be the first after your next order.",
    nursery_reply: "Nursery replied",
    bulk_enquiry: "Bulk / farmer enquiry",
    enquiry_s: "Need trays in bulk? Tell us the quantity and your city — the nursery replies with a quote.",
    qty_needed: "Quantity needed",
    company: "Company / farm name",
    city_label: "City",
    notes_opt: "Notes (optional)",
    send_enquiry: "Send enquiry",
    enquiry_sent: "Enquiry sent — the nursery will reply shortly.",
    login_to_enquire: "Login to send an enquiry",
    verified: "Verified",
    results_for: "Results for “{q}”",
    no_results: "Nothing matched your search.",
    load_error: "Could not load — please retry.",
    retry: "Retry",
    empty_cat: "Nothing here yet",
    rescue_s: "Give these plants a home — discounted while the listing lasts.",
    invalid_pin: "Enter a valid 6-digit pincode",
    clear: "Clear",
    pin_search: "Enter your pincode to see who delivers to you — nurseries far or near.",
  },
  hi: {
    hero_eyebrow: "नर्सरी की हर ज़रूरत, एक जगह",
    hero_t: "असली नर्सरियों से पौधे, नार्सरी पौधे और देखभाल",
    hero_s: "घर, किसान और लैंडस्केपर्स के लिए — पौधे, ट्रे में नार्सरी पौधे, जैविक इनपुट और मासिक देखभाल, फ़ील्ड-सत्यापित नर्सरियों से।",
    search_ph: "पौधे, नार्सरी पौधे, गमले, जीवामृत खोजें…",
    trust_verified: "फ़ील्ड-सत्यापित नर्सरियाँ",
    trust_cod: "कैश ऑन डिलीवरी",
    trust_delivery: "घर पर डिलीवरी",
    browse: "दुकान देखें",
    fresh: "हमारी नर्सरियों से ताज़ा",
    featured: "फ़ीचर्ड नर्सरी",
    view_all: "सभी देखें",
    shop_by_category: "श्रेणी से खरीदें",
    plants: "पौधे",
    saplings: "रोप",
    inputs: "जैविक इनपुट",
    pots: "गमले",
    tools: "औज़ार",
    nurseries: "नर्सरी",
    rescue: "रेस्क्यू कॉर्नर",
    rescue_pitch: "ऐसे पौधे जिन्हें घर चाहिए — समय रहते छूट पर उन्हें अपनाएँ।",
    cart: "कार्ट",
    login: "लॉगिन",
    my_orders: "मेरे ऑर्डर",
    add_to_cart: "कार्ट में डालें",
    added: "कार्ट में जोड़ा गया",
    out_of_stock: "स्टॉक खत्म",
    in_stock: "स्टॉक में",
    only_left: "केवल {n} बचे",
    sell_title: "बेचना चाहते हैं? अपनी पूरी नर्सरी WhatsApp से चलाएँ।",
    sell_s: "नए ऑर्डर WhatsApp अलर्ट के रूप में आते हैं। स्वीकार या अस्वीकार करने के लिए जवाब दें — और सब कुछ अपने सेलर डैशबोर्ड में ट्रैक करें।",
    nursery_login: "नर्सरी लॉगिन",
    pincode: "पिनकोड",
    delivers_to: "{pin} में डिलीवरी",
    products_count: "{n} उत्पाद",
    starts_at: "शुरुआत",
    qty: "मात्रा",
    go_to_cart: "कार्ट देखें",
    rescue_ends: "कीमत समाप्त",
    care: "देखभाल",
    per_acre: "प्रति-एकड़ मार्गदर्शन",
    origin: "उत्पत्ति",
    reviews: "समीक्षाएँ",
    no_reviews: "अभी तक कोई समीक्षा नहीं — अगली ऑर्डर के बाद पहली समीक्षा आपकी हो।",
    nursery_reply: "नर्सरी का जवाब",
    bulk_enquiry: "थोक / किसान पूछताछ",
    enquiry_s: "ट्रे थोक में चाहिए? मात्रा और शहर बताएँ — नर्सरी कोट भेजेगी।",
    qty_needed: "आवश्यक मात्रा",
    company: "कंपनी / फ़ार्म का नाम",
    city_label: "शहर",
    notes_opt: "टिप्पणी (वैकल्पिक)",
    send_enquiry: "पूछताछ भेजें",
    enquiry_sent: "पूछताछ भेज दी गई — नर्सरी जल्द जवाब देगी।",
    login_to_enquire: "पूछताछ भेजने के लिए लॉगिन करें",
    verified: "सत्यापित",
    results_for: "“{q}” के लिए परिणाम",
    no_results: "आपकी खोज से कुछ मेल नहीं खाया।",
    load_error: "लोड नहीं हुआ — कृपया फिर कोशिश करें।",
    retry: "फिर कोशिश करें",
    empty_cat: "अभी यहाँ कुछ नहीं है",
    rescue_s: "इन पौधों को घर दें — लिस्टिंग रहते तक छूट पर।",
    invalid_pin: "मान्य 6-अंकीय पिनकोड डालें",
    clear: "हटाएँ",
    pin_search: "अपना पिनकोड डालें और देखें कौन आप तक डिलीवरी करता है — दूर या पास, सभी नर्सरी।",
  },
  te: {
    hero_eyebrow: "నర్సరీ అవసరాలన్నీ ఒకే చోట",
    hero_t: "నిజమైన నర్సరీల నుండి మొక్కలు, నారు & సంరక్షణ",
    hero_s: "ఇళ్లు, రైతులు & ల్యాండ్‌స్కేపర్ల కోసం — మొక్కలు, ట్రే నారు, సేంద్రీయ ఇన్‌పుట్లు, నెలవారీ తోట సంరక్షణ — ఫీల్డ్-ధృవీకరించిన నర్సరీల నుండి.",
    search_ph: "మొక్కలు, నారు, కుండలు, జీవామృతం వెతకండి…",
    trust_verified: "ఫీల్డ్-ధృవీకరించిన నర్సరీలు",
    trust_cod: "క్యాష్ ఆన్ డెలివరీ",
    trust_delivery: "ఇంటికి డెలివరీ",
    browse: "షాప్ చూడండి",
    fresh: "మా నర్సరీల నుండి తాజా",
    featured: "ఫీచర్డ్ నర్సరీలు",
    view_all: "అన్నీ చూడండి",
    shop_by_category: "వర్గం ద్వారా కొనండి",
    plants: "మొక్కలు",
    saplings: "నారు",
    inputs: "సేంద్రీయ ఇన్‌పుట్లు",
    pots: "కుండలు",
    tools: "పనిముట్లు",
    nurseries: "నర్సరీలు",
    rescue: "రెస్క్యూ కార్నర్",
    rescue_pitch: "ఇల్లు కావాల్సిన మొక్కలు — సమయం ముగిసేలోపు తగ్గించిన ధరకు వాటిని దత్తత తీసుకోండి.",
    cart: "కార్టు",
    login: "లాగిన్",
    my_orders: "నా ఆర్డర్లు",
    add_to_cart: "కార్టులో వేయండి",
    added: "కార్టులో జోడించబడింది",
    out_of_stock: "స్టాక్ అయిపోయింది",
    in_stock: "స్టాక్‌లో ఉంది",
    only_left: "కేవలం {n} మిగిలినాయి",
    sell_title: "అమ్మాలా? మీ మొత్తం నర్సరీని WhatsApp ద్వారా నడపండి.",
    sell_s: "కొత్త ఆర్డర్లు WhatsApp అలర్ట్‌లుగా వస్తాయి. అంగీకరించడానికి లేదా తిరస్కరించడానికి ప్రత్యుత్తరం ఇవ్వండి — అన్నింటినీ మీ సెల్లర్ డాష్‌బోర్డ్‌లో ట్రాక్ చేయండి.",
    nursery_login: "నర్సరీ లాగిన్",
    pincode: "పిన్‌కోడ్",
    delivers_to: "{pin}కి డెలివరీ",
    products_count: "{n} ఉత్పత్తులు",
    starts_at: "ప్రారంభ ధర",
    qty: "పరిమాణం",
    go_to_cart: "కార్టు చూడండి",
    rescue_ends: "ధర ముగింపు",
    care: "సంరక్షణ",
    per_acre: "ప్రతి ఎకరా మార్గదర్శనం",
    origin: "మూలం",
    reviews: "సమీక్షలు",
    no_reviews: "ఇంకా సమీక్షలు లేవు — తర్వాతి ఆర్డర్ తర్వాత మొదటి సమీక్ష మీదే ఉండాలి.",
    nursery_reply: "నర్సరీ ప్రత్యుత్తరం",
    bulk_enquiry: "థోక / రైతు విచారణ",
    enquiry_s: "ట్రేలు థోకెగా కావాలా? పరిమాణం, నగరం చెప్పండి — నర్సరీ కోట్ పంపుతుంది.",
    qty_needed: "అవసరమైన పరిమాణం",
    company: "కంపెనీ / ఫారం పేరు",
    city_label: "నగరం",
    notes_opt: "గమనికలు (ఐచ్ఛికం)",
    send_enquiry: "విచారణ పంపండి",
    enquiry_sent: "విచారణ పంపబడింది — నర్సరీ త్వరలో ప్రత్యుత్తరం ఇస్తుంది.",
    login_to_enquire: "విచారణ పంపడానికి లాగిన్ చేయండి",
    verified: "ధృవీకరించబడిన",
    results_for: "“{q}” కోసం ఫలితాలు",
    no_results: "మీ శోధకు ఏదీ సరిపోలలేదు.",
    load_error: "లోడ్ కాలేదు — దయచేసి మళ్లీ ప్రయత్నించండి.",
    retry: "మళ్లీ ప్రయత్నించండి",
    empty_cat: "ఇంకా ఇక్కడ ఏమీ లేదు",
    rescue_s: "ఈ మొక్కలకు ఇల్లు ఇవ్వండి — లిస్టింగ్ ఉన్నంతవరకు తగ్గించిన ధరకు.",
    invalid_pin: "సరైన 6 అంకెల పిన్‌కోడ్ ఇవ్వండి",
    clear: "తీసెయ్యండి",
    pin_search: "మీ పిన్‌కోడ్ ఇచ్చి ఎవరు డెలివరీ చేస్తారో చూడండి — దూరంలో గానీ దగ్గరలో గానీ ఉన్న నర్సరీలు.",
  },
  kn: {
    hero_eyebrow: "ನರ್ಸರಿಯ ಎಲ್ಲ ಅಗತ್ಯಗಳು ಒಂದೇ ಕಡೆ",
    hero_t: "ನಿಜವಾದ ನರ್ಸರಿಗಳಿಂದ ಗಿಡ, ಸಸಿ & ಆರೈಕೆ",
    hero_s: "ಮನೆ, ರೈತರು ಮತ್ತು ಲ್ಯಾಂಡ್‌ಸ್ಕೇಪರ್‌ಗಳಿಗೆ — ಗಿಡ, ಟ್ರೇ ಸಸಿ, ಸಾವಯವ ಇನ್‌ಪುಟ್, ಮಾಸಿಕ ಆರೈಕೆ — ಕ್ಷೇತ್ರ-ಪರಿಶೀಲಿತ ನರ್ಸರಿಗಳಿಂದ.",
    search_ph: "ಸಸಿ, ಮೊಳಕೆ, ಮಡಕೆ, ಜೀವಾಮೃತ ಹುಡುಕಿ…",
    trust_verified: "ಕ್ಷೇತ್ರ-ಪರಿಶೀಲಿತ ನರ್ಸರಿಗಳು",
    trust_cod: "ಕ್ಯಾಶ್ ಆನ್ ಡೆಲಿವರಿ",
    trust_delivery: "ಮನೆಗೆ ಡೆಲಿವರಿ",
    browse: "ಅಂಗಡಿ ನೋಡಿ",
    fresh: "ನಮ್ಮ ನರ್ಸರಿಗಳಿಂದ ಹೊಸದು",
    featured: "ವಿಶೇಷ ನರ್ಸರಿಗಳು",
    view_all: "ಎಲ್ಲವನ್ನೂ ನೋಡಿ",
    shop_by_category: "ವರ್ಗದ ಮೂಲಕ ಖರೀದಿಸಿ",
    plants: "ಗಿಡಗಳು",
    saplings: "ಮೊಳಕೆ",
    inputs: "ಸಾವಯವ ಇನ್‌ಪುಟ್",
    pots: "ಮಡಕೆಗಳು",
    tools: "ಸಲಕರಣೆಗಳು",
    nurseries: "ನರ್ಸರಿಗಳು",
    rescue: "ರೆಸ್ಕ್ಯೂ ಕಾರ್ನರ್",
    rescue_pitch: "ಮನೆ ಬೇಕಿರುವ ಗಿಡಗಳು — ಸಮಯ ಮುಗಿಯುವ ಮೊದಲು ರಿಯಾಯಿತಿ ಬೆಲೆಗೆ ಅವುಗಳನ್ನು ದತ್ತು ತೆಗೆದುಕೊಳ್ಳಿ.",
    cart: "ಕಾರ್ಟ್",
    login: "ಲಾಗಿನ್",
    my_orders: "ನನ್ನ ಆರ್ಡರ್‌ಗಳು",
    add_to_cart: "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ",
    added: "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಲಾಗಿದೆ",
    out_of_stock: "ಸ್ಟಾಕ್ ಖಾಲಿ",
    in_stock: "ಸ್ಟಾಕ್‌ನಲ್ಲಿದೆ",
    only_left: "ಕೇವಲ {n} ಉಳಿದಿವೆ",
    sell_title: "ಮಾರಬೇಕೆ? ನಿಮ್ಮ ಇಡೀ ನರ್ಸರಿಯನ್ನು WhatsApp ನಿಂದ ನಡೆಸಿ.",
    sell_s: "ಹೊಸ ಆರ್ಡರ್‌ಗಳು WhatsApp ಅಲರ್ಟ್‌ಗಳಾಗಿ ಬರುತ್ತವೆ. ಸ್ವೀಕರಿಸಲು ಅಥವಾ ತಿರಸ್ಕರಿಸಲು ಉತ್ತರಿಸಿ — ಮತ್ತು ಎಲ್ಲವನ್ನೂ ನಿಮ್ಮ ಸೆಲ್ಲರ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.",
    nursery_login: "ನರ್ಸರಿ ಲಾಗಿನ್",
    pincode: "ಪಿನ್‌ಕೋಡ್",
    delivers_to: "{pin}ಗೆ ಡೆಲಿವರಿ",
    products_count: "{n} ಉತ್ಪನ್ನಗಳು",
    starts_at: "ಪ್ರಾರಂಭ ಬೆಲೆ",
    qty: "ಪ್ರಮಾಣ",
    go_to_cart: "ಕಾರ್ಟ್ ನೋಡಿ",
    rescue_ends: "ಬೆಲೆ ಅಂತ್ಯ",
    care: "ಆರೈಕೆ",
    per_acre: "ಪ್ರತಿ ಎಕರೆ ಮಾರ್ಗದರ್ಶನ",
    origin: "ಮೂಲ",
    reviews: "ವಿಮರ್ಶೆಗಳು",
    no_reviews: "ಇನ್ನೂ ವಿಮರ್ಶೆಗಳಿಲ್ಲ — ಮುಂದಿನ ಆರ್ಡರ್ ನಂತರ ಮೊದಲ ವಿಮರ್ಶೆ ನಿಮ್ಮದಾಗಲಿ.",
    nursery_reply: "ನರ್ಸರಿ ಉತ್ತರ",
    bulk_enquiry: "ಥೋಕ / ರೈತ ವಿಚಾರಣೆ",
    enquiry_s: "ಟ್ರೇಗಳು ಥೋಕೆಗೆ ಬೇಕೆ? ಪ್ರಮಾಣ ಮತ್ತು ನಗರ ಹೇಳಿ — ನರ್ಸರಿ ಉಲ್ಲೇಖ ಕಳುಹಿಸುತ್ತದೆ.",
    qty_needed: "ಅಗತ್ಯ ಪ್ರಮಾಣ",
    company: "ಕಂಪನಿ / ಫಾರ್ಮ್ ಹೆಸರು",
    city_label: "ನಗರ",
    notes_opt: "ಟಿಪ್ಪಣಿಗಳು (ಐಚ್ಛಿಕ)",
    send_enquiry: "ವಿಚಾರಣೆ ಕಳುಹಿಸಿ",
    enquiry_sent: "ವಿಚಾರಣೆ ಕಳುಹಿಸಲಾಗಿದೆ — ನರ್ಸರಿ ಶೀಘ್ರ ಉತ್ತರಿಸುತ್ತದೆ.",
    login_to_enquire: "ವಿಚಾರಣೆ ಕಳುಹಿಸಲು ಲಾಗಿನ್ ಮಾಡಿ",
    verified: "ಧೃಢೀಕೃತ",
    results_for: "“{q}” ಗಾಗಿ ಫಲಿತಾಂಶಗಳು",
    no_results: "ನಿಮ್ಮ ಹುಡುಕಿಗೆ ಯಾವುದೂ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ.",
    load_error: "ಲೋಡ್ ಆಗಲಿಲ್ಲ — ದಯವಿಟ್ಟು ಮರುಪ್ರಯತ್ನಿಸಿ.",
    retry: "ಮರುಪ್ರಯತ್ನಿಸಿ",
    empty_cat: "ಇನ್ನೂ ಇಲ್ಲಿ ಏನೂ ಇಲ್ಲ",
    rescue_s: "ಈ ಗಿಡಗಳಿಗೆ ಮನೆ ಕೊಡಿ — ಪಟ್ಟಿ ಇರುವವರೆಗೆ ರಿಯಾಯಿತಿ ಬೆಲೆಗೆ.",
    invalid_pin: "ಸರಿಯಾದ 6 ಅಂಕಿಯ ಪಿನ್‌ಕೋಡ್ ನೀಡಿ",
    clear: "ತೆಗೆಯಿರಿ",
    pin_search: "ನಿಮ್ಮ ಪಿನ್‌ಕೋಡ್ ನೀಡಿ ಯಾರು ಡೆಲಿವರಿ ಮಾಡುತ್ತಾರೆಂದು ನೋಡಿ — ದೂರ ಅಥವಾ ಹತ್ತಿರದ ನರ್ಸರಿಗಳು.",
  },
  ta: {
    hero_eyebrow: "நர்சரி தேவைகள் அனைத்தும் ஒரே இடத்தில்",
    hero_t: "உண்மையான நர்சரிகளிலிருந்து செடி, நாற்று & பராமரிப்பு",
    hero_s: "வீடு, விவசாயி மற்றும் லேண்ட்ஸ்கேப்பர்களுக்கு — செடிகள், தட்டு நாற்று, இயற்கை உள்ளீடு, மாத பராமரிப்பு — நேரடி சரிபார்க்கப்பட்ட நர்சரிகளிலிருந்து.",
    search_ph: "நாற்று, செடிகள், சட்டி, ஜீவாமிர்தம் தேடுங்கள்…",
    trust_verified: "நேரடி சரிபார்க்கப்பட்ட நர்சரிகள்",
    trust_cod: "கேஷ் ஆன் டெலிவரி",
    trust_delivery: "வீட்டுக்கு டெலிவரி",
    browse: "கடையைப் பார்க்க",
    fresh: "நமது நர்சரிகளிலிருந்து புதியவை",
    featured: "சிறப்பு நர்சரிகள்",
    view_all: "அனைத்தையும் பார்",
    shop_by_category: "வகைப்படி வாங்க",
    plants: "செடிகள்",
    saplings: "நாற்று",
    inputs: "இயற்கை உள்ளீடுகள்",
    pots: "சட்டிகள்",
    tools: "கருவிகள்",
    nurseries: "நர்சரிகள்",
    rescue: "ரெஸ்க்யூ கார்னர்",
    rescue_pitch: "வீடு தேவைப்படும் செடிகள் — நேரம் முடிவதற்குள் தள்ளுபடியில் அவற்றை தத்தெடுங்கள்.",
    cart: "கார்ட்",
    login: "உள்நுழை",
    my_orders: "என் ஆர்டர்கள்",
    add_to_cart: "கார்டில் சேர்",
    added: "கார்டில் சேர்க்கப்பட்டது",
    out_of_stock: "கையிருப்பு இல்லை",
    in_stock: "கையிருப்பில்",
    only_left: "மட்டும் {n} மீதம்",
    sell_title: "விற்கவா? உங்கள் முழு நர்சரியை WhatsApp மூலம் இயக்குங்கள்.",
    sell_s: "புதிய ஆர்டர்கள் WhatsApp அலர்ட்களாக வரும். ஏற்கவும் நிராகரிக்கவும் பதில் அனுப்புங்கள் — அனைத்தையும் உங்கள் செல்லர் டாஷ்போர்டில் கண்காணியுங்கள்.",
    nursery_login: "நர்சரி உள்நுழைவு",
    pincode: "பின்கோட்",
    delivers_to: "{pin}க்கு டெலிவரி",
    products_count: "{n} பொருட்கள்",
    starts_at: "தொடக்க விலை",
    qty: "அளவு",
    go_to_cart: "கார்டைப் பார்",
    rescue_ends: "விலை முடிவு",
    care: "பராமரிப்பு",
    per_acre: "ஏக்கருக்கான வழிகாட்டி",
    origin: "மூலம்",
    reviews: "விமர்சனங்கள்",
    no_reviews: "இன்னும் விமர்சனங்கள் இல்லை — அடுத்த ஆர்டருக்குப் பிறகு முதல் விமர்சனம் உங்களுடையதாக இருங்கள்.",
    nursery_reply: "நர்சரியின் பதில்",
    bulk_enquiry: "மொத்த / விவசாயி விசாரணை",
    enquiry_s: "தட்டுகள் மொத்தமாக வேண்டுமா? அளவு மற்றும் நகரத்தைச் சொல்லுங்கள் — நர்சரி மேற்கோள் அனுப்பும்.",
    qty_needed: "தேவையான அளவு",
    company: "நிறுவனம் / பண்ணை பெயர்",
    city_label: "நகரம்",
    notes_opt: "குறிப்புகள் (விருப்பம்)",
    send_enquiry: "விசாரணை அனுப்பு",
    enquiry_sent: "விசாரணை அனுப்பப்பட்டது — நர்சரி விரைவில் பதிலளிக்கும்.",
    login_to_enquire: "விசாரணை அனுப்ப உள்நுழையுங்கள்",
    verified: "சரிபார்க்கப்பட்ட",
    results_for: "“{q}” க்கான முடிவுகள்",
    no_results: "உங்கள் தேடலுடன் எதுவும் பொருந்தவில்லை.",
    load_error: "ஏற்ற முடியவில்லை — மீண்டும் முயற்சிக்கவும்.",
    retry: "மீண்டும் முயற்சி",
    empty_cat: "இன்னும் இங்கே எதுவும் இல்லை",
    rescue_s: "இந்த செடிகளுக்கு வீடு கொடுங்கள் — பட்டியல் இருக்கும் வரை தள்ளுபடியில்.",
    invalid_pin: "சரியான 6 இலக்க பின்கோடை உள்ளிடுங்கள்",
    clear: "அகற்று",
    pin_search: "உங்கள் பின்கோடை உள்ளிடுங்கள் — தூரத்திலும் அருகிலும் யார் டெலிவரி செய்கிறார்கள் என்று பாருங்கள்.",
  },
  mr: {
    hero_eyebrow: "नर्सरीच्या सर्व गरजा एकाच ठिकाणी",
    hero_t: "खऱ्या नर्सरींमधून झाडे, रोपे व काळजी",
    hero_s: "घर, शेतकरी आणि लॅन्डस्केपरसाठी — झाडे, ट्रे रोपे, सेंद्रिय इनपुट, मासिक काळजी — फील्ड-पडताळलेल्या नर्सरींमधून.",
    search_ph: "रोपे, झाडे, गमले, जीवामृत शोधा…",
    trust_verified: "फील्ड-पडताळलेल्या नर्सरी",
    trust_cod: "कॅश ऑन डिलिव्हरी",
    trust_delivery: "घरी डिलिव्हरी",
    browse: "दुकान पहा",
    fresh: "आमच्या नर्सरींमधून ताजे",
    featured: "विशेष नर्सरी",
    view_all: "सर्व पहा",
    shop_by_category: "श्रेणीनुसार खरेदी",
    plants: "झाडे",
    saplings: "रोपे",
    inputs: "सेंद्रिय इनपुट",
    pots: "गमले",
    tools: "औजारे",
    nurseries: "नर्सरी",
    rescue: "रेस्क्यू कॉर्नर",
    rescue_pitch: "घर हवे असलेले झाडे — वेळ संपण्यापूर्वी सूटमध्ये त्यांना दत्तक घ्या.",
    cart: "कार्ट",
    login: "लॉगिन",
    my_orders: "माझे ऑर्डर",
    add_to_cart: "कार्टमध्ये टाका",
    added: "कार्टमध्ये जोडले",
    out_of_stock: "स्टॉक संपला",
    in_stock: "स्टॉकमध्ये",
    only_left: "फक्त {n} शिल्लक",
    sell_title: "विकायचंय? तुमची संपूर्ण नर्सरी WhatsApp वरून चालवा.",
    sell_s: "नवीन ऑर्डर WhatsApp अलर्टस्वरूप येतात. स्वीकारण्यासाठी किंवा नाकारण्यासाठी उत्तर द्या — आणि सर्व काही तुमच्या सेलर डॅशबोर्डमध्ये ट्रॅक करा.",
    nursery_login: "नर्सरी लॉगिन",
    pincode: "पिनकोड",
    delivers_to: "{pin} मध्ये डिलिव्हरी",
    products_count: "{n} उत्पादने",
    starts_at: "सुरुवातीची किंमत",
    qty: "प्रमाण",
    go_to_cart: "कार्ट पहा",
    rescue_ends: "किंमत समाप्त",
    care: "काळजी",
    per_acre: "प्रति एकर मार्गदर्शन",
    origin: "उगम",
    reviews: "समीक्षा",
    no_reviews: "अजून कोणतीही समीक्षा नाही — पुढील ऑर्डरनंतर पहिली समीक्षा तुमची असो.",
    nursery_reply: "नर्सरीचे उत्तर",
    bulk_enquiry: "थोक / शेतकरी चौकशी",
    enquiry_s: "ट्रे थोकात हव्यात? प्रमाण आणि शहर सांगा — नर्सरी कोट पाठवेल.",
    qty_needed: "आवश्यक प्रमाण",
    company: "कंपनी / शेताचे नाव",
    city_label: "शहर",
    notes_opt: "टिपा (ऐच्छिक)",
    send_enquiry: "चौकशी पाठवा",
    enquiry_sent: "चौकशी पाठवली — नर्सरी लवकरच उत्तर देईल.",
    login_to_enquire: "चौकशी पाठवण्यासाठी लॉगिन करा",
    verified: "पडताळलेले",
    results_for: "“{q}” साठी परिणाम",
    no_results: "तुमच्या शोधाशी काहीही जुळले नाही.",
    load_error: "लोड झाले नाही — कृपया पुन्हा प्रयत्न करा.",
    retry: "पुन्हा प्रयत्न करा",
    empty_cat: "अजून येथे काहीही नाही",
    rescue_s: "या झाडांना घर द्या — यादी असेपर्यंत सूटीत.",
    invalid_pin: "वैध 6-अंकी पिनकोड टाका",
    clear: "काढा",
    pin_search: "तुमचा पिनकोड टाका आणि कोण डिलिव्हरी करते पहा — लांब किंवा जवळच्या नर्सरी.",
  },
};

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved !== null && LANGS.some((l) => l.code === saved)) {
      setLangState(saved as Lang);
    }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      // private browsing — keep the choice in memory only
    }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split("{" + k + "}").join(String(v));
      }
    }
    return s;
  }

  return (
    <Ctx.Provider value={{ lang: lang, setLang: setLang, t: t }}>{children}</Ctx.Provider>
  );
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    const fallback: LangCtx = {
      lang: "en",
      setLang: () => undefined,
      t: (key) => DICT.en[key] ?? key,
    };
    return fallback;
  }
  return ctx;
}

export function displayName(names: unknown, lang: Lang, fallback: string): string {
  if (names !== null && typeof names === "object" && !Array.isArray(names)) {
    const map = names as Record<string, unknown>;
    const value = map[lang];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return fallback;
}

export function LangPill() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div className="relative">
      {open ? (
        <button
          type="button"
          aria-hidden="true"
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-[#1C3A2A]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#1C3A2A] transition hover:border-[#2F6B3F]"
        aria-label="Change language"
      >
        <span aria-hidden="true">🌐</span>
        <span>{current.short}</span>
        <span aria-hidden="true" className={open ? "transition rotate-180" : "transition"}>
          ▾
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-2xl border border-[#1C3A2A]/10 bg-white py-1 shadow-xl">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={
                l.code === lang
                  ? "flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold bg-[#EDF2E6] text-[#2F6B3F]"
                  : "flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-[#20291D] hover:bg-[#F7F3E8]"
              }
            >
              <span className="w-10 text-xs font-bold text-[#66735F]">{l.short}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}