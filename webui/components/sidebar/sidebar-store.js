import { createStore } from "/js/AlpineStore.js";

// This store manages the visibility and state of the main sidebar panel.
const model = {
  isOpen: true,
  defaultOpen: true, // Persisted preference
  _initialized: false,

  // Centralized collapse state for all sidebar sections (persisted in localStorage)
  sectionStates: {
    tasks: false,       // default: collapsed
    preferences: false  // default: collapsed
  },

  // Initialize the store by setting up a resize listener
  // Guard ensures this runs only once, even if called from multiple components
  init() {
    if (this._initialized) return;
    this._initialized = true;

    this.loadSectionStates();
    this.loadDefaultVisibility(); // Load preference
    this.handleResize();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
  },

  // Load section collapse states from localStorage
  loadSectionStates() {
    try {
      const stored = localStorage.getItem('sidebarSections');
      if (stored) {
        this.sectionStates = { ...this.sectionStates, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load sidebar section states', e);
    }
  },

  // Persist section states to localStorage
  persistSectionStates() {
    try {
      localStorage.setItem('sidebarSections', JSON.stringify(this.sectionStates));
    } catch (e) {
      console.error('Failed to persist section states', e);
    }
  },

  // Check if a section should be open (used by x-init in templates)
  isSectionOpen(name) {
    return this.sectionStates[name] === true;
  },

  // Toggle and persist a section's open state (drives Bootstrap programmatically via components)
  toggleSection(name) {
    if (!(name in this.sectionStates)) return;
    this.sectionStates[name] = !this.sectionStates[name];
    this.persistSectionStates();
  },

  // Cleanup method for lifecycle management
  destroy() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this._initialized = false;
  },

  // Toggle the sidebar's visibility
  toggle() {
    this.isOpen = !this.isOpen;
  },

  // Close the sidebar, e.g., on overlay click on mobile
  close() {
    if (this.isMobile()) {
      this.isOpen = false;
    }
  },

  // Handle browser resize to show/hide sidebar based on viewport width
  handleResize() {
    if (this.isMobile()) {
      this.isOpen = false;
    } else {
      // On desktop, respect the default preference
      this.isOpen = this.defaultOpen;
    }
  },

  // Check if the current viewport is mobile
  isMobile() {
    return window.innerWidth <= 768;
  },

  // Toggle default visibility preference
  toggleDefaultVisibility() {
    this.defaultOpen = !this.defaultOpen;
    this.persistDefaultVisibility();
    // If on desktop, apply the new setting immediately
    if (!this.isMobile()) {
      this.isOpen = this.defaultOpen;
    }
  },

  // Load default visibility from localStorage
  loadDefaultVisibility() {
    try {
      const stored = localStorage.getItem('sidebarDefaultOpen');
      if (stored !== null) {
        this.defaultOpen = JSON.parse(stored);
      } else {
        this.defaultOpen = true; // Default to true if not set
      }
    } catch (e) {
      console.error('Failed to load sidebar default visibility', e);
      this.defaultOpen = true;
    }
  },

  // Persist default visibility to localStorage
  persistDefaultVisibility() {
    try {
      localStorage.setItem('sidebarDefaultOpen', JSON.stringify(this.defaultOpen));
    } catch (e) {
      console.error('Failed to persist sidebar default visibility', e);
    }
  },
};

export const store = createStore("sidebar", model);
