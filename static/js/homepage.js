document.addEventListener('DOMContentLoaded', function() {
    const SAVED_KEY = 'verka_saved_items';
    let allProducts = [];
    const popularGrid = document.querySelector('.product-grid');
    const otherGrid = document.querySelector('.other-grid');
    const reverseGrid = document.querySelector('.reverse-grid');
    const heroSearchInput = document.querySelector('.hero .group .input');

    if (!popularGrid || !otherGrid) {
        return;
    }

    function loadProducts() {
        fetch('/api/airtable/records')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.records) {
                    allProducts = data.records;
                    displayProducts();
                }
            })
            .catch(error => console.error('Error loading products:', error));
    }

    function displayProducts() {
        if (allProducts.length === 0) return;

        popularGrid.innerHTML = '';
        otherGrid.innerHTML = '';

        allProducts.forEach((record, index) => {
            const card = createProductCard(record);
            if (index < 6) {
                popularGrid.appendChild(card);
            }
        });

        allProducts.forEach((record) => {
            const card = createProductCard(record);
            otherGrid.appendChild(card);
        });
    }

    function createProductCard(record) {
        const fields = record.fields;
        const card = document.createElement('a');
        card.className = 'product-card';
        card.href = '/product/' + encodeURIComponent(record.id);

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

        const isSaved = getSavedIds().includes(record.id);

        card.innerHTML = `
            <div class="product-name-ribbon">
                <p class="product-name">${name}</p>
            </div>
            <div class="product-thumb">
                ${photoHtml}
            </div>
            <div class="product-info">
                <button class="product-save ${isSaved ? 'is-saved' : ''}" type="button" aria-label="Save item">
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
            saveButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const savedIds = getSavedIds();
                const isAlreadySaved = savedIds.includes(record.id);

                if (isAlreadySaved) {
                    setSavedIds(savedIds.filter((id) => id !== record.id));
                    saveButton.classList.remove('is-saved');
                } else {
                    setSavedIds([...savedIds, record.id]);
                    saveButton.classList.add('is-saved');
                }
            });
        }

        return card;
    }

    if (heroSearchInput) {
        heroSearchInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') {
                return;
            }

            e.preventDefault();
            const term = (heroSearchInput.value || '').trim();
            const query = term ? `?q=${encodeURIComponent(term)}` : '';
            window.location.href = `/explore${query}`;
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatEuro(value) {
        return Number(value).toFixed(2).replace('.00', '');
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

    function loadReverseRequests() {
        if (!reverseGrid) return;
        fetch('/api/airtable/reverse-records')
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success' && data.records) {
                    renderReverseCards(data.records);
                }
            })
            .catch(err => console.error('Error loading reverse records:', err));
    }

    function renderReverseCards(records) {
        reverseGrid.innerHTML = '';

        records.slice(0, 4).forEach(record => {
            const f = record.fields;
            const name = escapeHtml(f.Title || f.Name || 'Unnamed item');
            const buyer = escapeHtml(f.BuyerName || '');
            const category = escapeHtml(f.Category || '');
            const budget = f.Budget ? `€${Number(f.Budget).toFixed(0)}` : 'Open';
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

    loadProducts();
    loadReverseRequests();
});
