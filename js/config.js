/* ==========================================================
   config.js — Exposes config data from WAVE_CONFIG global
   ========================================================== */

const Config = {
  _data: null,

  load() {
    this._data = typeof WAVE_CONFIG !== 'undefined' ? WAVE_CONFIG : null;
    return this._data;
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
