(function () {
  'use strict';

  const kitsSection = document.getElementById('kits');
  const tradeSection = document.getElementById('trade');

  function showGridError(message) {
    const grid = kitsSection?.querySelector('[data-kits-grid]');
    if (grid) {
      grid.innerHTML = `<p class="catalog-loading">${message} <a href="order.html">Place an order</a></p>`;
    }
  }

  function render(catalog) {
    if (kitsSection) CatalogAPI.renderKitsSection(catalog, kitsSection);
    if (tradeSection) CatalogAPI.renderTradeSection(catalog, tradeSection);
  }

  async function init() {
    if (typeof CatalogAPI === 'undefined') {
      showGridError('Catalog scripts failed to load.');
      return;
    }

    let showedKits = false;

    // 1) Static JSON — shows as /config/catalog.json in Network (works without Monty)
    try {
      const staticCatalog = await CatalogAPI.fetchStaticCatalog();
      render(staticCatalog);
      showedKits = true;
    } catch (err) {
      console.warn('Static catalog failed:', err.message);
    }

    // 2) Live API — shows as /api/catalog in Network (needs Monty + MONTY_API_URL on Cloudflare)
    try {
      const liveCatalog = await CatalogAPI.fetchFromApi();
      render(liveCatalog);
      showedKits = true;
    } catch (err) {
      console.warn('Live catalog API failed:', err.message);
    }

    if (!showedKits) {
      showGridError('Could not load kits.');
    }
  }

  init();
})();
