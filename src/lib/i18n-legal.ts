// ─────────────────────────────────────────────────────────────
// Mission D — legal & disclaimers dictionary (storefront).
// Plain TS, no imports, inline type. Spread into the single
// DICT in src/lib/i18n.tsx (6 spread lines, one per language)
// right after the install_* PWA keys. Missing keys fall back
// to English at runtime — but keep all six blocks in sync.
// ─────────────────────────────────────────────────────────────

export const DICT_LEGAL: Record<
  "en" | "hi" | "te" | "kn" | "ta" | "mr",
  Record<string, string>
> = {
  en: {
    legal_footer_note:
      "Live plants are perishable — inspect on delivery. Nurseries are the sellers of record.",
    legal_product_note:
      "Photos are representative; live plants vary in size, shape and colour. Growth depends on your climate, soil and care.",
    legal_advisor_note:
      "Guidance is general information, not a guarantee — results depend on local conditions.",
    legal_checkout_note:
      "Live plants are perishable. Please inspect them at delivery before accepting.",
    legal_marketplace_note:
      "Nurseries are independent sellers; Tomavine is the marketplace platform.",
    legal_eta_note: "Delivery times depend on weather and location.",
    legal_rescue_note:
      "Rescue deals are nursery clearance stock, discounted for season, size or cosmetic imperfections — read each listing. Transit damage is still covered by the refund policy.",
    legal_accept_label:
      "I understand live plants are perishable and I accept the delivery/inspection terms",
    legal_accept_link: "Refund & replacement policy",
  },
  hi: {
    legal_footer_note:
      "जीवित पौधे नाशवान होते हैं — डिलीवरी के समय जाँच कर लें। नर्सरियाँ ही वास्तविक विक्रेता हैं।",
    legal_product_note:
      "फ़ोटो केवल प्रतिनिधि हैं; जीवित पौधों का आकार, रूप और रंग अलग-अलग हो सकता है। वृद्धि आपके मौसम, मिट्टी और देखभाल पर निर्भर करती है।",
    legal_advisor_note:
      "यह मार्गदर्शन सामान्य जानकारी है, कोई गारंटी नहीं — परिणाम स्थानीय परिस्थितियों पर निर्भर करते हैं।",
    legal_checkout_note:
      "जीवित पौधे नाशवान होते हैं। कृपया स्वीकार करने से पहले डिलीवरी के समय उनकी जाँच कर लें।",
    legal_marketplace_note:
      "नर्सरियाँ स्वतंत्र विक्रेता हैं; Tomavine केवल एक मार्केटप्लेस मंच है।",
    legal_eta_note: "डिलीवरी का समय मौसम और स्थान पर निर्भर करता है।",
    legal_rescue_note:
      "रेस्क्यू डील नर्सरी का क्लियरेंस स्टॉक है — मौसम, आकार या दिखावट की खामियों के कारण छूट पर; हर लिस्टिंग ज़रूर पढ़ें। ट्रांज़िट में हुई क्षति रिफंड नीति के अंतर्गत आती है।",
    legal_accept_label:
      "मैं समझता/समझती हूँ कि जीवित पौधे नाशवान होते हैं और मैं डिलीवरी/निरीक्षण की शर्तें स्वीकार करता/करती हूँ",
    legal_accept_link: "रिफंड और रिप्लेसमेंट नीति",
  },
  te: {
    legal_footer_note:
      "సజీవ మొక్కలు త్వరగా చెడిపోతాయి — డెలివరీ సమయంలో తనిఖీ చేసుకోండి. నర్సరీలే అసలైన విక్రేతలు.",
    legal_product_note:
      "ఫోటోలు కేవలం ప్రతినిధి చిత్రాలు; సజీవ మొక్కల పరిమాణం, ఆకారం, రంగు మారవచ్చు. పెరుగుదల మీ వాతావరణం, నేల మరియు సంరక్షణపై ఆధారపడుతుంది.",
    legal_advisor_note:
      "ఈ మార్గదర్శనం సాధారణ సమాచారం మాత్రమే, హామీ కాదు — ఫలితాలు స్థానిక పరిస్థితులపై ఆధారపడతాయి.",
    legal_checkout_note:
      "సజీవ మొక్కలు త్వరగా చెడిపోతాయి. స్వీకరించే ముందు డెలివరీ సమయంలో వాటిని తనిఖీ చేసుకోండి.",
    legal_marketplace_note:
      "నర్సరీలు స్వతంత్ర విక్రేతలు; Tomavine కేవలం ఒక మార్కెట్‌ప్లేస్ వేదిక మాత్రమే.",
    legal_eta_note: "డెలివరీ సమయం వాతావరణం మరియు ప్రదేశంపై ఆధారపడుతుంది.",
    legal_rescue_note:
      "రెస్క్యూ డీల్స్ నర్సరీ క్లియరెన్స్ స్టాక్ — సీజన్, పరిమాణం లేదా కళాత్మక లోపాల కారణంగా తగ్గించిన ధరకు; ప్రతి లిస్టింగ్ చదవండి. రవాణలో జరిగిన నష్టం ఇప్పటికీ రీఫండ్ విధానం కిందకి వస్తుంది.",
    legal_accept_label:
      "సజీవ మొక్కలు త్వరగా చెడిపోతాయని నాకు తెలుసు మరియు డెలివరీ/తనిఖీ నిబంధనలను నేను అంగీకరిస్తున్నాను",
    legal_accept_link: "రీఫండ్ & రీప్లేస్‌మెంట్ విధానం",
  },
  kn: {
    legal_footer_note:
      "ಸಜೀವ ಗಿಡಗಳು ತ್ವರಿತವಾಗಿ ಕೆಟ್ಟುಹೋಗುತ್ತವೆ — ವಿತರಣೆಯ ಸಮಯದಲ್ಲಿ ಪರಿಶೀಲಿಸಿ. ನರ್ಸರಿಗಳೇ ನಿಜವಾದ ಮಾರಾಟಗಾರರು.",
    legal_product_note:
      "ಫೋಟೊಗಳು ಕೇವಲ ಪ್ರತಿನಿಧಿ ಚಿತ್ರಗಳು; ಸಜೀವ ಗಿಡಗಳ ಗಾತ್ರ, ಆಕಾರ ಮತ್ತು ಬಣ್ಣ ಬದಲಾಗಬಹುದು. ಬೆಳವಣಿಗೆ ನಿಮ್ಮ ಹವಾಗುಣ, ಮಣ್ಣು ಮತ್ತು ಆರೈಕೆಯನ್ನು ಅವಲಂಬಿಸಿದೆ.",
    legal_advisor_note:
      "ಈ ಮಾರ್ಗದರ್ಶನ ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ, ಖಾತರಿ ಅಲ್ಲ — ಫಲಿತಾಂಶಗಳು ಸ್ಥಳೀಯ ಪರಿಸ್ಥಿತಿಗಳನ್ನು ಅವಲಂಬಿಸಿವೆ.",
    legal_checkout_note:
      "ಸಜೀವ ಗಿಡಗಳು ತ್ವರಿತವಾಗಿ ಕೆಟ್ಟುಹೋಗುತ್ತವೆ. ಸ್ವೀಕರಿಸುವ ಮೊದಲು ವಿತರಣೆಯ ಸಮಯದಲ್ಲಿ ಅವನ್ನು ಪರಿಶೀಲಿಸಿ.",
    legal_marketplace_note:
      "ನರ್ಸರಿಗಳು ಸ್ವತಂತ್ರ ಮಾರಾಟಗಾರರು; Tomavine ಕೇವಲ ಒಂದು ಮಾರುಕಟ್ಟೆ ವೇದಿಕೆ ಮಾತ್ರ.",
    legal_eta_note: "ವಿತರಣೆಯ ಸಮಯ ಹವಾಮಾನ ಮತ್ತು ಸ್ಥಳವನ್ನು ಅವಲಂಬಿಸಿದೆ.",
    legal_rescue_note:
      "ರೆಸ್ಕ್ಯೂ ಡೀಲ್‌ಗಳು ನರ್ಸರಿ ಕ್ಲಿಯರೆನ್ಸ್ ಸ್ಟಾಕ್ — ಋತು, ಗಾತ್ರ ಅಥವಾ ಗೋಚರ ಲೋಪಗಳಿಗಾಗಿ ರಿಯಾಯಿತಿ ಬೆಲೆಗೆ; ಪ್ರತಿ ಪಟ್ಟಿಯನ್ನು ಓದಿ. ಸಾಗಣೆಯಲ್ಲಿ ಆದ ಹಾನಿ ಇನ್ನೂ ಮರುಪಾವತಿ ನೀತಿಯ ವ್ಯಾಪ್ತಿಗೆ ಬರುತ್ತದೆ.",
    legal_accept_label:
      "ಸಜೀವ ಗಿಡಗಳು ತ್ವರಿತವಾಗಿ ಕೆಟ್ಟುಹೋಗುತ್ತವೆ ಎಂದು ನನಗೆ ತಿಳಿದಿದೆ ಮತ್ತು ವಿತರಣೆ/ಪರಿಶೀಲನೆ ಷರತ್ತುಗಳನ್ನು ನಾನು ಒಪ್ಪುತ್ತೇನೆ",
    legal_accept_link: "ಮರುಪಾವತಿ ಮತ್ತು ಬದಲಿ ನೀತಿ",
  },
  ta: {
    legal_footer_note:
      "உயிருள்ள செடிகள் கெடக்கூடியவை — டெலிவரியின் போது சரிபார்க்கவும். நர்சரிகளே உண்மையான விற்பனையாளர்கள்.",
    legal_product_note:
      "புகைப்படங்கள் குறிப்பிடுவன மட்டுமே; உயிருள்ள செடிகளின் அளவு, வடிவம், நிறம் மாறுபடலாம். வளர்ச்சி உங்கள் தட்பவெப்பம், மண் மற்றும் பராமரிப்பைச் சார்ந்தது.",
    legal_advisor_note:
      "இந்த வழிகாட்டுதல் பொதுவான தகவல் மட்டுமே, உத்திராயம் அல்ல — முடிவுகள் உள்ளூர் நிலைமைகளைச் சார்ந்தவை.",
    legal_checkout_note:
      "உயிருள்ள செடிகள் கெடக்கூடியவை. ஏற்றுக்கொள்ளும் முன் டெலிவரியின் போது அவற்றைச் சரிபார்க்கவும்.",
    legal_marketplace_note:
      "நர்சரிகள் சுயாதீன விற்பனையாளர்கள்; Tomavine ஒரு சந்தைத் தளம் மட்டுமே.",
    legal_eta_note: "டெலிவரி நேரம் வானிலை மற்றும் இடத்தைச் சார்ந்தது.",
    legal_rescue_note:
      "ரெஸ்க்யூ டீல்கள் நர்சரி கிளியரன்ஸ் சரக்கு — பருவம், அளவு அல்லது தோற்றக் குறைபாடுகளுக்காக தள்ளுபடி விலையில்; ஒவ்வொரு பட்டியலையும் படிக்கவும். அனுப்புகையில் ஏற்பட்ட சேதம் இன்னும் ரீஃபண்ட் கொள்கையின் கீழ் வரும்.",
    legal_accept_label:
      "உயிருள்ள செடிகள் கெடக்கூடியவை என்று எனக்குத் தெரியும், மேலும் டெலிவரி/சரிபார்ப்பு விதிமுறைகளை நான் ஏற்கிறேன்",
    legal_accept_link: "ரீஃபண்ட் மற்றும் ரீப்லேஸ்மெண்ட் கொள்கை",
  },
  mr: {
    legal_footer_note:
      "जिवंत रोपे सडणारी असतात — डिलिव्हरीच्या वेळी तपासा. नर्सरीच मूळ विक्रेते आहेत.",
    legal_product_note:
      "फोटो केवळ प्रतिनिधी आहेत; जिवंत रोपांचा आकार, स्वरूप आणि रंग वेगवेगळा असू शकतो. वाढ तुमच्या हवामान, माती आणि काळजीवर अवलंबून असते.",
    legal_advisor_note:
      "हे मार्गदर्शन सामान्य माहिती आहे, हमी नाही — परिणाम स्थानिक परिस्थितींवर अवलंबून असतात.",
    legal_checkout_note:
      "जिवंत रोपे सडणारी असतात. स्वीकारण्यापूर्वी डिलिव्हरीच्या वेळी ती तपासा.",
    legal_marketplace_note:
      "नर्सरी स्वतंत्र विक्रेते आहेत; Tomavine हे केवळ एक मार्केटप्लेस मंच आहे.",
    legal_eta_note: "डिलिव्हरीचा वेळ हवामान आणि स्थानावर अवलंबून असतो.",
    legal_rescue_note:
      "रेस्क्यू डील्स नर्सरीचा क्लिअरन्स स्टॉक आहे — हंगाम, आकार किंवा दिसण्यातील दोषांमुळे सूट किंमतीत; प्रत्येक यादी वाचा. वाहतुकीत झालेली हानी अजूनही परतावा धोरणाच्या कक्षेत येते.",
    legal_accept_label:
      "जिवंत रोपे सडणारी असतात हे मला माहिती आहे आणि डिलिव्हरी/तपासणीच्या अटी मी मान्य करतो/करते",
    legal_accept_link: "परतावा आणि बदली धोरण",
  },
};
