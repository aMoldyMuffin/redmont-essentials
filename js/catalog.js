/**
 * Shared catalog loader for homepage + order page
 */
(function (global) {
  'use strict';

  const config = typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : {};
  let cached = null;

  function formatMoney(catalog, amount) {
    const n = Number(amount) || 0;
    if (n <= 0) return 'Quote';
    const suffix = catalog.currencySuffix || '';
    return `${catalog.currency || '$'}${n.toLocaleString()}${suffix}`;
  }

  function calculateOrderPrice(catalog, orderType, itemText) {
    if (!itemText?.trim()) return { total: 0, display: '—', quotable: true };

    if (orderType === 'Other') {
      return { total: 0, display: 'Quote on request', quotable: true };
    }

    const parts = itemText
      .split(/[,—–-]/)
      .map((p) => p.trim())
      .filter(Boolean);

    let total = 0;
    let matched = 0;
    let hasCustom = false;

    for (const part of parts) {
      const kit = catalog.kits.find((k) => k.id === part || part.includes(k.id));
      if (kit) {
        if (kit.price <= 0) hasCustom = true;
        else total += kit.price;
        matched++;
        continue;
      }
      const cat = catalog.categories.find((c) => c.id === part || part.includes(c.id));
      if (cat) {
        total += cat.price;
        matched++;
      }
    }

    if (orderType === 'Sell Items' && matched > 0) {
      const mult = catalog.pricing?.sellMultiplier ?? 0.8;
      total = Math.round(total * mult);
    }

    if (matched === 0 || hasCustom) {
      return { total: 0, display: 'Quote on request', quotable: true };
    }

    return { total, display: formatMoney(catalog, total), quotable: false };
  }

  /** Static file on Pages — always works without Monty */
  async function fetchStaticCatalog() {
    const res = await fetch('/config/catalog.json', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.kits?.length) {
      throw new Error('Static catalog file missing');
    }
    return data;
  }

  /** Live catalog from Monty via Cloudflare /api/catalog */
  async function fetchFromApi() {
    const apiUrl = config.catalogApiUrl || '/api/catalog';
    const res = await fetch(apiUrl, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.catalog?.kits?.length) {
      throw new Error(data.error || `Catalog API returned ${res.status}`);
    }
    return data.catalog;
  }

  /** Order page: API → static → error */
  async function fetchCatalog() {
    if (cached) return cached;

    try {
      cached = await fetchFromApi();
      return cached;
    } catch {
      /* fall through */
    }

    try {
      cached = await fetchStaticCatalog();
      return cached;
    } catch {
      throw new Error('Could not load shop catalog');
    }
  }

  function renderKitsSection(catalog, container) {
    const section = catalog.kitsSection || {};
    const header = container.querySelector('[data-catalog-header]');
    if (header) {
      const tag = header.querySelector('.section-tag');
      const title = header.querySelector('h2');
      const sub = header.querySelector('p');
      if (tag) tag.textContent = section.tag || 'Starter Packages';
      if (title) title.textContent = section.title || 'Gear Kits';
      if (sub) sub.textContent = section.subtitle || '';
    }

    const grid = container.querySelector('[data-kits-grid]');
    if (!grid) return;

    const kits = Array.isArray(catalog.kits) ? catalog.kits : [];
    if (!kits.length) {
      grid.innerHTML =
        '<p class="catalog-loading">Kits could not be loaded. <a href="order.html">Order here</a> or try again later.</p>';
      return;
    }

    grid.innerHTML = kits
      .filter((k) => k.id !== 'Custom Kit' || kits.length <= 4)
      .slice(0, 3)
      .map((k, i) => {
        const featured = k.featured;
        const delay = i === 1 ? ' reveal-delay' : i === 2 ? ' reveal-delay-2' : '';
        const btnClass = featured ? 'btn btn-primary btn-card' : 'btn btn-card';
        const price = k.price > 0 ? formatMoney(catalog, k.price) : 'Quote';
        const bullets = (k.bullets || [])
          .map((b) => `<li>${b}</li>`)
          .join('');
        return `
          <article class="card kit-card${featured ? ' featured' : ''} reveal${delay}">
            ${featured ? '<div class="card-badge">Most Popular</div>' : ''}
            <div class="card-icon">${k.icon || '📦'}</div>
            <h3>${k.id}</h3>
            <p class="kit-price">${price}</p>
            <p>${k.description}</p>
            <ul class="card-list">${bullets}</ul>
            <a href="order.html?type=Gear%20Kit&item=${encodeURIComponent(k.id)}" class="${btnClass}">Order Now</a>
          </article>
        `;
      })
      .join('');

    container.querySelectorAll('.reveal').forEach((el) => {
      requestAnimationFrame(() => el.classList.add('visible'));
    });
  }

  function renderTradeSection(catalog, container) {
    const trade = catalog.trade || {};
    const panels = container.querySelectorAll('[data-trade-panel]');
    if (panels[0]) {
      const h3 = panels[0].querySelector('h3');
      const tags = panels[0].querySelector('.trade-tags');
      if (h3) h3.textContent = trade.sellTitle || 'We Sell';
      if (tags) {
        tags.innerHTML = (trade.sellTags || [])
          .map((t) => `<span>${t}</span>`)
          .join('');
      }
    }
    if (panels[1]) {
      const h3 = panels[1].querySelector('h3');
      const tags = panels[1].querySelector('.trade-tags');
      if (h3) h3.textContent = trade.buyTitle || 'We Buy';
      if (tags) {
        tags.innerHTML = (trade.buyTags || [])
          .map((t) => `<span>${t}</span>`)
          .join('');
      }
    }
  }

  global.CatalogAPI = {
    fetchCatalog,
    fetchStaticCatalog,
    fetchFromApi,
    formatMoney,
    calculateOrderPrice,
    renderKitsSection,
    renderTradeSection,
    clearCache: () => {
      cached = null;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
