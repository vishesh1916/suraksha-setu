// ============================================================
// Suraksha Setu — Multilingual Internationalization Engine
// Supporting 6 Most Prominent Languages of India:
// 1. English (en)
// 2. हिन्दी / Hindi (hi)
// 3. বাংলা / Bengali (bn)
// 4. తెలుగు / Telugu (te)
// 5. मराठी / Marathi (mr)
// 6. தமிழ் / Tamil (ta)
// ============================================================

export type Language = 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta';

export interface LanguageMeta {
  code: Language;
  name: string;
  nativeName: string;
  region: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'National / Global' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'North & Central India' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'East India (WB, TR, AS)' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'South India (AP, TS)' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'West India (Maharashtra)' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'South India (TN, PY)' },
];

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
    about: string;
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
  map: {
    liveIntel: string;
    refreshed: string;
    sync: string;
    syncing: string;
    sosBeacon: string;
    tabOfficial: string;
    tabEarth: string;
    tabWeatherFlood: string;
    tabFireHeat: string;
    tabCommunity: string;
    filterCategory: string;
    allCategories: string;
    allSeverities: string;
    searchPlaceholder: string;
    layers: string;
    baseMap: string;
    legend: string;
    liveFeeds: string;
    reset: string;
    latestOfficial: string;
    citizenTruth: string;
    verifySource: string;
    reportUpdate: string;
    initialDetection: string;
    latestAgencyUpdate: string;
    activeBulletinUntil: string;
    telemetryFreshness: string;
    dailySyncStatus: string;
  };
}

