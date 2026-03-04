/* ==========================================================
   logger.js — Diagnostic UI overlay for BLE Scanning
   ========================================================== */

const Logger = {
    _overlay: null,
    _list: null,
    _btnOpen: null,
    _btnClose: null,
    _btnClear: null,
    _btnToggle: null,

    isScanning: false,

    init() {
        this._overlay = document.getElementById('log-overlay');
        this._list = document.getElementById('log-list');

        this._btnOpen = document.getElementById('btn-open-log');
        this._btnClose = document.getElementById('btn-log-close');
        this._btnClear = document.getElementById('btn-log-clear');
        this._btnToggle = document.getElementById('btn-log-pause');

        if (!this._overlay || !this._btnOpen) return;

        this.bindEvents();
    },

    bindEvents() {
        // Open Log
        this._btnOpen.addEventListener('click', () => {
            this._overlay.classList.add('is-open');
        });

        // Close Log
        this._btnClose.addEventListener('click', () => {
            this._overlay.classList.remove('is-open');
        });

        // Clear Log
        this._btnClear.addEventListener('click', () => {
            this._list.innerHTML = '';
        });

        // Toggle Scanning
        this._btnToggle.addEventListener('click', () => {
            if (this.isScanning) {
                this.stopLogging();
            } else {
                this.startLogging();
            }
        });
    },

    async startLogging() {
        this.isScanning = true;
        this._btnToggle.textContent = 'Pause';

        // Clear old data when starting a fresh diagnostic run
        this._list.innerHTML = '';
        this.addLog('System', 'Starting diagnostic scan...', 0);

        // Call the updated BLE scan method, passing our logger as the callback
        await BLE.scan((device, rssi, isSystemMsg = false) => {
            if (!this.isScanning) return;

            if (isSystemMsg) {
                // device struct contains `{name: "Zone Status", id: "System"}` and rssi is our string message.
                this.addLog(device.id, rssi, 0); // Display as [System] My message
            } else {
                this.addLog(device.name || device.id || 'Unknown Device', device.id || 'N/A', rssi);
            }
        });

        // Scanning finished (timeout or error)
        if (this.isScanning) {
            this.addLog('System', 'Scan completed/timeout.', 0);
            this.stopLogging();
        }
    },

    stopLogging() {
        this.isScanning = false;
        this._btnToggle.textContent = 'Start';

        // Try to stop any active native scan if running via Capacitor
        if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins) {
            window.Capacitor.Plugins.BleClient.stopLEScan().catch(() => { });
        }
    },

    addLog(name, id, rssi) {
        // Keep list pruned to 100 items to avoid DOM lag
        if (this._list.childElementCount > 100) {
            this._list.removeChild(this._list.lastChild);
        }

        const li = document.createElement('li');
        li.className = 'log-item';

        // Highlight strong beacons (> -80)
        if (rssi > -80 && rssi < 0) {
            li.classList.add('log-item--strong');
        }

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'log-item-details';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'log-item-name';
        nameSpan.textContent = name;

        const idSpan = document.createElement('span');
        idSpan.style.fontSize = '11px';
        idSpan.textContent = id;

        detailsDiv.appendChild(nameSpan);
        if (id !== 'N/A') {
            detailsDiv.appendChild(idSpan);
        }

        const rssiSpan = document.createElement('span');
        rssiSpan.className = 'log-item-rssi';
        rssiSpan.textContent = rssi ? `${rssi} dBm` : '';

        li.appendChild(detailsDiv);
        li.appendChild(rssiSpan);

        // Insert at the top of the list
        this._list.insertBefore(li, this._list.firstChild);
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    Logger.init();
});
