/**
 * VERKA — explore.js (improved)
 *
 * Changes vs original:
 * 1. Safe localStorage wrapper (won't crash in Safari private mode)
 * 2. Category filter normalised to lowercase on both sides
 * 3. Search input auto-focused when ?q= param is present
 * 4. Active sidebar link highlight shared pattern
 */

const SAVED_KEY = 'verka_saved_items';

function getSaved() {
  try {
    const r = localStorage.getItem(SAVED_KEY);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}

function setSaved(ids) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    // Fail silently — Safari private mode, storage full, etc.
  }
}

function toggleSave(btn) {
  const id = btn.getAttribute('data-id');
  const ids = getSaved();
  const idx = ids.indexOf(id);

  if (idx === -1) {
    ids.push(id);
    btn.classList.add('is-saved');
    btn.setAttribute('aria-label', 'Remove from saved');
  } else {
    ids.splice(idx, 1);
    btn.classList.remove('is-saved');
    btn.setAttribute('aria-label', 'Save item');
  }

  setSaved(ids);
}

document.addEventListener('DOMContentLoaded', () => {
  // ── Active sidebar state ──────────────────────────────────
  document.querySelectorAll('.side-link').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href !== '/' && window.location.pathname.startsWith(href)) {
      link.classList.add('active');
    }
  });

  // ── Mark already-saved items ──────────────────────────────
  const saved = getSaved();
  document.querySelectorAll('.explore-card-save').forEach((btn) => {
    if (saved.includes(btn.getAttribute('data-id'))) {
      btn.classList.add('is-saved');
    }

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSave(btn);
    });
  });

  const cards = Array.from(document.querySelectorAll('.explore-card'));
  const searchEl = document.getElementById('exploreSearch');
  const searchClear = document.getElementById('searchClear');
  const sortEl = document.getElementById('exploreSort');
  const priceMinEl = document.getElementById('priceMin');
  const priceMaxEl = document.getElementById('priceMax');
  const countEl = document.getElementById('resultsCount');
  const emptyEl = document.getElementById('emptyState');
  const clearAllBtn = document.getElementById('clearAll');
  const grid = document.getElementById('exploreGrid');

  if (!searchEl || !searchClear || !sortEl || !priceMinEl || !priceMaxEl || !countEl || !emptyEl || !clearAllBtn || !grid) {
    return;
  }

  let activeCategory = 'all';

  const getFilters = () => ({
    query: (searchEl.value || '').trim().toLowerCase(),
    category: activeCategory,
    priceMin: parseFloat(priceMinEl.value) || 0,
    priceMax: parseFloat(priceMaxEl.value) || Infinity,
    sort: sortEl.value,
  });

  const filtersActive = (f) =>
    f.query || f.category !== 'all' || f.priceMin > 0 || f.priceMax < Infinity;

  const applyFilters = () => {
    const f = getFilters();

    let visible = cards.filter((card) => {
      const name = (card.getAttribute('data-name') || '').toLowerCase();
      const catRaw = card.getAttribute('data-category-raw') || '';
      const catLower = (card.getAttribute('data-category') || '').toLowerCase();
      const price = parseFloat(card.getAttribute('data-price'));

      const matchQuery = !f.query || name.includes(f.query) || catLower.includes(f.query);
      // FIX: normalise category comparison to lowercase on both sides
      const matchCategory = f.category === 'all' || catRaw.toLowerCase() === f.category.toLowerCase();
      const matchPrice = Number.isNaN(price) || (price >= f.priceMin && price <= f.priceMax);

      return matchQuery && matchCategory && matchPrice;
    });

    visible.sort((a, b) => {
      const nameA = a.getAttribute('data-name') || '';
      const nameB = b.getAttribute('data-name') || '';
      const priceA = parseFloat(a.getAttribute('data-price')) || 0;
      const priceB = parseFloat(b.getAttribute('data-price')) || 0;

      if (f.sort === 'price-asc') return priceA - priceB;
      if (f.sort === 'price-desc') return priceB - priceA;
      if (f.sort === 'name-asc') return nameA.localeCompare(nameB);
      if (f.sort === 'name-desc') return nameB.localeCompare(nameA);
      return 0;
    });

    const hiddenSet = new Set(cards.filter((c) => !visible.includes(c)));

    visible.forEach((card) => {
      card.style.display = '';
      grid.insertBefore(card, emptyEl);
    });

    hiddenSet.forEach((card) => {
      card.style.display = 'none';
    });

    countEl.textContent = String(visible.length);
    emptyEl.classList.toggle('visible', visible.length === 0);
    clearAllBtn.classList.toggle('visible', !!filtersActive(f));
    searchClear.classList.toggle('visible', !!f.query);
  };

  document.querySelectorAll('.cat-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategory = pill.getAttribute('data-cat') || 'all';
      applyFilters();
    });
  });

  searchEl.addEventListener('input', applyFilters);

  searchClear.addEventListener('click', () => {
    searchEl.value = '';
    applyFilters();
    searchEl.focus();
  });

  sortEl.addEventListener('change', applyFilters);
  priceMinEl.addEventListener('input', applyFilters);
  priceMaxEl.addEventListener('input', applyFilters);

  clearAllBtn.addEventListener('click', () => {
    searchEl.value = '';
    priceMinEl.value = '';
    priceMaxEl.value = '';
    sortEl.value = 'default';
    activeCategory = 'all';
    document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    const allPill = document.querySelector('.cat-pill[data-cat="all"]');
    if (allPill) allPill.classList.add('active');
    applyFilters();
  });

  // Pre-fill search from ?q= URL param and auto-focus
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  if (q) {
    searchEl.value = q;
    // FIX: focus and move cursor to end so user can keep typing
    searchEl.focus();
    searchEl.setSelectionRange(q.length, q.length);
  }

  applyFilters();
});