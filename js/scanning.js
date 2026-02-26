/* ==========================================================
   scanning.js — Footprint animation controller
   ========================================================== */

const Scanning = {
  _container: null,

  init() {
    this._container = document.querySelector('.screen-scanning');
  },

  startAnimation() {
    if (!this._container) this.init();

    // Remove and re-add class to restart CSS animations
    this._container.classList.remove('scanning--animating');

    // Reset all footprint animations by forcing reflow
    const footprints = this._container.querySelectorAll('.footprint');
    footprints.forEach(fp => {
      fp.style.animation = 'none';
      fp.offsetHeight; // force reflow
      fp.style.animation = '';
    });

    // Reset path draw animation
    const pathDraw = this._container.querySelector('.wave-path-draw');
    if (pathDraw) {
      pathDraw.style.animation = 'none';
      pathDraw.offsetHeight;
      pathDraw.style.animation = '';
    }

    // Reset scanning content fade
    const content = this._container.querySelector('.scanning-content');
    if (content) {
      content.style.animation = 'none';
      content.offsetHeight;
      content.style.animation = '';
    }

    // Trigger animations
    void this._container.offsetHeight;
    this._container.classList.add('scanning--animating');
  },

  stopAnimation() {
    if (this._container) {
      this._container.classList.remove('scanning--animating');
    }
  }
};
