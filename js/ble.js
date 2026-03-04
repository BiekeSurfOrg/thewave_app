/* ==========================================================
   ble.js — Hybrid Web Bluetooth / Capacitor Bluetooth LE
   ========================================================== */

const BLE = {
  isSupported() {
    return ('bluetooth' in navigator) || (window.Capacitor && window.Capacitor.isNativePlatform());
  },

  async scan(rawStreamCallback = null) {
    if (!this.isSupported()) {
      return { success: false, reason: 'unsupported' };
    }

    const meta = Config.meta;
    const prefix = meta.bleNamePrefix || 'Wave-';

    // 1. CAPACITOR NATIVE BLUETOOTH LE
    if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.BleClient) {
      return this._runCapacitorScan(prefix, rawStreamCallback);
    }

    // 2. WEB BLUETOOTH (BEST RSSI)
    if ('requestLEScan' in navigator.bluetooth) {
      console.log('Starting Web Bluetooth proximity scan...');
      try {
        const scanner = await navigator.bluetooth.requestLEScan({
          acceptAllAdvertisements: true,
          keepRepeatedDevices: true
        });

        return new Promise((resolve) => {
          let bestDevice = null;
          let highestRssi = -100;

          const onAdvertisement = (event) => {
            // Diagnostic streaming bypasses all filters
            if (rawStreamCallback) {
              rawStreamCallback(event.device, event.rssi);
            }

            if (event.rssi <= -80) return; // Strict threshold

            let uuidObj = null;
            if (event.uuids && event.uuids.length > 0) uuidObj = event.uuids[0];

            if (!uuidObj && event.manufacturerData && event.manufacturerData.has(76)) {
              // Parse Apple iBeacon Data
              const data = event.manufacturerData.get(76);
              if (data.byteLength >= 23 && data.getUint8(0) === 0x02 && data.getUint8(1) === 0x15) {
                const uuidHex = [];
                for (let i = 2; i < 18; i++) uuidHex.push(data.getUint8(i).toString(16).padStart(2, '0'));
                uuidObj = `${uuidHex.slice(0, 4).join('')}-${uuidHex.slice(4, 6).join('')}-${uuidHex.slice(6, 8).join('')}-${uuidHex.slice(8, 10).join('')}-${uuidHex.slice(10, 16).join('')}`;
              }
            }

            let location = uuidObj ? Config.getLocationByUUID(uuidObj) : null;
            if (!location && event.device.name && event.device.name.startsWith(prefix)) {
              location = Config.getLocationByDeviceName(event.device.name);
            }

            if (location && event.rssi > highestRssi) {
              highestRssi = event.rssi;
              bestDevice = event.device;
              bestDevice._locationMatch = location;
            }
          };

          navigator.bluetooth.addEventListener('advertisementreceived', onAdvertisement);

          // Let diagnostic run longer (10s) vs standard routing (3s)
          let timeoutAmount = rawStreamCallback ? 10000 : 3000;

          setTimeout(() => {
            scanner.stop();
            navigator.bluetooth.removeEventListener('advertisementreceived', onAdvertisement);

            if (bestDevice && bestDevice._locationMatch) {
              resolve({
                success: true,
                locationId: bestDevice._locationMatch.id,
                deviceName: bestDevice.name || 'Beacon',
                rssi: highestRssi
              });
              return;
            }

            if (!rawStreamCallback) {
              this._runManualPicker(prefix).then(resolve);
            } else {
              resolve({ success: false, reason: 'timeout' });
            }
          }, timeoutAmount);
        });
      } catch (error) {
        console.warn('Web Bluetooth scanning failed:', error);
      }
    }

    // 3. FALLBACK TO MANUAL PICKER
    return this._runManualPicker(prefix, rawStreamCallback);
  },

  async _runCapacitorScan(prefix, rawStreamCallback = null) {
    console.log('Starting Capacitor Bluetooth proximity scan...');
    const { BleClient } = window.Capacitor.Plugins;

    try {
      await BleClient.initialize({ androidNeverForLocation: false });

      return new Promise((resolve) => {
        let bestDeviceMatched = null;
        let highestRssi = -100;

        BleClient.requestLEScan({}, (result) => {
          // Diagnostic logger callback bypasses threshold filters
          if (rawStreamCallback) {
            rawStreamCallback(result.device, result.rssi);
          }

          if (result.rssi <= -80) return; // Strict threshold

          // Check standard UUID arrays
          let location = null;
          if (result.uuids && result.uuids.length > 0) {
            location = Config.getLocationByUUID(result.uuids[0]);
          }

          // Check manufacturer data (Apple Company ID is typically 0x004C)
          if (!location && result.manufacturerData) {
            const keys = Object.keys(result.manufacturerData);
            for (let i = 0; i < keys.length; i++) {
              const dataView = result.manufacturerData[keys[i]];
              if (dataView.byteLength >= 23 && dataView.getUint8(0) === 0x02 && dataView.getUint8(1) === 0x15) {
                const uuidHex = [];
                for (let j = 2; j < 18; j++) uuidHex.push(dataView.getUint8(j).toString(16).padStart(2, '0'));
                const uuidStr = `${uuidHex.slice(0, 4).join('')}-${uuidHex.slice(4, 6).join('')}-${uuidHex.slice(6, 8).join('')}-${uuidHex.slice(8, 10).join('')}-${uuidHex.slice(10, 16).join('')}`;
                location = Config.getLocationByUUID(uuidStr);
                if (location) break;
              }
            }
          }

          // Check name prefix fallback
          if (!location && result.device.name && result.device.name.startsWith(prefix)) {
            location = Config.getLocationByDeviceName(result.device.name);
          }

          if (location && result.rssi > highestRssi) {
            highestRssi = result.rssi;
            bestDeviceMatched = {
              device: result.device,
              location: location
            };
          }
        });

        const timeoutAmount = rawStreamCallback ? 10000 : 3000;

        // Scan duration
        setTimeout(async () => {
          await BleClient.stopLEScan();

          if (bestDeviceMatched) {
            resolve({
              success: true,
              locationId: bestDeviceMatched.location.id,
              deviceName: bestDeviceMatched.device.name || 'Beacon',
              rssi: highestRssi
            });
          } else {
            resolve({ success: false, reason: 'no-match' });
          }
        }, timeoutAmount);

      });

    } catch (error) {
      console.error('Capacitor Plugin Bluetooth Error:', error);
      return { success: false, reason: 'error', error: error.message };
    }
  },

  async _runManualPicker(prefix, rawStreamCallback = null) {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      // Native Apps don't have a built-in browser UI picker, fallback immediately to error or UI manual selection.
      return { success: false, reason: 'cancelled' };
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: prefix }],
        optionalServices: [] // Web BT requires explicit services here if querying later
      });

      // Pass exact manual device ping into logs
      if (rawStreamCallback) {
        rawStreamCallback(device, -50); // Hardcoded 'fake' strong RSSI since manual picker lacks true RSSI
      }

      const location = Config.getLocationByDeviceName(device.name);
      if (location) {
        return { success: true, locationId: location.id, deviceName: device.name };
      }
      return { success: false, reason: 'no-match', deviceName: device.name };
    } catch (error) {
      if (error.name === 'NotFoundError') return { success: false, reason: 'cancelled' };
      if (error.name === 'SecurityError') return { success: false, reason: 'insecure-context' };

      // Provide detailed error reason into diagnostic log if requested
      if (rawStreamCallback) {
        rawStreamCallback({ name: `Error: ${error.name}`, id: error.message }, 0);
      }
      return { success: false, reason: 'error', error: error.message };
    }
  }
};
