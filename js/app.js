/* ==========================================================
   app.js — State machine, screen routing, event wiring
   ========================================================== */

const App = {
  state: {
    currentScreen: 'scanning',
    currentLocationId: null,
    visitedLocations: new Set(),
    bleSupported: false
  },

  async init() {
    // Load config
    const data = await Config.load();
    if (!data) {
      console.error('Failed to load config — app cannot start');
      return;
    }

    // Check BLE support
    this.state.bleSupported = BLE.isSupported();

    // Restore visited progress from localStorage
    this.restoreState();

    // Initialize modules
    Scanning.init();
    Locations.init();

    // Wire up event handlers
    this.bindEvents();

    // Start the scanning screen animation
    this.showScreen('scanning');
    Scanning.startAnimation();
  },

  // ---- State persistence ----

  restoreState() {
    try {
      const saved = localStorage.getItem('wave_visited');
      if (saved) {
        const arr = JSON.parse(saved);
        this.state.visitedLocations = new Set(arr);
      }
    } catch (e) {
      // Ignore corrupt data
    }
  },

  persistState() {
    try {
      localStorage.setItem('wave_visited',
        JSON.stringify([...this.state.visitedLocations]));
    } catch (e) {
      // localStorage might be unavailable
    }
  },

  // ---- Screen management ----

  showScreen(screenName) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => {
      if (s.dataset.screen === screenName) {
        s.classList.add('screen--active', 'screen--entering');
        s.addEventListener('animationend', () => {
          s.classList.remove('screen--entering');
        }, { once: true });
      } else if (s.classList.contains('screen--active')) {
        // Animate the outgoing screen
        s.classList.add('screen--exiting');
        s.addEventListener('animationend', () => {
          s.classList.remove('screen--active', 'screen--exiting');
        }, { once: true });
      }
    });

    this.state.currentScreen = screenName;

    // Screen-specific setup
    if (screenName === 'scanning') {
      Scanning.startAnimation();
    }

    if (screenName === 'location') {
      Locations.renderLocationContent(this.state.currentLocationId);
      Locations.updateProgressDots(this.state.currentLocationId, this.state.visitedLocations);

      // Update scan-again button text if journey is complete
      const scanAgainBtn = document.getElementById('btn-scan-again');
      if (this.checkCompletion()) {
        scanAgainBtn.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'btn-icon';
        icon.textContent = '\u2713';
        scanAgainBtn.appendChild(icon);
        scanAgainBtn.appendChild(document.createTextNode(' Complete Journey'));
      } else {
        scanAgainBtn.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'btn-icon';
        icon.textContent = '\u25CE';
        scanAgainBtn.appendChild(icon);
        scanAgainBtn.appendChild(document.createTextNode(' Scan again'));
      }
    }

    if (screenName === 'manual-select') {
      Locations.updateManualCards(this.state.visitedLocations);
      // Update subtitle if BLE not supported
      const subtitle = document.getElementById('manual-subtitle');
      if (!this.state.bleSupported) {
        subtitle.textContent = 'Bluetooth is not available on this device. Select your location below.';
      }
    }
  },

  // ---- Navigation ----

  goToLocation(locationId) {
    this.state.currentLocationId = locationId;
    this.state.visitedLocations.add(locationId);
    this.persistState();

    // Always show the location content first
    this.showScreen('location');
  },

  checkCompletion() {
    return this.state.visitedLocations.size >= Config.locations.length;
  },

  // ---- Event handlers ----

  bindEvents() {
    // "I'm here" button — attempt BLE scan
    document.getElementById('btn-im-here').addEventListener('click', async () => {
      const result = await BLE.scan();

      if (result.success) {
        this.goToLocation(result.locationId);
      } else {
        // BLE failed or unsupported — show manual selector
        this.showScreen('manual-select');
      }
    });

    // "Or choose your location" link
    document.getElementById('btn-manual').addEventListener('click', () => {
      this.showScreen('manual-select');
    });

    // Back to scanning from manual selector
    document.getElementById('btn-back-scan').addEventListener('click', () => {
      this.showScreen('scanning');
    });

    // Manual location card clicks (delegated)
    document.getElementById('location-cards').addEventListener('click', (e) => {
      const card = e.target.closest('.location-select-card');
      if (card) {
        this.goToLocation(card.dataset.locationId);
      }
    });

    // Previous step
    document.getElementById('btn-prev').addEventListener('click', () => {
      const current = Config.getLocation(this.state.currentLocationId);
      if (current && current.step > 1) {
        const prev = Config.getLocationByStep(current.step - 1);
        if (prev) this.goToLocation(prev.id);
      }
    });

    // Next step
    document.getElementById('btn-next').addEventListener('click', () => {
      const current = Config.getLocation(this.state.currentLocationId);
      if (current && current.step < Config.locations.length) {
        const next = Config.getLocationByStep(current.step + 1);
        if (next) this.goToLocation(next.id);
      }
    });

    // Scan again (or complete if all visited)
    document.getElementById('btn-scan-again').addEventListener('click', () => {
      if (this.checkCompletion()) {
        this.showScreen('completion');
      } else {
        this.showScreen('scanning');
      }
    });

    // Restart (completion screen)
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.state.visitedLocations.clear();
      this.state.currentLocationId = null;
      this.persistState();
      this.showScreen('scanning');
    });
  }
};

// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