export const translations: Record<Language, TranslationDict> = {
  // 1. ENGLISH (en)
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
      about: 'About',
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
    map: {
      liveIntel: 'Live hazard intelligence',
      refreshed: 'Refreshed',
      sync: 'Sync',
      syncing: 'Updating...',
      sosBeacon: '🚨 SOS Beacon',
      tabOfficial: 'Official alerts',
      tabEarth: 'Earth events',
      tabWeatherFlood: 'Weather & flood',
      tabFireHeat: 'Fire & heat',
      tabCommunity: 'Community reports',
      filterCategory: 'Filter by Category',
      allCategories: 'ALL',
      allSeverities: 'ALL SEVERITIES',
      searchPlaceholder: 'Search Indian cities, districts, or risk corridors…',
      layers: 'Layers',
      baseMap: 'Base Map',
      legend: 'Legend',
      liveFeeds: 'Live Feeds',
      reset: 'Reset',
      latestOfficial: 'Latest Official Alerts',
      citizenTruth: 'Citizen Truth',
      verifySource: 'Verify Official Source ↗',
      reportUpdate: 'Report Update',
      initialDetection: 'Initial Detection',
      latestAgencyUpdate: 'Latest Agency Update',
      activeBulletinUntil: 'Active Bulletin Until',
      telemetryFreshness: 'Telemetry Freshness',
      dailySyncStatus: 'Continuous Real-Time Sync',
    },
  },

  // 2. HINDI / हिन्दी (hi)
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
      about: 'हमारे बारे में',
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
    map: {
      liveIntel: 'लाइव आपदा सूचना व निगरानी',
      refreshed: 'अद्यतन समय',
      sync: 'सिंक',
      syncing: 'अपडेट जारी...',
      sosBeacon: '🚨 आपातकालीन एसओएस',
      tabOfficial: 'आधिकारिक चेतावनियाँ',
      tabEarth: 'भूगर्भीय घटनाएं',
      tabWeatherFlood: 'मौसम व बाढ़',
      tabFireHeat: 'अग्नि व उष्णता',
      tabCommunity: 'नागरिक रिपोर्ट',
      filterCategory: 'श्रेणी अनुसार चुनें',
      allCategories: 'सभी',
      allSeverities: 'सभी गंभीरता स्तर',
      searchPlaceholder: 'भारतीय शहर, जिले या जोखिम गलियारे खोजें…',
      layers: 'परतें (Layers)',
      baseMap: 'बेस मैप',
      legend: 'संकेत सूची',
      liveFeeds: 'लाइव फीड्स',
      reset: 'रीसेट',
      latestOfficial: 'नवीनतम आधिकारिक चेतावनियाँ',
      citizenTruth: 'नागरिक सत्यापन',
      verifySource: 'आधिकारिक स्रोत सत्यापित करें ↗',
      reportUpdate: 'अद्यतन रिपोर्ट करें',
      initialDetection: 'प्रारंभिक पहचान समय',
      latestAgencyUpdate: 'नवीनतम एजेंसी बुलेटिन',
      activeBulletinUntil: 'बुलेटिन वैधता समय',
      telemetryFreshness: 'डेटा नवीनता',
      dailySyncStatus: 'दैनिक निरंतर रियल-टाइम सिंक',
    },
  },

  // 3. BENGALI / বাংলা (bn)
  bn: {
    appName: 'সুরক্ষা সেতু',
    subTitle: 'জাতীয় হাইপারলোকাল আবহাওয়া ও দুর্যোগ সতর্কতা প্ল্যাটফর্ম',
    tagline: 'আবহাওয়ার স্পষ্টতা। যখন প্রতিটি মিনিট মূল্যবান।',
    nav: {
      map: 'লাইভ ঝুঁকি মানচিত্র',
      report: 'দুর্যোগ রিপোর্ট করুন',
      alerts: 'সরকারি সতর্কতা',
      weather: 'সর্বভারতীয় আবহাওয়া',
      track: 'রিপোর্ট ট্র্যাক করুন',
      safety: 'সুরক্ষা নির্দেশিকা',
      authorities: 'কর্তৃপক্ষের জন্য',
      about: 'আমাদের সম্পর্কে',
      signIn: 'সাইন ইন',
      openPlatform: 'প্ল্যাটফর্ম খুলুন →',
    },
    hero: {
      headlineLine1: 'আবহাওয়ার স্পষ্টতা।',
      headlineLine2: 'যখন প্রতিটি মিনিট মূল্যবান।',
      supportingText:
        'ভারতের প্রতিটি প্রান্তে নিরাপদ সিদ্ধান্তের জন্য নাগরিকদের যাচাইকৃত গ্রাউন্ড রিপোর্ট এবং ডপলার রাডার তথ্য।',
      viewRisk: 'স্থানীয় ঝুঁকি দেখুন',
      reportHazard: 'দুর্যোগের তথ্য দিন',
      scrollHint: 'আবহাওয়ার গভীর স্তরে যেতে নিচে স্ক্রোল করুন',
    },
    metrics: {
      activeAlerts: 'সক্রিয় জাতীয় সতর্কতা',
      reportsToday: 'আজকের যাচাইকৃত মাঠপর্যায়ের রিপোর্ট',
      underReview: 'পর্যালোচনাধীন দুর্যোগ ঘটনা',
      stationsOnline: 'সক্রিয় ডপলার ও আবহাওয়া স্টেশন',
    },
    hazards: {
      FLOODING: 'নদীর বন্যা ও জলপ্লাবন',
      WATERLOGGING: 'শহুরে জলজট / রাস্তায় জল জমা',
      SEVERE_RAIN: 'অতি ভারী বর্ষণ',
      STRONG_WIND: 'তীব্র কালবৈশাখী / ঘূর্ণিঝড়',
      HAIL: 'শিলাবৃষ্টি',
      CLOUDBURST: 'মেঘভাঙা বৃষ্টি (ক্লাউডবার্স্ট)',
      OTHER: 'সাধারণ আবহাওয়াগত ঝুঁকি',
    },
    severities: {
      1: 'কম · সামান্য জল জমা',
      2: 'মাঝারি · গোড়ালি সমান জল, ধীর গতিতে ট্রাফিক',
      3: 'উচ্চ · হাঁটু সমান জল, নিচতলা ঝুঁকিতে',
      4: 'তীব্র · দ্রুত প্রবাহিত জলস্রোত, গাড়ি নিমজ্জিত',
      5: 'মারাত্মক · জীবনহানির ঝুঁকি, জরুরি উদ্ধার প্রয়োজন',
    },
    reportWizard: {
      stepCategory: 'আপনি কী ধরনের বিপদ দেখছেন?',
      stepCategoryDesc: 'পরিলক্ষিত দুর্যোগের ধরণ নির্বাচন করুন',
      stepSeverity: 'পরিস্থিতি কতটা গুরুতর?',
      stepSeverityDesc: 'মাঠপর্যায়ের প্রভাবের মাত্রা নির্ধারণ করুন',
      stepLocation: 'ঘটনাটি কোথায় ঘটছে?',
      stepLocationDesc: 'ডিভাইস জিপিএস ব্যবহার করুন বা নিচে থেকে শহর বাছুন',
      stepDetails: 'পর্যবেক্ষণ ও প্রমাণ',
      stepDetailsDesc: 'সংক্ষিপ্ত বিবরণ দিন ও মাঠপর্যায়ের ছবি যুক্ত করুন',
      stepReview: 'পর্যালোচনা ও সম্মতি',
      useGps: 'বর্তমান জিপিএস অবস্থান নিন',
      gpsAcquiring: 'জিপিএস সংযোগ স্থাপন হচ্ছে…',
      attachPhoto: 'মাঠের প্রমাণ ছবি আপলোড করুন',
      photoCompressed: 'ছবি স্বয়ংক্রিয়ভাবে সংকুচিত (<150KB)',
      consentText:
        'আমি নিশ্চিত করছি যে এই তথ্য সত্য এবং জরুরি যাচাইকরণের জন্য অনুমতি দিচ্ছি।',
      submitReport: 'যাচাইকৃত রিপোর্ট জমা দিন',
      submitting: 'পর্যালোচনা তালিকায় পাঠানো হচ্ছে…',
      offlineNotice: 'ইন্টারনেট নেই। অফলাইনে সংরক্ষিত হয়েছে; সংযোগ এলে নিজে থেকেই পাঠানো হবে।',
    },
    track: {
      title: 'নাগরিক রিপোর্ট ট্র্যাকিং',
      subtitle: 'আপনার মাঠপর্যায়ের রিপোর্টের বাস্তব সময়ের পর্যালোচনা ও যাচাইকরণ অবস্থা পর্যবেক্ষণ করুন।',
      inputPlaceholder: 'আপনার ১৬ অক্ষরের রিপোর্ট আইডি লিখুন (যেমন id_mtxbifjd_wz8h)',
      trackBtn: 'অবস্থা ট্র্যাক করুন',
      statusReceived: 'রিপোর্ট গৃহীত হয়েছে ও হ্যাশ যাচাইকৃত',
      statusReview: 'আবহাওয়া পর্যালোচনার অধীনে',
      statusVerified: 'দুর্যোগ কর্মকর্তা দ্বারা যাচাইকৃত',
      statusResolved: 'নিষ্পন্ন / সর্বজনীন সতর্কতায় অন্তর্ভুক্ত',
    },
    alerts: {
      title: 'জাতীয় দুর্যোগ ও আবহাওয়া সতর্কতা',
      subtitle: 'জরুরি দুর্যোগ ব্যবস্থাপনা কর্তৃপক্ষের জারি করা যাচাইকৃত নির্দেশিকা।',
      filterAll: 'সকল বিভাগ',
      filterCritical: 'গুরুতর / জরুরি উচ্ছেদ',
      validUntil: 'বৈধতার সময়',
      safetyInstructions: 'বাধ্যতামূলক সুরক্ষা পদক্ষেপ নির্দেশিকা',
      affectedArea: 'ক্ষতিগ্রস্ত অঞ্চল / H3 হেক্স গ্রিড',
      exportCap: 'CAP 1.2 XML ডাউনলোড করুন',
    },
    weather: {
      title: 'সর্বভারতীয় রিয়েল-টাইম আবহাওয়া তথ্য',
      subtitle: 'ভারতের প্রতিটি এলাকা ও জেলার জন্য নির্ভরযোগ্য আবহাওয়া পূর্বাভাস ও ডপলার রাডার পর্যবেক্ষণ।',
      searchPlaceholder: 'ভারতের যে কোনো জেলা, শহর বা এলাকা খুঁজুন (যেমন কলকাতা, শিলিগুড়ি, পাটনা, আগরতলা)…',
      stateMonitor: '২৮টি রাজ্য ও ৮টি কেন্দ্রশাসিত অঞ্চলের আবহাওয়া কেন্দ্র',
      currentTelemetry: 'লাইভ আবহাওয়া পর্যবেক্ষণ কেন্দ্রের তথ্য',
      rainRate: 'বৃষ্টিপাতের হার (মিমি/ঘণ্টা)',
      windSpeed: 'বাতাসের গতি ও দমকা হাওয়া',
      humidity: 'আপেক্ষিক আর্দ্রতা',
      pressure: 'বায়ুমণ্ডলীয় চাপ',
      threatNormal: 'স্বাভাবিক পরিস্থিতি',
      threatWatch: 'আবহাওয়া নজরদারি সতর্কতা',
      threatWarning: 'ভারী দুর্যোগ সতর্কতা',
      threatCritical: 'চরম জরুরি পরিস্থিতি',
    },
    map: {
      liveIntel: 'লাইভ দুর্যোগ গোয়েন্দা তথ্য',
      refreshed: 'হালনাগাদ হয়েছে',
      sync: 'সিঙ্ক',
      syncing: 'হালনাগাদ হচ্ছে...',
      sosBeacon: '🚨 এসওএস বিপৎবার্তা',
      tabOfficial: 'সরকারি সতর্কতা',
      tabEarth: 'ভূ-দুর্যোগ',
      tabWeatherFlood: 'আবহাওয়া ও বন্যা',
      tabFireHeat: 'আগুন ও তাপদাহ',
      tabCommunity: 'নাগরিক রিপোর্ট',
      filterCategory: 'বিভাগ অনুযায়ী ফিল্টার',
      allCategories: 'সকল',
      allSeverities: 'সকল তীব্রতা স্তর',
      searchPlaceholder: 'ভারতীয় শহর, জেলা বা ঝুঁকিপূর্ণ এলাকা খুঁজুন…',
      layers: 'লেয়ার (Layers)',
      baseMap: 'বেস ম্যাপ',
      legend: 'লেজেন্ড',
      liveFeeds: 'লাইভ ফিড',
      reset: 'রিসেট',
      latestOfficial: 'সর্বশেষ সরকারি সতর্কতা',
      citizenTruth: 'নাগরিক সত্য',
      verifySource: 'সরকারি উৎস যাচাই করুন ↗',
      reportUpdate: 'আপডেট রিপোর্ট করুন',
      initialDetection: 'প্রাথমিক সনাক্তকরণ',
      latestAgencyUpdate: 'সর্বশেষ সংস্থা বুলেটিন',
      activeBulletinUntil: 'বুলেটিন বৈধতা সময়',
      telemetryFreshness: 'টেলিমেট্রি সতেজতা',
      dailySyncStatus: 'দৈনিক নিরবচ্ছিন্ন রিয়েল-টাইম সিঙ্ক',
    },
  },

  // 4. TELUGU / తెలుగు (te)
  te: {
    appName: 'సురక్షా సేతు',
    subTitle: 'జాతీయ హైపర్‌లోకల్ వాతావరణ మరియు విపత్తు హెచ్చరిక వేదిక',
    tagline: 'వాతావరణ స్పష్టత. ప్రతి నిమిషం విలువైనప్పుడు.',
    nav: {
      map: 'ప్రత్యక్ష ప్రమాద పటం',
      report: 'విపత్తును నివేదించండి',
      alerts: 'అధికారిక హెచ్చరికలు',
      weather: 'భారతదేశ వాతావరణం',
      track: 'నివేదిక స్థితిని ట్రాక్ చేయండి',
      safety: 'భద్రతా సూచనలు',
      authorities: 'అధికారుల కొరకు',
      about: 'మా గురించి',
      signIn: 'సైన్ ఇన్',
      openPlatform: 'వేదికను తెరవండి →',
    },
    hero: {
      headlineLine1: 'వాతావరణ స్పష్టత.',
      headlineLine2: 'ప్రతి నిమిషం విలువైనప్పుడు.',
      supportingText:
        'భారతదేశ వ్యాప్తంగా సురక్షిత నిర్ణయాల కోసం పౌరుల క్షేత్రస్థాయి నివేదికలు మరియు డాప్లర్ రాడార్ సమాచారం.',
      viewRisk: 'స్థానిక ప్రమాదాన్ని చూడండి',
      reportHazard: 'విపత్తును నివేదించండి',
      scrollHint: 'వాతావరణ పొరలను చూడటానికి క్రిందికి స్క్రోల్ చేయండి',
    },
    metrics: {
      activeAlerts: 'క్రియాశీల జాతీయ హెచ్చరికలు',
      reportsToday: 'నేటి ధృవీకరించబడిన క్షేత్ర నివేదికలు',
      underReview: 'సమీక్షలో ఉన్న సంఘటనలు',
      stationsOnline: 'క్రియాశీల డాప్లర్ & వాతావరణ కేంద్రాలు',
    },
    hazards: {
      FLOODING: 'నదీ వరదలు మరియు ముంపు',
      WATERLOGGING: 'పట్టణ నీటిముంపు / రోడ్లపై నీరు నిలవడం',
      SEVERE_RAIN: 'అతి భారీ వర్షపాతం',
      STRONG_WIND: 'తీవ్రమైన ఈదురు గాలులు / తుఫాను',
      HAIL: 'వడగండ్ల వాన',
      CLOUDBURST: 'మేఘ విస్ఫోటనం (క్లౌడ్‌బర్స్ట్)',
      OTHER: 'సాధారణ వాతావరణ ప్రమాదం',
    },
    severities: {
      1: 'తక్కువ · స్వల్పంగా నీరు నిలవడం',
      2: 'మితమైన · చీలమండల లోతు నీరు, నెమ్మదిగా ట్రాఫిక్',
      3: 'ఎక్కువ · మోకాళ్ల లోతు నీరు, దిగువ అంతస్తులకు ముప్పు',
      4: 'తీవ్రమైన · ఉధృతంగా ప్రవహించే నీరు, వాహనాలు మునక',
      5: 'అత్యవసరం · ప్రాణాపాయ స్థితి, తక్షణ తరలింపు అవసరం',
    },
    reportWizard: {
      stepCategory: 'మీరు ఏ రకమైన ప్రమాదాన్ని చూస్తున్నారు?',
      stepCategoryDesc: 'గమనించిన వాతావరణ విపత్తును ఎంచుకోండి',
      stepSeverity: 'పరిస్థితి ఎంత తీవ్రంగా ఉంది?',
      stepSeverityDesc: 'క్షేత్రస్థాయి ప్రభావాన్ని అంచనా వేయండి',
      stepLocation: 'ఈ సంఘటన ఎక్కడ జరుగుతోంది?',
      stepLocationDesc: 'పరికర GPSని ఉపయోగించండి లేదా క్రింద నుండి నగరాన్ని ఎంచుకోండి',
      stepDetails: 'పరిశీలనలు & సాక్ష్యాలు',
      stepDetailsDesc: 'చిన్న వివరణ ఇవ్వండి మరియు ఫోటోను జతచేయండి',
      stepReview: 'సమీక్ష & సమ్మతి',
      useGps: 'ప్రస్తుత GPS స్థానాన్ని ఉపయోగించండి',
      gpsAcquiring: 'GPS అనుసంధానం జరుగుతోంది…',
      attachPhoto: 'క్షేత్ర సాక్ష్యం ఫోటోను అప్‌లోడ్ చేయండి',
      photoCompressed: 'ఫోటో ఆటోమేటిక్‌గా కుదించబడింది (<150KB)',
      consentText:
        'ఈ సమాచారం వాస్తవమైనదని నేను ధృవీకరిస్తున్నాను మరియు అత్యవసర చర్యల కోసం అనుమతిస్తున్నాను.',
      submitReport: 'నివేదికను సమర్పించండి',
      submitting: 'సమీక్ష జాబితాకు పంపుతోంది…',
      offlineNotice: 'ఇంటర్నెట్ లేదు. స్థానికంగా సేవ్ చేయబడింది; కనెక్షన్ రాగానే పంపబడుతుంది.',
    },
    track: {
      title: 'పౌర నివేదిక ట్రాకింగ్',
      subtitle: 'మీ క్షేత్రస్థాయి నివేదిక యొక్క నిజ-సమయ సమీక్ష మరియు ధృవీకరణ ప్రక్రియను పర్యవేక్షించండి.',
      inputPlaceholder: 'మీ 16 అక్షరాల నివేదిక IDని నమోదు చేయండి (ఉదా. id_mtxbifjd_wz8h)',
      trackBtn: 'స్థితిని ట్రాక్ చేయండి',
      statusReceived: 'నివేదిక అందింది మరియు హాష్ ధృవీకరించబడింది',
      statusReview: 'వాతావరణ నిపుణుల సమీక్షలో ఉంది',
      statusVerified: 'విపత్తు అధికారి ద్వారా ధృవీకరించబడింది',
      statusResolved: 'పరిష్కరించబడింది / పబ్లిక్ హెచ్చరికలో చేర్చబడింది',
    },
    alerts: {
      title: 'జాతీయ విపత్తు మరియు వాతావరణ హెచ్చరికలు',
      subtitle: 'అత్యవసర ప్రతిస్పందన అధికారులచే ప్రచురించబడిన అధికారిక మార్గదర్శకాలు.',
      filterAll: 'అన్ని విభాగాలు',
      filterCritical: 'తీవ్రమైన / తరలింపు అవసరం',
      validUntil: 'చెల్లుబాటు సమయం',
      safetyInstructions: 'తప్పనిసరి భద్రతా చర్య మార్గదర్శకాలు',
      affectedArea: 'ప్రభావిత ప్రాంతం / H3 హెక్స్ గ్రిడ్',
      exportCap: 'CAP 1.2 XML డౌన్‌లోడ్ చేయండి',
    },
    weather: {
      title: 'భారతదేశ నిజ-సమయ వాతావరణ సమాచారం',
      subtitle: 'భారతదేశంలోని ప్రతి ప్రాంతం మరియు జిల్లాకు కచ్చితమైన వాతావరణ విశ్లేషణ, వర్షపాత రేటు మరియు రాడార్ డేటా.',
      searchPlaceholder: 'భారతదేశంలోని ఏ జిల్లా, నగరం లేదా పట్టణాన్నైనా శోధించండి (ఉదా. హైదరాబాద్, విశాఖపట్నం, విజయవాడ, వరంగల్)…',
      stateMonitor: '28 రాష్ట్రాలు & 8 కేంద్రపాలిత ప్రాంతాల వాతావరణ కేంద్రం',
      currentTelemetry: 'ప్రత్యక్ష వాతావరణ కేంద్రం డేటా',
      rainRate: 'వర్షపాత తీవ్రత (మి.మీ/గంట)',
      windSpeed: 'గాలి వేగం మరియు గాలుల తీవ్రత',
      humidity: 'తేమ శాతం',
      pressure: 'వాయుపీడనం',
      threatNormal: 'సాధారణ పరిస్థితులు',
      threatWatch: 'వాతావరణ పరిశీలన హెచ్చరిక',
      threatWarning: 'తీవ్ర వాతావరణ హెచ్చరిక',
      threatCritical: 'అత్యవసర ప్రమాద స్థాయి',
    },
    map: {
      liveIntel: 'ప్రత్యక్ష విపత్తు సమాచారం & నిఘా',
      refreshed: 'తాజాకరించబడింది',
      sync: 'సింక్',
      syncing: 'నవీకరిస్తోంది...',
      sosBeacon: '🚨 అత్యవసర సహాయం (SOS)',
      tabOfficial: 'అధికారిక హెచ్చరికలు',
      tabEarth: 'భూకంపాలు & కొండచరియలు',
      tabWeatherFlood: 'వాతావరణం & వరదలు',
      tabFireHeat: 'మంటలు & ఉష్ణోగ్రత',
      tabCommunity: 'పౌర నివేదికలు',
      filterCategory: 'వర్గం ప్రకారం ఫిల్టర్ చేయండి',
      allCategories: 'అన్ని',
      allSeverities: 'అన్ని తీవ్రత స్థాయిలు',
      searchPlaceholder: 'భారతీయ నగరాలు, జిల్లాలు లేదా ప్రమాద ప్రాంతాలను శోధించండి…',
      layers: 'పొరలు (Layers)',
      baseMap: 'ప్రాథమిక పటం',
      legend: 'వివరణ పట్టిక',
      liveFeeds: 'ప్రత్యక్ష ఫీడ్‌లు',
      reset: 'రీసెట్',
      latestOfficial: 'తాజా అధికారిక హెచ్చరికలు',
      citizenTruth: 'పౌరుల క్షేత్ర సత్యం',
      verifySource: 'అధికారిక మూలాన్ని ధృవీకరించండి ↗',
      reportUpdate: 'నవీకరణను నివేదించండి',
      initialDetection: 'ప్రారంభ గుర్తింపు సమయం',
      latestAgencyUpdate: 'తాజా ఏజెన్సీ బులెటిన్',
      activeBulletinUntil: 'బులెటిన్ చెల్లుబాటు వరకు',
      telemetryFreshness: 'సమాచార తాజాదనం',
      dailySyncStatus: 'రోజువారీ నిరంతర రియల్-టైమ్ సింక్',
    },
  },

  // 5. MARATHI / मराठी (mr)
  mr: {
    appName: 'सुरक्षा सेतु',
    subTitle: 'राष्ट्रीय हायपरलोकल हवामान व आपत्ती इशारा मंच',
    tagline: 'हवामानाची स्पष्टता. जेव्हा प्रत्येक मिनिट महत्त्वाचा असतो.',
    nav: {
      map: 'थेट जोखीम नकाशा',
      report: 'आपत्ती नोंदवा',
      alerts: 'अधिकृत इशारे',
      weather: 'अखिल भारतीय हवामान',
      track: 'अहवाल स्थिती तपासा',
      safety: 'सुरक्षा नियमावली',
      authorities: 'प्रशासनासाठी',
      about: 'आमच्याबद्दल',
      signIn: 'साइन इन',
      openPlatform: 'मंच उघडा →',
    },
    hero: {
      headlineLine1: 'हवामानाची स्पष्टता.',
      headlineLine2: 'जेव्हा प्रत्येक मिनिट महत्त्वाचा असतो.',
      supportingText:
        'संपूर्ण भारतात सुरक्षित निर्णयांसाठी नागरिकांचे प्रत्यक्ष अहवाल आणि डॉप्लर रडारचे सत्यापित विश्लेषण.',
      viewRisk: 'स्थानिक धोका पहा',
      reportHazard: 'धोका नोंदवा',
      scrollHint: 'हवामानाच्या स्तरांमध्ये खाली जाण्यासाठी स्क्रोल करा',
    },
    metrics: {
      activeAlerts: 'सक्रिय राष्ट्रीय इशारे',
      reportsToday: 'आजचे सत्यापित प्रत्यक्ष अहवाल',
      underReview: 'पुनरावलोकनाखालील घटना',
      stationsOnline: 'सक्रिय डॉप्लर व हवामान केंद्र',
    },
    hazards: {
      FLOODING: 'नदी पूर व पाणी साचणे',
      WATERLOGGING: 'शहरी पाणी साचणे / रस्ते बंद',
      SEVERE_RAIN: 'अति मुसळधार पाऊस',
      STRONG_WIND: 'वादळी वारे / चक्रीवादळ',
      HAIL: 'गारपीट',
      CLOUDBURST: 'ढगफुटी (क्लाउडबर्स्ट)',
      OTHER: 'सर्वसाधारण वातावरणीय धोका',
    },
    severities: {
      1: 'कमी · रस्त्यांवर थोडे पाणी',
      2: 'मध्यम · घोट्यापर्यंत पाणी, वाहतूक मंद',
      3: 'जास्त · गुडघ्यापर्यंत पाणी, तळमजले धोक्यात',
      4: 'गंभीर · पाण्याचा वेगवान प्रवाह, वाहने बुडाली',
      5: 'अतिगंभीर · जीवितास धोका, तातडीने स्थलांतर आवश्यक',
    },
    reportWizard: {
      stepCategory: 'तुम्ही कोणता धोका पाहत आहात?',
      stepCategoryDesc: 'निरीक्षण केलेल्या गंभीर हवामान धोक्याची निवड करा',
      stepSeverity: 'परिस्थिती किती गंभीर आहे?',
      stepSeverityDesc: 'जमिनीवरील परिणामाची तीव्रता निश्चित करा',
      stepLocation: 'ही घटना कुठे घडत आहे?',
      stepLocationDesc: 'डिव्हाइस GPS वापरा किंवा खालील शहरांमधून निवडा',
      stepDetails: 'निरीक्षणे व पुरावे',
      stepDetailsDesc: 'थोडक्यात माहिती द्या आणि फोटो अपलोड करा',
      stepReview: 'पुनरावलोकन व संमती',
      useGps: 'सध्याचे GPS स्थान वापरा',
      gpsAcquiring: 'GPS स्थान शोधले जात आहे…',
      attachPhoto: 'पुरावा म्हणून फोटो अपलोड करा',
      photoCompressed: 'फोटो आपोआप संकुचित (<150KB)',
      consentText:
        'मी पुष्टी करतो की ही माहिती खरी आहे आणि आपत्कालीन पडताळणीसाठी संमती देतो.',
      submitReport: 'अहवाल सादर करा',
      submitting: 'पुनरावलोकन रांगेत पाठवत आहे…',
      offlineNotice: 'इंटरनेट उपलब्ध नाही. ऑफलाइन सेव्ह केले आहे; इंटरनेट येताच पाठवले जाईल.',
    },
    track: {
      title: 'नागरिक अहवाल ट्रॅकिंग',
      subtitle: 'तुमच्या प्रत्यक्ष आपत्ती अहवालाची रिअल-टाइम तपासणी आणि पडताळणी स्थिती पहा.',
      inputPlaceholder: 'तुमचा १६ अंकी रिपोर्ट आयडी प्रविष्ट करा (उदा. id_mtxbifjd_wz8h)',
      trackBtn: 'स्थिती तपासा',
      statusReceived: 'अहवाल प्राप्त आणि हॅश सत्यापित',
      statusReview: 'हवामान तज्ज्ञांकडून पुनरावलोकन सुरू',
      statusVerified: 'आपत्ती अधिकाऱ्याकडून सत्यापित',
      statusResolved: 'निवारण झाले / सार्वजनिक इशाऱ्यात समाविष्ट',
    },
    alerts: {
      title: 'राष्ट्रीय आपत्ती व हवामान इशारे',
      subtitle: 'आपत्कालीन व्यवस्थापन प्राधिकरणाने जारी केलेल्या अधिकृत सूचना व मार्गदर्शक तत्त्वे.',
      filterAll: 'सर्व श्रेणी',
      filterCritical: 'अतिगंभीर / स्थलांतर आवश्यक',
      validUntil: 'वैधता वेळ',
      safetyInstructions: 'अनिवार्य सुरक्षा मार्गदर्शक तत्त्वे',
      affectedArea: 'प्रभावित क्षेत्र / H3 हेक्स ग्रिड',
      exportCap: 'CAP 1.2 XML डाउनलोड करा',
    },
    weather: {
      title: 'अखिल भारतीय रिअल-टाइम हवामान अंदाज',
      subtitle: 'भारतातील प्रत्येक शहर, जिल्हा आणि परिसरासाठी अचूक हवामान विश्लेषण, पावसाचे प्रमाण आणि रडार आकडेवारी.',
      searchPlaceholder: 'भारतातील कोणताही जिल्हा, शहर किंवा गाव शोधा (उदा. मुंबई, पुणे, नागपूर, नाशिक)…',
      stateMonitor: '२८ राज्ये व ८ केंद्रशासित प्रदेशांचे हवामान केंद्र',
      currentTelemetry: 'थेट हवामान केंद्र आकडेवारी',
      rainRate: 'पावसाचे प्रमाण (मिमी/तास)',
      windSpeed: 'वाऱ्याचा वेग व झोके',
      humidity: 'सापेक्ष आर्द्रता',
      pressure: 'हवेचा दाब',
      threatNormal: 'सामान्य परिस्थिती',
      threatWatch: 'हवामान देखरेख इशारा',
      threatWarning: 'गंभीर हवामान चेतावणी',
      threatCritical: 'अति-आणीबाणीची जोखीम',
    },
    map: {
      liveIntel: 'थेट आपत्ती माहिती व विश्लेषण',
      refreshed: 'अद्यतनित',
      sync: 'सिंक',
      syncing: 'अपडेट होत आहे...',
      sosBeacon: '🚨 आपत्कालीन एसओएस (SOS)',
      tabOfficial: 'अधिकृत इशारे',
      tabEarth: 'भूगर्भीय आपत्ती',
      tabWeatherFlood: 'हवामान व पूर',
      tabFireHeat: 'आग व उष्णता',
      tabCommunity: 'नागरिक अहवाल',
      filterCategory: 'वर्गवारीनुसार फिल्टर',
      allCategories: 'सर्व',
      allSeverities: 'सर्व तीव्रता स्तर',
      searchPlaceholder: 'भारतीय शहरे, जिल्हे किंवा आपत्ती प्रवण क्षेत्र शोधा…',
      layers: 'स्तरे (Layers)',
      baseMap: 'मूळ नकाशा',
      legend: 'संकेत सूची',
      liveFeeds: 'थेट फीड्स',
      reset: 'रीसेट करा',
      latestOfficial: 'नवीनतम अधिकृत इशारे',
      citizenTruth: 'नागरिक सत्य',
      verifySource: 'अधिकृत स्रोत तपासा ↗',
      reportUpdate: 'अपडेट कळवा',
      initialDetection: 'प्राथमिक नोंद वेळ',
      latestAgencyUpdate: 'नवीनतम प्रशासकीय अपडेट',
      activeBulletinUntil: 'इशारा वैधता वेळ',
      telemetryFreshness: 'डेटा ताजेपणा',
      dailySyncStatus: 'दररोज थेट अविरत रिअल-टाइम सिंक',
    },
  },

  // 6. TAMIL / தமிழ் (ta)
  ta: {
    appName: 'சுரக்ஷா சேது',
    subTitle: 'தேசிய அதிநுண்ணிய வானிலை மற்றும் பேரிடர் எச்சரிக்கை தளம்',
    tagline: 'வானிலை தெளிவு. ஒவ்வொரு நிமிடமும் முக்கியமானது.',
    nav: {
      map: 'நேரலை அபாய வரைபடம்',
      report: 'ஆபத்தை பதிவு செய்',
      alerts: 'அதிகாரப்பூர்வ எச்சரிக்கைகள்',
      weather: 'அனைத்திந்திய வானிலை',
      track: 'பதிவு நிலையை கண்காணிக்க',
      safety: 'பாதுகாப்பு நெறிமுறைகள்',
      authorities: 'அதிகாரிகளுக்கு',
      about: 'எங்களைப் பற்றி',
      signIn: 'உள்நுழைக',
      openPlatform: 'தளத்தை திறக்க →',
    },
    hero: {
      headlineLine1: 'வானிலை தெளிவு.',
      headlineLine2: 'ஒவ்வொரு நிமிடமும் முக்கியமானது.',
      supportingText:
        'இந்தியா முழுவதும் பாதுகாப்பான முடிவுகளை எடுக்க குடிமக்களின் கள அறிக்கைகள் மற்றும் டாப்ளர் ரேடார் புலனாய்வு.',
      viewRisk: 'உள்ளூர் அபாயத்தை பார்க்க',
      reportHazard: 'ஆபத்தை பதிவு செய்ய',
      scrollHint: 'வானிலை அடுக்குகளைக் காண கீழே உருட்டவும்',
    },
    metrics: {
      activeAlerts: 'செயலில் உள்ள தேசிய எச்சரிக்கைகள்',
      reportsToday: 'இன்று சரிபார்க்கப்பட்ட கள அறிக்கைகள்',
      underReview: 'மறுஆய்வில் உள்ள நிகழ்வுகள்',
      stationsOnline: 'செயலில் உள்ள ரேடார் மற்றும் வானிலை மையங்கள்',
    },
    hazards: {
      FLOODING: 'ஆற்று வெள்ளம் மற்றும் பெருக்கெடுத்தல்',
      WATERLOGGING: 'நகர்ப்புற நீர் தேக்கம் / சாலை அடைப்பு',
      SEVERE_RAIN: 'மிக பலத்த பெருமழை',
      STRONG_WIND: 'கடுமையான சூறாவளி / பலத்த காற்று',
      HAIL: 'ஆலங்கட்டி மழை',
      CLOUDBURST: 'மேகவெடிப்பு (கிளவுட்பர்ஸ்ட்)',
      OTHER: 'பொதுவான வளிமண்டல ஆபத்து',
    },
    severities: {
      1: 'குறைவு · ஆங்காங்கே சிறிய நீர் தேக்கம்',
      2: 'மிதமானது · கணுக்கால் அளவு நீர், மெதுவான போக்குவரத்து',
      3: 'அதிகம் · முழங்கால் அளவு நீர், தரைத்தளம் ஆபத்தில்',
      4: 'தீவிரம் · விரைவாக பாயும் வெள்ள நீர், வாகனங்கள் மூழ்கின',
      5: 'அதிதீவிரம் · உயிருக்கு ஆபத்து, அவசர வெளியேற்றம் தேவை',
    },
    reportWizard: {
      stepCategory: 'நீங்கள் என்ன ஆபத்தைக் காண்கிறீர்கள்?',
      stepCategoryDesc: 'கண்டறியப்பட்ட வானிலை ஆபத்தைத் தேர்ந்தெடுக்கவும்',
      stepSeverity: 'நிலைமை எவ்வளவு தீவிரமானது?',
      stepSeverityDesc: 'கள பாதிப்பின் தீவிரத்தை மதிப்பீடு செய்யுங்கள்',
      stepLocation: 'இது எங்கு நிகழ்கிறது?',
      stepLocationDesc: 'சாதன ஜிபிஎஸ் பயன்படுத்தவும் அல்லது கீழே உள்ள நகரங்களைத் தேர்ந்தெடுக்கவும்',
      stepDetails: 'கள அவதானிப்புகள் & சான்றுகள்',
      stepDetailsDesc: 'சுருக்கமான குறிப்பை வழங்கி புகைப்படத்தை இணைக்கவும்',
      stepReview: 'மறுஆய்வு & ஒப்புதல்',
      useGps: 'தற்போதைய ஜிபிஎஸ் இருப்பிடத்தைப் பயன்படுத்தவும்',
      gpsAcquiring: 'ஜிபிஎஸ் இருப்பிடம் பெறப்படுகிறது…',
      attachPhoto: 'கள சான்று புகைப்படத்தைப் பதிவேற்றவும்',
      photoCompressed: 'புகைப்படம் தானாக சுருக்கப்பட்டது (<150KB)',
      consentText:
        'இந்த தகவல் உண்மையானது என உறுதிப்படுத்துகிறேன், மேலும் அவசர சரிபார்ப்பிற்கு ஒப்புதலளிக்கிறேன்.',
      submitReport: 'அறிக்கையைச் சமர்ப்பிக்கவும்',
      submitting: 'மறுஆய்வு வரிசைக்கு அனுப்பப்படுகிறது…',
      offlineNotice: 'இணைய இணைப்பு இல்லை. ஆஃப்லைனில் சேமிக்கப்பட்டது; இணையம் வந்ததும் தானாக அனுப்பப்படும்.',
    },
    track: {
      title: 'குடிமக்கள் அறிக்கை கண்காணிப்பு',
      subtitle: 'உங்கள் கள அறிக்கையின் நிகழ்நேர ஆய்வு மற்றும் சரிபார்ப்பு செயல்முறையை கண்காணிக்கவும்.',
      inputPlaceholder: 'உங்கள் 16 எழுத்து அறிக்கை ஐடியை உள்ளிடவும் (எ.கா. id_mtxbifjd_wz8h)',
      trackBtn: 'நிலையை கண்காணிக்க',
      statusReceived: 'அறிக்கை பெறப்பட்டது மற்றும் சரிபார்க்கப்பட்டது',
      statusReview: 'வானிலை ஆய்வாளரின் பரிசீலனையில்',
      statusVerified: 'பேரிடர் மேலாண்மை அதிகாரியால் உறுதிசெய்யப்பட்டது',
      statusResolved: 'தீர்க்கப்பட்டது / பொது எச்சரிக்கையில் சேர்க்கப்பட்டது',
    },
    alerts: {
      title: 'தேசிய பேரிடர் மற்றும் வானிலை எச்சரிக்கைகள்',
      subtitle: 'அவசர பேரிடர் மீட்பு அமைப்புகளால் வெளியிடப்பட்ட அதிகாரப்பூர்வ வழிகாட்டுதல்கள்.',
      filterAll: 'அனைத்து பிரிவுகள்',
      filterCritical: 'அதிதீவிரம் / அவசர வெளியேற்றம்',
      validUntil: 'செல்லுபடியாகும் நேரம்',
      safetyInstructions: 'கட்டாய பாதுகாப்பு நடவடிக்கை வழிகாட்டுதல்கள்',
      affectedArea: 'பாதிக்கப்பட்ட பகுதி / H3 ஹெக்ஸ் மண்டலம்',
      exportCap: 'CAP 1.2 XML பதிவிறக்கவும்',
    },
    weather: {
      title: 'அனைத்திந்திய நிகழ்நேர வானிலை நுண்ணறிவு',
      subtitle: 'இந்தியாவின் ஒவ்வொரு பகுதி மற்றும் மாவட்டத்திற்கான துல்லியமான வானிலை முன்னறிவிப்பு, மழைப்பொழிவு மற்றும் ரேடார் தரவு.',
      searchPlaceholder: 'இந்தியாவில் உள்ள எந்தவொரு மாவட்டம், நகரம் அல்லது ஊரைத் தேடுங்கள் (எ.கா. சென்னை, கோயம்புத்தூர், மதுரை, திருச்சி)…',
      stateMonitor: '28 மாநிலங்கள் & 8 யூனியன் பிரதேசங்களின் வானிலை மையம்',
      currentTelemetry: 'நேரலை வானிலை நிலையத் தரவு',
      rainRate: 'மழைப்பொழிவு தீவிரம் (மி.மீ/மணி)',
      windSpeed: 'காற்றின் வேகம் மற்றும் வீச்சு',
      humidity: 'ஈரப்பதம்',
      pressure: 'வளிமண்டல அழுத்தம்',
      threatNormal: 'சாதாரண நிலை',
      threatWatch: 'வானிலை கண்காணிப்பு எச்சரிக்கை',
      threatWarning: 'கடுமையான வானிலை எச்சரிக்கை',
      threatCritical: 'அதி அவசர பேரிடர் ஆபத்து',
    },
    map: {
      liveIntel: 'நேரலை பேரிடர் புலனாய்வு & கண்காணிப்பு',
      refreshed: 'புதுப்பிக்கப்பட்டது',
      sync: 'ஒத்திசைக்க',
      syncing: 'புதுப்பிக்கப்படுகிறது...',
      sosBeacon: '🚨 அவசர உதவி (SOS)',
      tabOfficial: 'அதிகாரப்பூர்வ எச்சரிக்கைகள்',
      tabEarth: 'பூமி பேரிடர்கள்',
      tabWeatherFlood: 'வானிலை & வெள்ளம்',
      tabFireHeat: 'தீ & வெப்பம்',
      tabCommunity: 'குடிமக்கள் அறிக்கைகள்',
      filterCategory: 'பிரிவு வாரியாக வடிகட்டவும்',
      allCategories: 'அனைத்தும்',
      allSeverities: 'அனைத்து தீவிர நிலைகள்',
      searchPlaceholder: 'இந்திய நகரங்கள், மாவட்டங்கள் அல்லது ஆபத்து மண்டலங்களைத் தேடுங்கள்…',
      layers: 'அடுக்குகள் (Layers)',
      baseMap: 'அடிப்படை வரைபடம்',
      legend: 'குறியீட்டு விளக்கம்',
      liveFeeds: 'நேரலை ஊட்டம்',
      reset: 'மீட்டமைக்க',
      latestOfficial: 'சமீபத்திய அரசு எச்சரிக்கைகள்',
      citizenTruth: 'குடிமக்கள் கள உண்மை',
      verifySource: 'அரசு மூலத்தை சரிபார்க்க ↗',
      reportUpdate: 'புதுப்பிப்பை புகாரளிக்கவும்',
      initialDetection: 'ஆரம்ப கண்டறிதல் நேரம்',
      latestAgencyUpdate: 'சமீபத்திய அரசு புல்லட்டின்',
      activeBulletinUntil: 'அறிவிப்பு செல்லுபடி வரை',
      telemetryFreshness: 'தரவு புத்துணர்ச்சி',
      dailySyncStatus: 'நாள்தோறும் நேரலை தொடர் ஒத்திசைவு',
    },
  },
};

export const LANGUAGE_STORAGE_KEY = 'suraksha_lang';
const VALID_LANGUAGES: Language[] = ['en', 'hi', 'bn', 'te', 'mr', 'ta'];

export function getSavedLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    return VALID_LANGUAGES.includes(saved) ? saved : 'en';
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
