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
    const prefix = meta.bleNamePrefix || 'Wave-';

    // 1. TRY AUTOMATIC SCANNING (BEST RSSI)
    // This requires 'requestLEScan' support (Chrome Experimental / Bluefy)
    if ('requestLEScan' in navigator.bluetooth) {
      console.log('Starting proximity scan...');
      try {
        const scanner = await navigator.bluetooth.requestLEScan({
          filters: [{ namePrefix: prefix }],
          keepRepeatedDevices: true
        });

        return new Promise((resolve) => {
          let bestDevice = null;
          let highestRssi = -100;

          const onAdvertisement = (event) => {
            console.log(`Found: ${event.device.name} (RSSI: ${event.rssi})`);
            if (event.rssi > highestRssi) {
              highestRssi = event.rssi;
              bestDevice = event.device;
            }
          };

          navigator.bluetooth.addEventListener('advertisementreceived', onAdvertisement);

          // Scan for 3 seconds to find the strongest signal
          setTimeout(() => {
            scanner.stop();
            navigator.bluetooth.removeEventListener('advertisementreceived', onAdvertisement);

            if (bestDevice) {
              const location = Config.getLocationByDeviceName(bestDevice.name);
              if (location) {
                resolve({
                  success: true,
                  locationId: location.id,
                  deviceName: bestDevice.name,
                  rssi: highestRssi
                });
                return;
              }
            }
            // If scanning found nothing, fall back to manual picker
            this._runManualPicker(prefix).then(resolve);
          }, 3000);
        });
      } catch (error) {
        console.warn('Scanning API failed, falling back to picker:', error);
      }
    }

    // 2. FALLBACK TO MANUAL PICKER
    return this._runManualPicker(prefix);
  },

  async _runManualPicker(prefix) {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: prefix }],
        optionalServices: []
      });

      const location = Config.getLocationByDeviceName(device.name);
      if (location) {
        return { success: true, locationId: location.id, deviceName: device.name };
      }
      return { success: false, reason: 'no-match', deviceName: device.name };
    } catch (error) {
      if (error.name === 'NotFoundError') return { success: false, reason: 'cancelled' };
      if (error.name === 'SecurityError') return { success: false, reason: 'insecure-context' };
      return { success: false, reason: 'error', error: error.message };
    }
  }
};
