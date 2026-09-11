// ============================================================
// Suraksha Setu — Bilingual Internationalization Engine (EN / HI)
// ============================================================

export type Language = 'en' | 'hi';

export interface TranslationDict {
  appName: string;
  subTitle: string;
  tagline: string;
  nav: {
    map: string;
    report: string;
    alerts: string;
    weather: string;
    track: string;
    safety: string;
    authorities: string;
    signIn: string;
    openPlatform: string;
  };
  hero: {
    headlineLine1: string;
    headlineLine2: string;
    supportingText: string;
    viewRisk: string;
    reportHazard: string;
    scrollHint: string;
  };
  metrics: {
    activeAlerts: string;
    reportsToday: string;
    underReview: string;
    stationsOnline: string;
  };
  hazards: {
    FLOODING: string;
    WATERLOGGING: string;
    SEVERE_RAIN: string;
    STRONG_WIND: string;
    HAIL: string;
    CLOUDBURST: string;
    OTHER: string;
  };
  severities: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  };
  reportWizard: {
    stepCategory: string;
    stepCategoryDesc: string;
    stepSeverity: string;
    stepSeverityDesc: string;
    stepLocation: string;
    stepLocationDesc: string;
    stepDetails: string;
    stepDetailsDesc: string;
    stepReview: string;
    useGps: string;
    gpsAcquiring: string;
    attachPhoto: string;
    photoCompressed: string;
    consentText: string;
    submitReport: string;
    submitting: string;
    offlineNotice: string;
  };
  track: {
    title: string;
    subtitle: string;
    inputPlaceholder: string;
    trackBtn: string;
    statusReceived: string;
    statusReview: string;
    statusVerified: string;
    statusResolved: string;
  };
  alerts: {
    title: string;
    subtitle: string;
    filterAll: string;
    filterCritical: string;
    validUntil: string;
    safetyInstructions: string;
    affectedArea: string;
    exportCap: string;
  };
  weather: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    stateMonitor: string;
    currentTelemetry: string;
    rainRate: string;
    windSpeed: string;
    humidity: string;
    pressure: string;
    threatNormal: string;
    threatWatch: string;
    threatWarning: string;
    threatCritical: string;
  };
}

