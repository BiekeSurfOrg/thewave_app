/* ==========================================================
   locations.js — Location content rendering + navigation
   ========================================================== */

const Locations = {
  init() {
    this.renderProgressDots();
    this.renderManualCards();
    this.renderCompletionSteps();
  },

  renderProgressDots() {
    const container = document.getElementById('progress-dots');
    if (!container) return;
    container.textContent = '';

    Config.locations.forEach(loc => {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.dataset.location = loc.id;
      container.appendChild(dot);
    });
  },

  updateProgressDots(currentId, visitedSet) {
    const dots = document.querySelectorAll('#progress-dots .dot');
    dots.forEach(dot => {
      const locId = dot.dataset.location;
      dot.classList.toggle('dot--visited', visitedSet.has(locId));
      dot.classList.toggle('dot--current', locId === currentId);

      if (locId === currentId) {
        const loc = Config.getLocation(locId);
        if (loc) {
          dot.style.background = loc.color;
          dot.style.borderColor = loc.color;
        }
      } else if (visitedSet.has(locId)) {
        dot.style.background = '';
        dot.style.borderColor = '';
      } else {
        dot.style.background = '';
        dot.style.borderColor = '';
      }
    });
  },

  renderLocationContent(locationId) {
    const loc = Config.getLocation(locationId);
    if (!loc) return;

    // Update step badge
    const badge = document.getElementById('step-badge');
    badge.textContent = loc.step;
    badge.style.background = loc.color;

    // Update step number
    document.getElementById('step-number').textContent = loc.step;

    // Update content
    document.getElementById('location-name').textContent = loc.name;
    document.getElementById('location-tagline').textContent = loc.tagline;
    document.getElementById('location-description').textContent = loc.description;

    // Render detail bullets with location color
    const detailsList = document.getElementById('location-details');
    detailsList.textContent = '';
    loc.details.forEach(detail => {
      const li = document.createElement('li');
      li.textContent = detail;
      detailsList.appendChild(li);
    });

    // Style the bullet dots via CSS custom property
    document.documentElement.style.setProperty('--current-location-color', loc.color);

    // Update card border accent
    const card = document.getElementById('location-card');
    card.style.borderTop = '3px solid ' + loc.color;

    // Trigger content entrance animation
    card.classList.remove('card--enter');
    void card.offsetHeight;
    card.classList.add('card--enter');

    // Update navigation buttons
    document.getElementById('btn-prev').disabled = (loc.step === 1);
    document.getElementById('btn-next').disabled = (loc.step === Config.locations.length);
  },

  renderManualCards() {
    const container = document.getElementById('location-cards');
    if (!container) return;
    container.textContent = '';

    Config.locations.forEach(loc => {
      const card = document.createElement('div');
      card.className = 'location-select-card';
      card.dataset.locationId = loc.id;

      // Step circle
      const stepCircle = document.createElement('div');
      stepCircle.className = 'card-step';
      stepCircle.style.background = loc.color;
      stepCircle.textContent = loc.step;

      // Info section
      const info = document.createElement('div');
      info.className = 'card-info';

      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = loc.name;

      const tagline = document.createElement('div');
      tagline.className = 'card-tagline';
      tagline.textContent = loc.tagline;

      info.appendChild(name);
      info.appendChild(tagline);

      // Visited check
      const visited = document.createElement('span');
      visited.className = 'card-visited';
      visited.textContent = '\u2713';

      // Arrow icon
      const arrow = document.createElement('span');
      arrow.className = 'card-arrow';
      const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrowSvg.setAttribute('width', '20');
      arrowSvg.setAttribute('height', '20');
      arrowSvg.setAttribute('viewBox', '0 0 24 24');
      arrowSvg.setAttribute('fill', 'none');
      arrowSvg.setAttribute('stroke', 'currentColor');
      arrowSvg.setAttribute('stroke-width', '2');
      arrowSvg.setAttribute('stroke-linecap', 'round');
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M9 18l6-6-6-6');
      arrowSvg.appendChild(arrowPath);
      arrow.appendChild(arrowSvg);

      card.appendChild(stepCircle);
      card.appendChild(info);
      card.appendChild(visited);
      card.appendChild(arrow);

      container.appendChild(card);
    });
  },

  updateManualCards(visitedSet) {
    const cards = document.querySelectorAll('.location-select-card');
    cards.forEach(card => {
      const locId = card.dataset.locationId;
      card.classList.toggle('is-visited', visitedSet.has(locId));
    });
  },

  renderCompletionSteps() {
    const container = document.getElementById('completion-steps');
    if (!container) return;
    container.textContent = '';

    Config.locations.forEach(loc => {
      const item = document.createElement('div');
      item.className = 'completion-step-item';

      const dot = document.createElement('span');
      dot.className = 'completion-step-dot';
      dot.style.background = loc.color;

      const name = document.createElement('span');
      name.className = 'completion-step-name';
      name.textContent = loc.step + '. ' + loc.name;

      const check = document.createElement('span');
      check.className = 'completion-step-check';
      check.textContent = '\u2713';

      item.appendChild(dot);
      item.appendChild(name);
      item.appendChild(check);
      container.appendChild(item);
    });
  }
};
