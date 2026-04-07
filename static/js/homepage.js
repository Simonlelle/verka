document.addEventListener('DOMContentLoaded', function () {
  const SAVED_KEY = 'verka_saved_items';
  let allProducts = [];
 
  // Use specific IDs from the improved template
  const popularGrid = document.getElementById('popularGrid') || document.querySelector('.product-grid');
  const otherGrid = document.getElementById('otherGrid') || document.querySelector('.other-grid');
  const reverseGrid = document.getElementById('reverseGrid') || document.querySelector('.reverse-grid');
  const heroSearchInput = document.querySelector('.hero .group .input');
 
  // ── Active sidebar link ────────────────────────────────────
  const currentPath = window.location.pathname;
  document.querySelectorAll('.side-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && (href === currentPath || (href !== '/' && currentPath.startsWith(href)))) {
      link.classList.add('active');
    } else if (href === '/' && currentPath === '/') {
      link.classList.add('active');
    }
  });
 
  if (!popularGrid || !otherGrid) return;
 
  // ── Shared save store ──────────────────────────────────────
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
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
    } catch {
      // localStorage blocked (Safari private mode etc.) — fail silently
    }
  }
 
  // ── Products ───────────────────────────────────────────────
  function loadProducts() {
    fetch('/api/airtable/records')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success' && data.records) {
          allProducts = data.records;
          displayProducts();
        }
      })
      .catch((err) => {
        console.error('Error loading products:', err);
        // Clear skeletons on error, show nothing (graceful degradation)
        popularGrid.innerHTML = '';
        otherGrid.innerHTML = '';
      });
  }
 
  function displayProducts() {
    if (allProducts.length === 0) {
      popularGrid.innerHTML = '';
      otherGrid.innerHTML = '';
      return;
    }
 
    // Clear skeleton placeholders
    popularGrid.innerHTML = '';
    otherGrid.innerHTML = '';
 
    allProducts.forEach((record, index) => {
      if (index < 5) {
        popularGrid.appendChild(createProductCard(record));
      }
      otherGrid.appendChild(createProductCard(record));
    });
  }
 
  function createProductCard(record) {
    const fields = record.fields;
    const card = document.createElement('a');
    card.className = 'product-card';
    card.href = '/product/' + encodeURIComponent(record.id);
 
    const name = escapeHtml(fields.Name || 'Untitled');
    const category = escapeHtml(fields.Category || '');
 
    const numericPrice = Number.parseFloat(fields.Price);
    const hasPrice = Number.isFinite(numericPrice);
    const nowPrice = hasPrice ? `${formatEuro(numericPrice)}€` : 'N/A';
 
    let photoHtml = '';
    if (fields.Photo && fields.Photo.length > 0) {
      const photoUrl = fields.Photo[0].thumbnails?.large?.url || fields.Photo[0].url;
      photoHtml = `<img src="${photoUrl}" alt="${name}" loading="lazy">`;
    } else {
      photoHtml = `<div class="product-thumb-placeholder"><span>${name.substring(0, 20)}${name.length > 20 ? '…' : ''}</span></div>`;
    }
 
    const isSaved = getSavedIds().includes(record.id);
 
    // Always-visible name (improved over ribbon-only)
    card.innerHTML = `
      <div class="product-thumb">${photoHtml}</div>
      <div class="product-name-ribbon"><p class="product-name">${name}</p></div>
      <div class="product-info">
        <button class="product-save ${isSaved ? 'is-saved' : ''}" type="button" aria-label="${isSaved ? 'Remove from saved' : 'Save item'}">
          <svg viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
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
      saveButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
 
        const savedIds = getSavedIds();
        const isAlreadySaved = savedIds.includes(record.id);
 
        if (isAlreadySaved) {
          setSavedIds(savedIds.filter((id) => id !== record.id));
          saveButton.classList.remove('is-saved');
          saveButton.setAttribute('aria-label', 'Save item');
          saveButton.querySelector('svg').setAttribute('fill', 'none');
        } else {
          setSavedIds([...savedIds, record.id]);
          saveButton.classList.add('is-saved');
          saveButton.setAttribute('aria-label', 'Remove from saved');
          saveButton.querySelector('svg').setAttribute('fill', 'currentColor');
        }
      });
    }
 
    return card;
  }
 
  // ── Hero search ────────────────────────────────────────────
  if (heroSearchInput) {
    heroSearchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const term = (heroSearchInput.value || '').trim();
      const query = term ? `?q=${encodeURIComponent(term)}` : '';
      window.location.href = `/explore${query}`;
    });
  }
 
  // ── Reverse requests ───────────────────────────────────────
  function loadReverseRequests() {
    if (!reverseGrid) return;
    fetch('/api/airtable/reverse-records')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success' && data.records) {
          renderReverseCards(data.records);
        }
      })
      .catch((err) => {
        console.error('Error loading reverse records:', err);
        reverseGrid.innerHTML = '';
      });
  }
 
  function renderReverseCards(records) {
    reverseGrid.innerHTML = '';
 
    records.slice(0, 3).forEach((record) => {
      const f = record.fields;
      const name = escapeHtml(f.Title || f.Name || 'Unnamed item');
      const buyer = escapeHtml(f.BuyerName || '');
      const category = escapeHtml(f.Category || '');
      const budget = f.Budget ? `€${Number(f.Budget).toFixed(0)}` : 'Open budget';
      const detailHref = record.id ? `/reverse/${encodeURIComponent(record.id)}` : '/reverse';
 
      const card = document.createElement('a');
      card.className = 'reverse-request-card';
      card.href = detailHref;
      card.innerHTML = `
        <div class="reverse-request-tags">
          ${category ? `<span class="reverse-request-tag">${category}</span>` : ''}
        </div>
        <h3 class="reverse-request-title">${name}</h3>
        <div class="reverse-request-footer">
          <div class="reverse-request-budget">
            <span>Budget</span>
            ${budget}
          </div>
          ${buyer ? `<span class="reverse-request-offers">${buyer}</span>` : ''}
        </div>
      `;
      reverseGrid.appendChild(card);
    });
 
    const ghost = document.createElement('a');
    ghost.className = 'reverse-request-card reverse-request-card--ghost';
    ghost.href = '/add-reverse';
    ghost.innerHTML = `
      <div class="reverse-request-empty-mark">+</div>
      <h3 class="reverse-request-title">Post your own buy request</h3>
      <p class="reverse-request-note">Tell sellers what you need and wait for offers to come in.</p>
    `;
    reverseGrid.appendChild(ghost);
  }
 
  // ── Utils ──────────────────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
 
  function formatEuro(value) {
    return Number(value).toFixed(2).replace('.00', '');
  }
 
  // ── Init ───────────────────────────────────────────────────
  loadProducts();
  loadReverseRequests();
});