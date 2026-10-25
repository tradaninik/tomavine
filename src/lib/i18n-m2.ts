// ─────────────────────────────────────────────────────────────
// Mission M2 — Android shell dictionary (share row).
// Plain TS, no imports, inline type. Spread into the single DICT
// in src/lib/i18n.tsx (6 spread lines, one per language) after
// the DICT_PC spreads. Agents must not edit i18n.tsx directly.
// ─────────────────────────────────────────────────────────────

export const DICT_M2: Record<
  "en" | "hi" | "te" | "kn" | "ta" | "mr",
  Record<string, string>
> = {
  en: {
    share: "Share",
    share_whatsapp: "Share on WhatsApp",
    copy_link: "Copy link",
    link_copied: "Link copied",
  },
  hi: {
    share: "शेयर करें",
    share_whatsapp: "WhatsApp पर शेयर करें",
    copy_link: "लिंक कॉपी करें",
    link_copied: "लिंक कॉपी हो गया",
  },
  te: {
    share: "షేర్ చేయండి",
    share_whatsapp: "WhatsAppలో షేర్ చేయండి",
    copy_link: "లింక్ కాపీ చేయండి",
    link_copied: "లింక్ కాపీ అయ్యింది",
  },
  kn: {
    share: "ಹಂಚಿಕೊಳ್ಳಿ",
    share_whatsapp: "WhatsApp ಮೂಲಕ ಹಂಚಿಕೊಳ್ಳಿ",
    copy_link: "ಲಿಂಕ್ ಕಾಪಿ ಮಾಡಿ",
    link_copied: "ಲಿಂಕ್ ಕಾಪಿ ಆಗಿದೆ",
  },
  ta: {
    share: "பகிர்",
    share_whatsapp: "WhatsApp-இல் பகிர்",
    copy_link: "இணைப்பை நகலெடு",
    link_copied: "இணைப்பு நகலெடுக்கப்பட்டது",
  },
  mr: {
    share: "शेअर करा",
    share_whatsapp: "WhatsApp वर शेअर करा",
    copy_link: "लिंक कॉपी करा",
    link_copied: "लिंक कॉपी झाले",
  },
};
