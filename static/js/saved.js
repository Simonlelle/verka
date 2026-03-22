document.addEventListener('DOMContentLoaded', () => {
  const SAVED_KEY = 'verka_saved_items';
  const grid = document.getElementById('savedGrid');
  const emptyEl = document.getElementById('savedEmpty');
  const loadingEl = document.getElementById('savedLoading');
  const errorEl = document.getElementById('savedError');
  const subEl = document.getElementById('savedSub');
  const countEl = document.getElementById('savedCount');
  const pluralEl = document.getElementById('savedPlural');
  const resultsBar = document.getElementById('savedResultsBar');
  const clearAllBtn = document.getElementById('clearAllBtn');

  if (!grid || !emptyEl || !loadingEl || !errorEl || !subEl || !countEl || !pluralEl || !resultsBar || !clearAllBtn) {
    return;
  }

  function getSavedIds() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setSavedIds(ids) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  }

  function updateCount() {
    const n = grid.querySelectorAll('.saved-card').length;
    countEl.textContent = String(n);
    pluralEl.textContent = n === 1 ? '' : 's';
    subEl.textContent = n === 0 ? 'Nothing saved yet' : `${n} product${n === 1 ? '' : 's'} saved`;

    if (n === 0) {
      resultsBar.classList.remove('visible');
      clearAllBtn.classList.remove('visible');
      emptyEl.classList.add('visible');
    }
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function removeCard(card, recordId) {
    card.classList.add('removing');
    card.addEventListener(
      'animationend',
      () => {
        card.remove();
        updateCount();
      },
      { once: true }
    );

    const ids = getSavedIds().filter((id) => id !== recordId);
    setSavedIds(ids);
  }

  function buildCard(record, index) {
    const f = record.fields || {};
    const id = record.id;
    const name = escapeHtml(f.Name || 'Untitled');

    const price = parseFloat(f.Price);
    const priceHtml = Number.isFinite(price) ? `${price % 1 === 0 ? price : price.toFixed(2)}€` : '—';

    let imgHtml = '';
    if (f.Photo && f.Photo.length > 0) {
      const url = f.Photo[0].thumbnails?.large?.url || f.Photo[0].url;
      imgHtml = `<img class="saved-card-img" src="${url}" alt="${name}" loading="lazy">`;
    } else {
      imgHtml = `
        <div class="saved-card-img-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>`;
    }

    const categoryHtml = f.Category ? `<span class="saved-card-category">${escapeHtml(f.Category)}</span>` : '';

    const card = document.createElement('a');
    card.className = 'saved-card';
    card.href = `/product/${encodeURIComponent(id)}`;
    card.style.animationDelay = `${index * 40}ms`;

    card.innerHTML = `
      ${imgHtml}
      <div class="saved-card-body">
        ${categoryHtml}
        <span class="saved-card-name">${name}</span>
        <div class="saved-card-footer">
          <span class="saved-card-price">${priceHtml}</span>
          <button class="saved-card-unsave" type="button" aria-label="Remove from saved">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.saved-card-unsave')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeCard(card, id);
    });

    return card;
  }

  clearAllBtn.addEventListener('click', () => {
    setSavedIds([]);
    const cards = Array.from(grid.querySelectorAll('.saved-card'));
    cards.forEach((card, i) => {
      setTimeout(() => {
        card.classList.add('removing');
        card.addEventListener(
          'animationend',
          () => {
            card.remove();
            updateCount();
          },
          { once: true }
        );
      }, i * 50);
    });
  });

  (function load() {
    const savedIds = getSavedIds();

    if (savedIds.length === 0) {
      loadingEl.classList.remove('visible');
      emptyEl.classList.add('visible');
      subEl.textContent = 'Nothing saved yet';
      return;
    }

    fetch('/api/airtable/records')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        loadingEl.classList.remove('visible');

        if (data.status !== 'success' || !Array.isArray(data.records)) {
          throw new Error('Unexpected response from server');
        }

        const byId = new Map(data.records.map((r) => [r.id, r]));
        const toShow = savedIds.map((id) => byId.get(id)).filter(Boolean);

        if (toShow.length === 0) {
          emptyEl.classList.add('visible');
          subEl.textContent = 'Nothing saved yet';
          setSavedIds([]);
          return;
        }

        toShow.forEach((record, i) => grid.appendChild(buildCard(record, i)));

        const n = toShow.length;
        countEl.textContent = String(n);
        pluralEl.textContent = n === 1 ? '' : 's';
        subEl.textContent = `${n} product${n === 1 ? '' : 's'} saved`;
        resultsBar.classList.add('visible');
        clearAllBtn.classList.add('visible');
      })
      .catch((err) => {
        loadingEl.classList.remove('visible');
        errorEl.textContent = `Could not load saved items: ${err.message}`;
        errorEl.classList.add('visible');
        subEl.textContent = 'Error loading items';
      });
  })();
});
