/* ==========================================================
   config.js — Loads wave-config.json and exposes the data
   ========================================================== */

const Config = {
  _data: null,

  async load() {
    try {
      const response = await fetch('wave-config.json');
      if (!response.ok) throw new Error('Failed to load config');
      this._data = await response.json();
      return this._data;
    } catch (err) {
      console.error('Config load error:', err);
      return null;
    }
  },

  get meta() {
    return this._data?.meta || {};
  },

  get locations() {
    return this._data?.locations || [];
  },

  getLocation(id) {
    return this.locations.find(loc => loc.id === id) || null;
  },

  getLocationByStep(step) {
    return this.locations.find(loc => loc.step === step) || null;
  },

  getLocationByDeviceName(deviceName) {
    return this.locations.find(loc => loc.bleDeviceName === deviceName) || null;
  }
};