export const translations: Record<Language, TranslationDict> = {
  en: {
    appName: 'SURAKSHA SETU',
    subTitle: 'National Hyperlocal Weather & Disaster Alert Platform',
    tagline: 'Weather clarity. When every minute matters.',
    nav: {
      map: 'Live Risk Map',
      report: 'Report Hazard',
      alerts: 'Official Alerts',
      weather: 'All-India Weather',
      track: 'Track Report',
      safety: 'Safety Protocols',
      authorities: 'For Authorities',
      signIn: 'Sign In',
      openPlatform: 'Open Platform →',
    },
    hero: {
      headlineLine1: 'Weather clarity.',
      headlineLine2: 'When every minute matters.',
      supportingText:
        'Verified citizen ground reports and Doppler radar intelligence for safer local decisions across India.',
      viewRisk: 'View local risk',
      reportHazard: 'Report a hazard',
      scrollHint: 'Scroll to descend through weather layers',
    },
    metrics: {
      activeAlerts: 'Active National Alerts',
      reportsToday: 'Verified Ground Reports Today',
      underReview: 'Incidents Under Review',
      stationsOnline: 'Doppler & AWS Stations Active',
    },
    hazards: {
      FLOODING: 'Riverine Flooding',
      WATERLOGGING: 'Urban Inundation / Waterlogging',
      SEVERE_RAIN: 'Intense Rainfall',
      STRONG_WIND: 'Severe Squall / High Winds',
      HAIL: 'Hailstorm',
      CLOUDBURST: 'Localized Cloudburst',
      OTHER: 'General Atmospheric Hazard',
    },
    severities: {
      1: 'Low · Minor localized ponding',
      2: 'Moderate · Ankle-deep water, traffic slow',
      3: 'High · Knee-deep water, ground floors at risk',
      4: 'Severe · Fast flowing water, vehicle submerged',
      5: 'Critical · Life safety risk, evacuation urgent',
    },
    reportWizard: {
      stepCategory: 'What hazard do you see?',
      stepCategoryDesc: 'Select the observed severe weather hazard',
      stepSeverity: 'How severe is the situation?',
      stepSeverityDesc: 'Rate ground impact to help reviewers prioritize',
      stepLocation: 'Where is this occurring?',
      stepLocationDesc: 'Use device GPS or select from regional hubs below',
      stepDetails: 'Observations & Evidence',
      stepDetailsDesc: 'Provide short note and optional field photo',
      stepReview: 'Review & Verify Consent',
      useGps: 'Use Current GPS Location',
      gpsAcquiring: 'Acquiring GPS coordinates…',
      attachPhoto: 'Upload Field Evidence Photo',
      photoCompressed: 'Photo compressed automatically (<150KB)',
      consentText:
        'I confirm this ground observation is truthful and authorize emergency verification.',
      submitReport: 'Submit Verified Report',
      submitting: 'Dispatching to review queue…',
      offlineNotice: 'No internet connection. Saved locally; will sync automatically.',
    },
    track: {
      title: 'Citizen Report Tracking',
      subtitle: 'Monitor real-time reviewer actions and verification pipeline for your ground report.',
      inputPlaceholder: 'Enter your 16-character Report ID (e.g. id_mtxbifjd_wz8h)',
      trackBtn: 'Track Status',
      statusReceived: 'Report Received & Hash Verified',
      statusReview: 'Under Meteorological Review',
      statusVerified: 'Verified by Operational Reviewer',
      statusResolved: 'Resolved / Public Alert Contributed',
    },
    alerts: {
      title: 'National Disaster & Weather Alerts',
      subtitle: 'Official reviewed advisories published by emergency response authorities.',
      filterAll: 'All Categories',
      filterCritical: 'Critical / Evacuation',
      validUntil: 'Valid Until',
      safetyInstructions: 'Mandatory Safety Action Guidelines',
      affectedArea: 'Affected Corridor / H3 Hex Zone',
      exportCap: 'Download CAP 1.2 XML',
    },
    weather: {
      title: 'Pan-India Real-Time Weather Intelligence',
      subtitle: 'Accurate meteorological analysis, hourly precipitation rates, and Doppler telemetry for every Indian locality.',
      searchPlaceholder: 'Search any district, city, or town in India (e.g. Shimla, Patna, Varanasi, Nagpur)…',
      stateMonitor: 'All 28 States & 8 Union Territories Monitor',
      currentTelemetry: 'Live Meteorological Station Telemetry',
      rainRate: 'Precipitation Rate',
      windSpeed: 'Wind Speed & Gusts',
      humidity: 'Relative Humidity',
      pressure: 'Barometric Pressure',
      threatNormal: 'NORMAL CONDITIONS',
      threatWatch: 'WEATHER WATCH',
      threatWarning: 'SEVERE WEATHER WARNING',
      threatCritical: 'CRITICAL EMERGENCY RISK',
    },
  },
  hi: {
    appName: 'सुरक्षा सेतु',
    subTitle: 'राष्ट्रीय हाइपरलोकल मौसम एवं आपदा चेतावनी मंच',
    tagline: 'मौसम की स्पष्टता। जब हर मिनट महत्वपूर्ण हो।',
    nav: {
      map: 'लाइव जोखिम मानचित्र',
      report: 'आपदा रिपोर्ट करें',
      alerts: 'आधिकारिक चेतावनियाँ',
      weather: 'अखिल भारतीय मौसम',
      track: 'रिपोर्ट स्थिति ट्रैक करें',
      safety: 'सुरक्षा नियम',
      authorities: 'अधिकारियों हेतु',
      signIn: 'साइन इन',
      openPlatform: 'मंच खोलें →',
    },
    hero: {
      headlineLine1: 'मौसम की स्पष्टता।',
      headlineLine2: 'जब हर मिनट महत्वपूर्ण हो।',
      supportingText:
        'नागरिकों की जमीनी रिपोर्ट और डॉप्लर रडार से सत्यापित जानकारी, भारत भर में सुरक्षित निर्णयों के लिए।',
      viewRisk: 'स्थानीय जोखिम देखें',
      reportHazard: 'खतरे की रिपोर्ट करें',
      scrollHint: 'मौसम परतों में उतरने के लिए नीचे स्क्रॉल करें',
    },
    metrics: {
      activeAlerts: 'सक्रिय राष्ट्रीय चेतावनियाँ',
      reportsToday: 'आज की सत्यापित जमीनी रिपोर्ट',
      underReview: 'समीक्षाधीन आपदा घटनाएं',
      stationsOnline: 'सक्रिय डॉप्लर व मौसम केंद्र',
    },
    hazards: {
      FLOODING: 'नदी जलभराव एवं बाढ़',
      WATERLOGGING: 'शहरी जलजमाव / सड़क रुकावट',
      SEVERE_RAIN: 'अत्यधिक भारी वर्षा',
      STRONG_WIND: 'तेज आंधी / चक्रवाती हवाएं',
      HAIL: 'ओलावृष्टि',
      CLOUDBURST: 'बादल फटना (क्लाउडबर्स्ट)',
      OTHER: 'सामान्य वायुमंडलीय खतरा',
    },
    severities: {
      1: 'निम्न · सड़कों पर हल्का पानी',
      2: 'मध्यम · टखनों तक पानी, यातायात धीमा',
      3: 'उच्च · घुटनों तक पानी, निचले तल खतरे में',
      4: 'गंभीर · तेज बहाव, वाहन जलमग्न',
      5: 'अत्यंत गंभीर · जानमाल का खतरा, तुरंत बचाव आवश्यक',
    },
    reportWizard: {
      stepCategory: 'आप कौन सा खतरा देख रहे हैं?',
      stepCategoryDesc: 'देखे गए गंभीर मौसमी खतरे का चयन करें',
      stepSeverity: 'स्थिति कितनी गंभीर है?',
      stepSeverityDesc: 'जमीनी प्रभाव का स्तर बताएं ताकि समीक्षा प्राथमिकता दी जा सके',
      stepLocation: 'यह घटना कहाँ हो रही है?',
      stepLocationDesc: 'डिवाइस जीपीएस का उपयोग करें या नीचे से शहर चुनें',
      stepDetails: 'अवलोकन एवं साक्ष्य',
      stepDetailsDesc: 'छोटा विवरण दें और वैकल्पिक रूप से फोटो अपलोड करें',
      stepReview: 'समीक्षा एवं सहमति',
      useGps: 'वर्तमान जीपीएस स्थान का उपयोग करें',
      gpsAcquiring: 'जीपीएस स्थान प्राप्त किया जा रहा है…',
      attachPhoto: 'जमीनी साक्ष्य फोटो अपलोड करें',
      photoCompressed: 'फोटो स्वतः संकुचित (<150KB)',
      consentText:
        'मैं पुष्टि करता हूँ कि यह अवलोकन सत्य है और आपातकालीन सत्यापन हेतु अधिकृत करता हूँ।',
      submitReport: 'सत्यापित रिपोर्ट जमा करें',
      submitting: 'समीक्षा कतार में भेजा जा रहा है…',
      offlineNotice: 'इंटरनेट उपलब्ध नहीं है। स्थानीय रूप से सहेजा गया; कनेक्शन आने पर स्वतः भेजा जाएगा।',
    },
    track: {
      title: 'नागरिक रिपोर्ट ट्रैकिंग',
      subtitle: 'अपनी जमीनी रिपोर्ट की वास्तविक समय समीक्षा और सत्यापन स्थिति की जांच करें।',
      inputPlaceholder: 'अपनी 16-अंकीय रिपोर्ट आईडी दर्ज करें (उदा. id_mtxbifjd_wz8h)',
      trackBtn: 'स्थिति जांचें',
      statusReceived: 'रिपोर्ट प्राप्त हुई व हैश सत्यापित',
      statusReview: 'मौसम विशेषज्ञ द्वारा समीक्षाधीन',
      statusVerified: 'आपदा समीक्षा अधिकारी द्वारा सत्यापित',
      statusResolved: 'निस्तारित / सार्वजनिक चेतावनी में सम्मिलित',
    },
    alerts: {
      title: 'राष्ट्रीय आपदा एवं मौसम चेतावनियाँ',
      subtitle: 'आपातकालीन आपदा प्रबंधन प्राधिकरणों द्वारा जारी सत्यापित दिशा-निर्देश।',
      filterAll: 'सभी श्रेणियां',
      filterCritical: 'अति-गंभीर / निकासी आवश्यक',
      validUntil: 'वैधता समय',
      safetyInstructions: 'अनिवार्य सुरक्षा दिशा-निर्देश',
      affectedArea: 'प्रभावित क्षेत्र / H3 हेक्स ग्रिड',
      exportCap: 'CAP 1.2 XML डाउनलोड करें',
    },
    weather: {
      title: 'अखिल भारतीय रीयल-टाइम मौसम विश्लेषण',
      subtitle: 'भारत के प्रत्येक कस्बे, जिले और क्षेत्र के लिए सटीक मौसम पूर्वानुमान, वर्षा दर और डॉप्लर आंकड़े।',
      searchPlaceholder: 'भारत के किसी भी जिले, शहर या कस्बे का नाम खोजें (उदा. शिमला, पटना, वाराणसी, नागपुर)…',
      stateMonitor: 'सभी 28 राज्यों और 8 केंद्र शासित प्रदेशों का मौसम केंद्र',
      currentTelemetry: 'लाइव मौसम विज्ञान केंद्र आंकड़े',
      rainRate: 'वर्षा दर (मिमी/घंटा)',
      windSpeed: 'हवा की गति और झोंके',
      humidity: 'सापेक्षिक आर्द्रता',
      pressure: 'वायुमंडलीय दबाव',
      threatNormal: 'सामान्य स्थिति',
      threatWatch: 'मौसम निगरानी अलर्ट',
      threatWarning: 'गंभीर मौसम चेतावनी',
      threatCritical: 'अत्यंत गंभीर आपातकालीन जोखिम',
    },
  },
};

export const LANGUAGE_STORAGE_KEY = 'suraksha_lang';

export function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    return saved === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function setSavedLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {}
}
