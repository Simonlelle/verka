document.addEventListener('DOMContentLoaded', () => {
  const SAVED_KEY = 'verka_saved_items';
  const savedGrid = document.getElementById('savedGrid');
  const savedEmpty = document.getElementById('savedEmpty');

  if (!savedGrid || !savedEmpty) {
    return;
  }

  const savedIds = getSavedIds();
  if (savedIds.length === 0) {
    savedEmpty.style.display = 'block';
    return;
  }

  fetch('/api/airtable/records')
    .then((response) => response.json())
    .then((data) => {
      if (data.status !== 'success' || !Array.isArray(data.records)) {
        throw new Error('Failed to load records');
      }

      const recordsById = new Map(data.records.map((record) => [record.id, record]));
      const savedRecords = savedIds
        .map((id) => recordsById.get(id))
        .filter(Boolean);

      if (savedRecords.length === 0) {
        savedEmpty.style.display = 'block';
        return;
      }

      savedRecords.forEach((record) => {
        savedGrid.appendChild(createProductCard(record));
      });
    })
    .catch(() => {
      savedEmpty.textContent = 'Could not load saved products right now.';
      savedEmpty.style.display = 'block';
    });

  function createProductCard(record) {
    const fields = record.fields || {};
    const card = document.createElement('a');
    card.className = 'product-card';
    card.href = `/product/${encodeURIComponent(record.id)}`;

    const name = escapeHtml(fields.Name || 'Untitled');
    const numericPrice = Number.parseFloat(fields.Price);
    const hasPrice = Number.isFinite(numericPrice);
    const nowPrice = hasPrice ? `${formatEuro(numericPrice)}€` : 'N/A';

    let photoHtml = '';
    if (fields.Photo && fields.Photo.length > 0) {
      const photoUrl = fields.Photo[0].thumbnails?.large?.url || fields.Photo[0].url;
      photoHtml = `<img src="${photoUrl}" alt="${name}">`;
    } else {
      photoHtml = `<div class="product-thumb-placeholder"><span>${name.substring(0, 20)}${name.length > 20 ? '...' : ''}</span></div>`;
    }

    card.innerHTML = `
      <div class="product-name-ribbon">
        <p class="product-name">${name}</p>
      </div>
      <div class="product-thumb">
        ${photoHtml}
      </div>
      <div class="product-info">
        <button class="product-save is-saved" type="button" aria-label="Unsave item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <div class="product-prices">
          <span class="product-price">${nowPrice}</span>
        </div>
      </div>
    `;

    const saveButton = card.querySelector('.product-save');
    if (saveButton) {
      saveButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const ids = getSavedIds().filter((id) => id !== record.id);
        setSavedIds(ids);
        card.remove();

        if (!savedGrid.querySelector('.product-card')) {
          savedEmpty.style.display = 'block';
        }
      });
    }

    return card;
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatEuro(value) {
    return Number(value).toFixed(2).replace('.00', '');
  }
});
