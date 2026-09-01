"use strict";

(() => {
  const LP_CONFIG = Object.freeze({
    client_name: "Facilite PVC",
    lp_name: "LP Facilite PVC",
    lp_slug: "facilite_pvc",
    product_name: "Forro de PVC / instalação de forro de PVC",
    product_slug: "forro_pvc",
    ga4_id: "G-7RE062GDFF",
    google_ads_id: "AW-11287880689",
    google_ads_conversion: "AW-11287880689/DRV5CMq79-scEPHHvYYq",
    ga4_main_event: "generate_lead",
    business_city: "",
    business_state: "",
    campaign_region: ""
  });

  const qs = new URLSearchParams(window.location.search);
  const debugMode = qs.get("debug_mode") === "true";
  const pageStartedAt = Date.now();
  const attributionKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "gclid",
    "fbclid",
    "msclkid",
    "ttclid",
    "wbraid",
    "gbraid"
  ];
  const storagePrefix = `${LP_CONFIG.lp_slug}_`;
  const leadLockKey = `${LP_CONFIG.lp_slug}_generate_lead_last_sent`;
  const leadLockDuration = 24 * 60 * 60 * 1000;
  const scrollMilestones = [25, 50, 75, 90];
  const videoMilestones = [10, 25, 50, 75];
  const sentScrollMilestones = new Set();
  const mappedVideos = new WeakSet();
  const videoStates = new WeakMap();
  let mappedVideoCount = 0;
  let maxScrollPercent = 0;
  let commonDataLogged = false;
  let scrollFrame = null;

  const debugLog = (...args) => {
    if (debugMode) console.log("[FacilitePVCTracking]", ...args);
  };

  const getStorage = (type) => {
    try {
      return window[type];
    } catch {
      return null;
    }
  };

  const sessionStore = getStorage("sessionStorage");
  const localStore = getStorage("localStorage");

  const storageGet = (store, key) => {
    if (!store) return "";
    try {
      return store.getItem(key) || "";
    } catch {
      return "";
    }
  };

  const storageSet = (store, key, value) => {
    if (!store || value === "" || value === null || value === undefined) return;
    try {
      store.setItem(key, String(value));
    } catch {
      // O tracking continua mesmo quando o navegador bloqueia o armazenamento.
    }
  };

  const createAnonymousId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${storagePrefix}${window.crypto.randomUUID()}`;
    }
    return `${storagePrefix}${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

  const ensureStoredId = (store, key) => {
    const existing = storageGet(store, key);
    if (existing) return existing;
    const generated = createAnonymousId();
    storageSet(store, key, generated);
    return generated;
  };

  const sessionId = ensureStoredId(sessionStore, `${storagePrefix}session_id`);
  const anonymousId = ensureStoredId(localStore, `${storagePrefix}anonymous_id`);

  if (!storageGet(sessionStore, `${storagePrefix}landing_page_url`)) {
    storageSet(sessionStore, `${storagePrefix}landing_page_url`, window.location.href);
  }
  if (!storageGet(sessionStore, `${storagePrefix}first_page_path`)) {
    storageSet(sessionStore, `${storagePrefix}first_page_path`, window.location.pathname);
  }

  const attribution = attributionKeys.reduce((result, key) => {
    const valueFromUrl = (qs.get(key) || "").trim();
    const storageKey = `${storagePrefix}${key}`;
    if (valueFromUrl) storageSet(sessionStore, storageKey, valueFromUrl);
    result[key] = valueFromUrl || storageGet(sessionStore, storageKey);
    return result;
  }, {});

  const getCookie = (name) => {
    const prefix = `${name}=`;
    const cookie = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix));
    if (!cookie) return "";
    try {
      return decodeURIComponent(cookie.slice(prefix.length));
    } catch {
      return cookie.slice(prefix.length);
    }
  };

  const getGaClientId = () => {
    const match = getCookie("_ga").match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
    return match ? match[1] : "";
  };

  const getGaSessionId = () => {
    const ga4Cookies = document.cookie
      .split(";")
      .map((item) => item.trim())
      .filter((item) => item.startsWith("_ga_") && item.includes("="));

    for (const cookie of ga4Cookies) {
      const value = cookie.slice(cookie.indexOf("=") + 1);
      const modernMatch = value.match(/(?:^|\$)s(\d{8,})/);
      if (modernMatch) return modernMatch[1];
      const legacyMatch = value.match(/^GS1\.1\.(\d{8,})\./);
      if (legacyMatch) return legacyMatch[1];
    }
    return "";
  };

  const identifyDeviceType = () => {
    const agent = navigator.userAgent;
    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(agent)
      || (/Android/i.test(agent) && !/Mobile/i.test(agent));
    if (isTablet) return "tablet";
    if (/Mobi|iPhone|iPod|Android/i.test(agent)) return "mobile";
    return "desktop";
  };

  const identifyDeviceOs = () => {
    const agent = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
    if (/Android/i.test(agent)) return "android";
    if (/Windows/i.test(agent)) return "windows";
    if (/Mac OS|Macintosh/i.test(agent)) return "macos";
    if (/Linux/i.test(agent)) return "linux";
    return "unknown";
  };

  const identifyBrowser = () => {
    const agent = navigator.userAgent;
    if (/Edg\//i.test(agent)) return "edge";
    if (/OPR\/|Opera/i.test(agent)) return "opera";
    if (/Firefox\/|FxiOS\//i.test(agent)) return "firefox";
    if (/Chrome\/|CriOS\//i.test(agent)) return "chrome";
    if (/Safari\//i.test(agent) && !/Chrome\/|CriOS\/|Android/i.test(agent)) return "safari";
    return "unknown";
  };

  const getTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  };

  const compactObject = (object) => Object.fromEntries(
    Object.entries(object).filter(([, value]) => (
      value !== "" && value !== null && value !== undefined
    ))
  );

  const createEventId = (eventName) => {
    const randomPart = window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    return `${LP_CONFIG.lp_slug}_${eventName}_${Date.now()}_${randomPart}`;
  };

  const getCommonEventData = (eventId) => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const payload = compactObject({
      client_name: LP_CONFIG.client_name,
      lp_name: LP_CONFIG.lp_name,
      lp_slug: LP_CONFIG.lp_slug,
      product_name: LP_CONFIG.product_name,
      product_slug: LP_CONFIG.product_slug,
      page_url: window.location.href,
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      referrer: document.referrer || "",
      landing_page_url: storageGet(sessionStore, `${storagePrefix}landing_page_url`),
      first_page_path: storageGet(sessionStore, `${storagePrefix}first_page_path`),
      timestamp: new Date().toISOString(),
      event_id: eventId,
      session_id: sessionId,
      anonymous_id: anonymousId,
      ...attribution,
      _fbp: getCookie("_fbp"),
      _fbc: getCookie("_fbc"),
      ga_client_id: getGaClientId(),
      ga_session_id: getGaSessionId(),
      user_agent: navigator.userAgent,
      browser_language: navigator.language || "",
      browser_languages: navigator.languages ? navigator.languages.join(",") : "",
      screen_width: window.screen ? window.screen.width : undefined,
      screen_height: window.screen ? window.screen.height : undefined,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      pixel_ratio: window.devicePixelRatio,
      timezone: getTimezone(),
      timezone_offset: new Date().getTimezoneOffset(),
      device_type: identifyDeviceType(),
      device_os: identifyDeviceOs(),
      browser: identifyBrowser(),
      connection_type: connection ? connection.type : undefined,
      effective_connection_type: connection ? connection.effectiveType : undefined,
      device_memory: navigator.deviceMemory,
      hardware_concurrency: navigator.hardwareConcurrency,
      business_city: LP_CONFIG.business_city,
      business_state: LP_CONFIG.business_state,
      campaign_region: LP_CONFIG.campaign_region,
      max_scroll_percent: maxScrollPercent,
      time_on_page_seconds: Math.max(0, Math.round((Date.now() - pageStartedAt) / 1000)),
      page_visibility: document.visibilityState
    });

    if (!commonDataLogged) {
      commonDataLogged = true;
      debugLog("Common data", payload);
    }
    return payload;
  };

  const sendGa4Event = (eventName, payload) => {
    if (typeof window.gtag !== "function") return false;
    window.gtag("event", eventName, payload);
    return true;
  };

  const sendLpView = () => {
    const payload = {
      ...getCommonEventData(createEventId("lp_view_facilite_pvc")),
      transport_type: "beacon"
    };
    if (sendGa4Event("lp_view_facilite_pvc", payload)) {
      debugLog("LP view sent", payload);
    }
  };

  const calculateScrollPercent = () => {
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    const scrollableHeight = Math.max(documentHeight - window.innerHeight, 0);
    if (scrollableHeight === 0) return 100;
    return Math.min(100, Math.max(0, Math.round((window.scrollY / scrollableHeight) * 100)));
  };

  const updateScrollTracking = () => {
    const currentPercent = calculateScrollPercent();
    maxScrollPercent = Math.max(maxScrollPercent, currentPercent);

    scrollMilestones.forEach((milestone) => {
      if (currentPercent < milestone || sentScrollMilestones.has(milestone)) return;
      sentScrollMilestones.add(milestone);
      const payload = {
        ...getCommonEventData(createEventId(`scroll_${milestone}`)),
        percent_scrolled: milestone,
        transport_type: "beacon"
      };
      if (sendGa4Event("scroll", payload)) {
        debugLog("Scroll event sent", milestone, payload);
      }
    });
    scrollFrame = null;
  };

  const setupScrollTracking = () => {
    window.addEventListener("scroll", () => {
      if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(updateScrollTracking);
    }, { passive: true });
    updateScrollTracking();
  };

  const isElementVisible = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
  };

  const createVideoPayload = (video, eventName, videoPercent) => ({
    ...getCommonEventData(createEventId(`${eventName}_${video.dataset.videoIndex || 0}_${videoPercent}`)),
    video_current_time: Math.round(video.currentTime || 0),
    video_duration: Math.round(Number.isFinite(video.duration) ? video.duration : 0),
    video_percent: videoPercent,
    video_provider: "html5",
    video_title: video.dataset.videoTitle || document.title,
    video_url: video.currentSrc || video.src || "",
    visible: isElementVisible(video),
    video_index: Number(video.dataset.videoIndex || 0),
    video_location: video.dataset.videoLocation || "produtos",
    transport_type: "beacon"
  });

  const mapVideo = (video) => {
    if (!(video instanceof HTMLVideoElement) || mappedVideos.has(video)) return false;

    mappedVideoCount += 1;
    if (!video.dataset.videoIndex) video.dataset.videoIndex = String(mappedVideoCount);
    if (!video.dataset.videoTitle) video.dataset.videoTitle = `Forro PVC na prática ${video.dataset.videoIndex}`;
    if (!video.dataset.videoLocation) video.dataset.videoLocation = "produtos";

    mappedVideos.add(video);
    const state = { started: false, completed: false, progress: new Set() };
    videoStates.set(video, state);

    video.addEventListener("play", () => {
      if (state.started) return;
      state.started = true;
      const payload = createVideoPayload(video, "video_start", 0);
      if (sendGa4Event("video_start", payload)) {
        debugLog("Video start sent", payload);
      }
    });

    video.addEventListener("timeupdate", () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const currentPercent = (video.currentTime / video.duration) * 100;
      videoMilestones.forEach((milestone) => {
        if (currentPercent < milestone || state.progress.has(milestone)) return;
        state.progress.add(milestone);
        const payload = createVideoPayload(video, "video_progress", milestone);
        if (sendGa4Event("video_progress", payload)) {
          debugLog("Video progress sent", milestone, payload);
        }
      });
    });

    video.addEventListener("ended", () => {
      if (state.completed) return;
      state.completed = true;
      const payload = createVideoPayload(video, "video_complete", 100);
      if (sendGa4Event("video_complete", payload)) {
        debugLog("Video complete sent", payload);
      }
    });
    return true;
  };

  const mapVideosInside = (root) => {
    let added = 0;
    if (root instanceof HTMLVideoElement && mapVideo(root)) added += 1;
    if (root.querySelectorAll) {
      root.querySelectorAll("video").forEach((video) => {
        if (mapVideo(video)) added += 1;
      });
    }
    return added;
  };

  const setupVideoTracking = () => {
    mapVideosInside(document);
    debugLog(`Videos mapped: ${mappedVideoCount}`);

    const observer = new MutationObserver((mutations) => {
      let added = 0;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) added += mapVideosInside(node);
        });
      });
      if (added > 0) debugLog(`Videos mapped: ${mappedVideoCount}`);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const cleanText = (element) => {
    if (!element) return "";
    const rawText = element.innerText || element.getAttribute("aria-label") || "";
    return rawText.replace(/\s+/g, " ").trim().slice(0, 120);
  };

  const inferButtonLocation = (link) => {
    if (!link) return "meio";
    if (link.matches(".whatsapp-float") || link.closest(".whatsapp-float")) return "sticky";
    if (link.closest("header, .site-header")) return "header";
    if (link.closest(".hero, #inicio > section:first-child")) return "hero";
    if (link.closest("#atendimento, .atendimento, .final, .cta-final")) return "final";
    if (link.closest("footer, .site-footer")) return "footer";
    if (link.closest("#faq, .faq, [data-faq]")) return "faq";
    return "meio";
  };

  const redirectTo = (destinationUrl) => {
    debugLog("Redirect URL", destinationUrl);
    window.location.href = destinationUrl;
  };

  const wasLeadRecentlySent = () => {
    const lastSent = Number(storageGet(localStore, leadLockKey));
    return Number.isFinite(lastSent) && lastSent > 0 && (Date.now() - lastSent) < leadLockDuration;
  };

  const trackWhatsAppLead = ({ destinationUrl, buttonText, buttonLocation }) => {
    if (!destinationUrl) return false;

    const eventId = createEventId("generate_lead");
    const payload = {
      ...getCommonEventData(eventId),
      conversion_type: "whatsapp",
      lead_source: "landing_page",
      lead_channel: "whatsapp",
      event_category: "conversion",
      event_label: "whatsapp_facilite_pvc",
      button_text: buttonText || "WhatsApp",
      button_location: buttonLocation || "meio",
      destination_url: destinationUrl
    };
    debugLog("Lead click detected", payload);

    if (wasLeadRecentlySent()) {
      sendGa4Event("whatsapp_repeat_click_facilite_pvc", {
        ...payload,
        event_id: createEventId("whatsapp_repeat_click_facilite_pvc"),
        transport_type: "beacon"
      });
      debugLog("Lead already sent in last 24h, redirecting only");
      redirectTo(destinationUrl);
      return true;
    }

    storageSet(localStore, leadLockKey, Date.now());
    let redirected = false;
    const redirect = () => {
      if (redirected) return;
      redirected = true;
      redirectTo(destinationUrl);
    };

    if (sendGa4Event(LP_CONFIG.ga4_main_event, {
      ...payload,
      transport_type: "beacon"
    })) {
      debugLog("GA4 generate_lead sent", payload);
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        ...payload,
        send_to: LP_CONFIG.google_ads_conversion,
        transport_type: "beacon",
        event_callback: redirect,
        event_timeout: 1500
      });
      debugLog("Google Ads conversion sent", {
        ...payload,
        send_to: LP_CONFIG.google_ads_conversion
      });
    }

    window.setTimeout(redirect, 1600);
    return true;
  };

  window.facilitePVCTrackLead = (target, options = {}) => {
    const isLink = target instanceof Element;
    const link = isLink ? target.closest('a[href*="api.whatsapp.com/send"], a[href*="wa.me/"]') : null;
    const destinationUrl = typeof target === "string" ? target : (link ? link.href : "");
    return trackWhatsAppLead({
      destinationUrl,
      buttonText: options.button_text || cleanText(link) || "WhatsApp",
      buttonLocation: options.button_location || inferButtonLocation(link)
    });
  };

  const setupWhatsAppTracking = () => {
    const selector = 'a[href*="api.whatsapp.com/send"], a[href*="wa.me/"]';
    debugLog(`WhatsApp links mapped: ${document.querySelectorAll(selector).length}`);
    document.addEventListener("click", (event) => {
      const link = event.target.closest(selector);
      if (!link) return;
      event.preventDefault();
      window.facilitePVCTrackLead(link);
    });
  };

  debugLog("Tracking loaded");
  sendLpView();
  setupScrollTracking();
  setupVideoTracking();
  setupWhatsAppTracking();
})();

