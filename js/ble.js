/* ==========================================================
   ble.js — Web Bluetooth API integration + fallback
   ========================================================== */

const BLE = {
  isSupported() {
    return 'bluetooth' in navigator;
  },

  async scan() {
    if (!this.isSupported()) {
      return { success: false, reason: 'unsupported' };
    }

    const meta = Config.meta;

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: meta.bleNamePrefix || 'Wave-' }
        ],
        optionalServices: []
      });

      // Match the selected device to a configured location
      const location = Config.getLocationByDeviceName(device.name);

      if (location) {
        return {
          success: true,
          locationId: location.id,
          deviceName: device.name
        };
      }

      return { success: false, reason: 'no-match', deviceName: device.name };

    } catch (error) {
      if (error.name === 'NotFoundError') {
        // User cancelled the device picker
        return { success: false, reason: 'cancelled' };
      }
      if (error.name === 'SecurityError') {
        // Not served over HTTPS
        return { success: false, reason: 'insecure-context' };
      }
      return { success: false, reason: 'error', error };
    }
  }
};
