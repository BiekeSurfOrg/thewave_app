/* ==========================================================
   ble.js — Hybrid Web Bluetooth / Capacitor Bluetooth LE
   ========================================================== */

class ZoneTracker {
  constructor(threshold = -80, bufferSize = 5) {
    this.threshold = threshold;
    this.bufferSize = bufferSize;
    this.deviceHistory = new Map(); // Stores [rssi, rssi, ...] per UUID
  }

  // Adds a new reading and returns the smoothed average
  processReading(uuid, rssi) {
    if (!this.deviceHistory.has(uuid)) {
      this.deviceHistory.set(uuid, []);
    }

    const history = this.deviceHistory.get(uuid);
    history.push(rssi);

    // Keep only the last N readings
    if (history.length > this.bufferSize) {
      history.shift();
    }

    // Calculate Simple Moving Average (SMA)
    const average = history.reduce((a, b) => a + b) / history.length;
    return average;
  }

  // Determine if we should trigger a "Zone Enter" or "Zone Exit"
  // Hysteresis (2dBm) prevents flickering at the boundary
  isUserInZone(currentAverage) {
    const hysteresis = 2;
    return currentAverage > (this.threshold + hysteresis);
  }
}

const BLE = {
  isSupported() {
    return ('bluetooth' in navigator) || (window.Capacitor && window.Capacitor.isNativePlatform());
  },

  async scan(rawStreamCallback = null) {
    if (rawStreamCallback) rawStreamCallback({ name: "Engine Initializing", id: "System" }, `Checking hardware support...`, true);

    if (!this.isSupported()) {
      if (rawStreamCallback) rawStreamCallback({ name: "Error", id: "System" }, `Bluetooth is unsupported on this device.`, true);
      return { success: false, reason: 'unsupported' };
    }

    const meta = Config.meta;
    const prefix = meta.bleNamePrefix || 'Wave-';

    // 1. CAPACITOR NATIVE BLUETOOTH LE
    if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.BleClient) {
      if (rawStreamCallback) rawStreamCallback({ name: "Mode Selected", id: "System" }, `Using Capacitor Native Bluetooth`, true);
      return this._runCapacitorScan(prefix, rawStreamCallback);
    }

    // 2. WEB BLUETOOTH (BEST RSSI)
    if ('requestLEScan' in navigator.bluetooth) {
      if (rawStreamCallback) rawStreamCallback({ name: "Mode Selected", id: "System" }, `Using Web Bluetooth (requestLEScan)`, true);
      console.log('Starting Web Bluetooth proximity scan...');
      try {
        const scanner = await navigator.bluetooth.requestLEScan({
          acceptAllAdvertisements: true,
          keepRepeatedDevices: true
        });

        if (rawStreamCallback) rawStreamCallback({ name: "Scanner Active", id: "System" }, `Listening for background beacons...`, true);

        return new Promise((resolve) => {
          let bestDevice = null;
          let highestAvgRssi = -100;
          const tracker = new ZoneTracker(-80, 5);

          const onAdvertisement = (event) => {
            // Parse UUID or Name to uniquely track the device
            let uuidObj = null;
            if (event.uuids && event.uuids.length > 0) uuidObj = event.uuids[0];

            if (!uuidObj && event.manufacturerData && event.manufacturerData.has(76)) {
              const data = event.manufacturerData.get(76);
              if (data.byteLength >= 23 && data.getUint8(0) === 0x02 && data.getUint8(1) === 0x15) {
                const uuidHex = [];
                for (let i = 2; i < 18; i++) uuidHex.push(data.getUint8(i).toString(16).padStart(2, '0'));
                uuidObj = `${uuidHex.slice(0, 4).join('')}-${uuidHex.slice(4, 6).join('')}-${uuidHex.slice(6, 8).join('')}-${uuidHex.slice(8, 10).join('')}-${uuidHex.slice(10, 16).join('')}`;
              }
            }

            const trackingId = uuidObj || event.device.name || event.device.id;
            const smoothedRssi = tracker.processReading(trackingId, event.rssi);
            const inZone = tracker.isUserInZone(smoothedRssi);

            // Diagnostic streaming bypasses routing logic to show everything
            if (rawStreamCallback) {
              rawStreamCallback(event.device, event.rssi);

              const location = uuidObj ? Config.getLocationByUUID(uuidObj) : Config.getLocationByDeviceName(event.device.name);
              const displayName = location ? location.name : trackingId;

              if (inZone) {
                rawStreamCallback({ name: "Zone Status", id: "System" }, `You have entered: ${displayName}`, true);
              } else {
                rawStreamCallback({ name: "Zone Tracker", id: "System" }, `Smoothing ${displayName} (${Math.round(smoothedRssi)} dBm)...`, true);
              }
            }

            if (!inZone) return; // Strict threshold smoothed by hysteresis

            let location = uuidObj ? Config.getLocationByUUID(uuidObj) : null;
            if (!location && event.device.name && event.device.name.startsWith(prefix)) {
              location = Config.getLocationByDeviceName(event.device.name);
            }

            if (location && smoothedRssi > highestAvgRssi) {
              highestAvgRssi = smoothedRssi;
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
                rssi: highestAvgRssi
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
        if (rawStreamCallback) rawStreamCallback({ name: "Fallback triggered", id: "System" }, `requestLEScan failed: ${error.message}`, true);
      }
    }

    // 3. FALLBACK TO MANUAL PICKER
    return this._runManualPicker(prefix, rawStreamCallback);
  },

  async _runCapacitorScan(prefix, rawStreamCallback = null) {
    if (rawStreamCallback) rawStreamCallback({ name: "Initializing Plugin", id: "System" }, `Starting Capacitor Native...`, true);
    console.log('Starting Capacitor Bluetooth proximity scan...');
    const { BleClient } = window.Capacitor.Plugins;

    try {
      await BleClient.initialize({ androidNeverForLocation: false });
      if (rawStreamCallback) rawStreamCallback({ name: "Plugin Ready", id: "System" }, `Listening for raw hardware beacons...`, true);

      return new Promise((resolve) => {
        let bestDeviceMatched = null;
        let highestAvgRssi = -100;
        const tracker = new ZoneTracker(-80, 5);

        BleClient.requestLEScan({}, (result) => {
          // Check standard UUID arrays
          let location = null;
          let uuidObj = null;

          if (result.uuids && result.uuids.length > 0) {
            uuidObj = result.uuids[0];
            location = Config.getLocationByUUID(uuidObj);
          }

          // Check manufacturer data (Apple Company ID is typically 0x004C)
          if (!location && result.manufacturerData) {
            const keys = Object.keys(result.manufacturerData);
            for (let i = 0; i < keys.length; i++) {
              const dataView = result.manufacturerData[keys[i]];
              if (dataView.byteLength >= 23 && dataView.getUint8(0) === 0x02 && dataView.getUint8(1) === 0x15) {
                const uuidHex = [];
                for (let j = 2; j < 18; j++) uuidHex.push(dataView.getUint8(j).toString(16).padStart(2, '0'));
                uuidObj = `${uuidHex.slice(0, 4).join('')}-${uuidHex.slice(4, 6).join('')}-${uuidHex.slice(6, 8).join('')}-${uuidHex.slice(8, 10).join('')}-${uuidHex.slice(10, 16).join('')}`;
                location = Config.getLocationByUUID(uuidObj);
                if (location) break;
              }
            }
          }

          // Check name prefix fallback
          if (!location && result.device.name && result.device.name.startsWith(prefix)) {
            location = Config.getLocationByDeviceName(result.device.name);
          }

          const trackingId = uuidObj || result.device.name || result.device.deviceId;
          const smoothedRssi = tracker.processReading(trackingId, result.rssi);
          const inZone = tracker.isUserInZone(smoothedRssi);

          // Diagnostic logger callback bypasses threshold routing filters
          if (rawStreamCallback) {
            rawStreamCallback(result.device, result.rssi);
            const displayName = location ? location.name : trackingId;

            if (inZone) {
              rawStreamCallback({ name: "Zone Status", id: "System" }, `You have entered: ${displayName}`, true);
            } else {
              rawStreamCallback({ name: "Zone Tracker", id: "System" }, `Smoothing ${displayName} (${Math.round(smoothedRssi)} dBm)...`, true);
            }
          }

          if (!inZone) return; // Strict threshold smoothed by hysteresis

          if (location && smoothedRssi > highestAvgRssi) {
            highestAvgRssi = smoothedRssi;
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
          if (rawStreamCallback) rawStreamCallback({ name: "Hardware Stopped", id: "System" }, `Native scan window closed.`, true);

          if (bestDeviceMatched) {
            resolve({
              success: true,
              locationId: bestDeviceMatched.location.id,
              deviceName: bestDeviceMatched.device.name || 'Beacon',
              rssi: highestAvgRssi
            });
          } else {
            resolve({ success: false, reason: 'no-match' });
          }
        }, timeoutAmount);

      });

    } catch (error) {
      if (rawStreamCallback) rawStreamCallback({ name: "Fatal Hardware Error", id: "System" }, error.message, true);
      console.error('Capacitor Plugin Bluetooth Error:', error);
      return { success: false, reason: 'error', error: error.message };
    }
  },

  async _runManualPicker(prefix, rawStreamCallback = null) {
    if (rawStreamCallback) rawStreamCallback({ name: "Mode Selected", id: "System" }, `Falling back to Web Bluetooth Manual Picker`, true);

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      // Native Apps don't have a built-in browser UI picker, fallback immediately to error or UI manual selection.
      return { success: false, reason: 'cancelled' };
    }

    try {
      if (rawStreamCallback) rawStreamCallback({ name: "Awaiting Input", id: "System" }, `Please select a device from the browser popup`, true);
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: prefix }],
        optionalServices: [] // Web BT requires explicit services here if querying later
      });

      // Pass exact manual device ping into logs
      if (rawStreamCallback) {
        rawStreamCallback({ name: "Manual Selection", id: "System" }, `User picked: ${device.name}`, true);
        rawStreamCallback(device, -50); // Hardcoded 'fake' strong RSSI since manual picker lacks true RSSI
      }

      const location = Config.getLocationByDeviceName(device.name);
      if (location) {
        return { success: true, locationId: location.id, deviceName: device.name };
      }
      return { success: false, reason: 'no-match', deviceName: device.name };
    } catch (error) {
      if (error.name === 'NotFoundError') {
        if (rawStreamCallback) rawStreamCallback({ name: "Selection Cancelled", id: "System" }, `Prompt was dismissed`, true);
        return { success: false, reason: 'cancelled' };
      }
      if (error.name === 'SecurityError') {
        if (rawStreamCallback) rawStreamCallback({ name: "Security Error", id: "System" }, `Insecure context or lacking permissions`, true);
        return { success: false, reason: 'insecure-context' };
      }

      // Provide detailed error reason into diagnostic log if requested
      if (rawStreamCallback) {
        rawStreamCallback({ name: `Error: ${error.name}`, id: "System" }, error.message, true);
      }
      return { success: false, reason: 'error', error: error.message };
    }
  }
};
