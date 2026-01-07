import { createStore } from "/js/AlpineStore.js";
import * as css from "/js/css.js";
import { store as speechStore } from "/components/chat/speech/speech-store.js";

// Preferences store centralizes user preference toggles and side-effects
const model = {
  // UI toggles (initialized with safe defaults, loaded from localStorage in init)
  get autoScroll() {
    return this._autoScroll;
  },
  set autoScroll(value) {
    this._autoScroll = value;
    this._applyAutoScroll(value);
  },
  _autoScroll: true,

  get darkMode() {
    return this._darkMode;
  },
  set darkMode(value) {
    this._darkMode = value;
    this._applyDarkMode(value);
  },
  _darkMode: true,

  get speech() {
    return this._speech;
  },
  set speech(value) {
    this._speech = value;
    this._applySpeech(value);
  },
  _speech: false,

  get showThoughts() {
    return this._showThoughts;
  },
  set showThoughts(value) {
    this._showThoughts = value;
    this._applyShowThoughts(value);
  },
  _showThoughts: true,

  get showJson() {
    return this._showJson;
  },
  set showJson(value) {
    this._showJson = value;
    this._applyShowJson(value);
  },
  _showJson: false,

  get showUtils() {
    return this._showUtils;
  },
  set showUtils(value) {
    this._showUtils = value;
    this._applyShowUtils(value);
  },
  _showUtils: false,

  get accentHue() {
    return this._accentHue;
  },
  set accentHue(value) {
    // coerce to number and clamp 0-360
    const v = Math.max(0, Math.min(360, Number(value) || 0));
    this._accentHue = v;
    this._applyAccentHue(v);
  },
  _accentHue: 220,

  // Initialize preferences and apply current state
  init() {
    try {
      // Load persisted preferences with safe fallbacks
      try {
        const storedDarkMode = localStorage.getItem("darkMode");
        this._darkMode = storedDarkMode !== "false";
      } catch {
        this._darkMode = true; // Default to dark mode if localStorage is unavailable
      }

      try {
        const storedSpeech = localStorage.getItem("speech");
        this._speech = storedSpeech === "true";
      } catch {
        this._speech = false; // Default to speech off if localStorage is unavailable
      }

      try {
        const storedAccent = localStorage.getItem("accentHue");
        if (storedAccent != null) this._accentHue = Number(storedAccent) || this._accentHue;
      } catch {
        this._accentHue = 220;
      }

      // Apply all preferences
      this._applyDarkMode(this._darkMode);
      this._applyAutoScroll(this._autoScroll);
      this._applySpeech(this._speech);
      this._applyShowThoughts(this._showThoughts);
      this._applyShowJson(this._showJson);
      this._applyShowUtils(this._showUtils);
      this._applyAccentHue(this._accentHue);
    } catch (e) {
      console.error("Failed to initialize preferences store", e);
    }
  },

  _applyAutoScroll(value) {
    // nothing for now
  },

  _applyDarkMode(value) {
    if (value) {
      document.body.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.body.classList.add("light-mode");
    }
    localStorage.setItem("darkMode", value);
    // Re-apply accent so palette matches the current brightness mode
    try {
      this._applyAccentHue(this._accentHue);
    } catch (e) {
      console.error("Failed to reapply accent after dark mode change", e);
    }
  },

  _applySpeech(value) {
    localStorage.setItem("speech", value);
    if (!value) speechStore.stopAudio();
  },

  _applyShowThoughts(value) {
    css.toggleCssProperty(
      ".msg-thoughts",
      "display",
      value ? undefined : "none"
    );
  },

  _applyShowJson(value) {
    css.toggleCssProperty(".msg-json", "display", value ? "block" : "none");
  },

  _applyShowUtils(value) {
    css.toggleCssProperty(
      ".message-util",
      "display",
      value ? undefined : "none"
    );
  },

  _applyAccentHue(hue) {
    try {
      // Use HSL for flexible accent color; 80% saturation, 50% lightness by default
      const h = Math.round(Number(hue) || 220);

      // Decide palette based on current mode (dark / light)
      const isDark = document.body.classList.contains("dark-mode");

      // Material-like expressive tones (approximate):
      // Light mode: primary darker, container very light
      // Dark mode: primary lighter, container darker
      const primaryS = 78; // saturation for primary
      const lightPrimaryL = 42;
      const darkPrimaryL = 72;
      const primaryL = isDark ? darkPrimaryL : lightPrimaryL;

      const primary = `hsl(${h} ${primaryS}% ${primaryL}%)`;

      // Primary container is a softer tone derived from hue
      const containerS = Math.max(30, primaryS - 30);
      const lightContainerL = 94;
      const darkContainerL = 28;
      const containerL = isDark ? darkContainerL : lightContainerL;
      const primaryContainer = `hsl(${h} ${containerS}% ${containerL}%)`;

      // on-primary should provide readable contrast; pick white for darker primaries
      const onPrimary = primaryL < 55 ? "#ffffff" : "#000000";

      // Map a few supporting variables to influence UI components using them
      document.documentElement.style.setProperty("--md-sys-color-primary", primary);
      document.documentElement.style.setProperty("--md-sys-color-primary-container", primaryContainer);
      document.documentElement.style.setProperty("--md-sys-color-on-primary", onPrimary);

      // Keep surface variables consistent: adjust surface-container highlights slightly towards neutral
      // For expressive themed accents we only nudge the surface containers slightly in dark mode
      if (isDark) {
        document.documentElement.style.setProperty("--md-sys-color-surface-container-high", "#2B2930");
        document.documentElement.style.setProperty("--md-sys-color-surface-container", "#211F26");
        document.documentElement.style.setProperty("--md-sys-color-surface-container-low", "#1D1B20");
      } else {
        document.documentElement.style.setProperty("--md-sys-color-surface-container-high", "#ECE6F0");
        document.documentElement.style.setProperty("--md-sys-color-surface-container", "#F3EDF7");
        document.documentElement.style.setProperty("--md-sys-color-surface-container-low", "#F7F2FA");
      }

      localStorage.setItem("accentHue", String(h));

      // update any small UI swatches if present
      const sw = document.getElementById("accent-swatch");
      if (sw) sw.style.background = primary;
    } catch (e) {
      console.error("Failed to apply accent hue", e);
    }
  },
};

export const store = createStore("preferences", model);
