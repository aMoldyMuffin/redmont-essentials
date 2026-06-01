(function () {
  'use strict';

  const kitsSection = document.getElementById('kits');
  const tradeSection = document.getElementById('trade');

  async function init() {
    try {
      const catalog = await CatalogAPI.fetchCatalog();
      if (kitsSection) CatalogAPI.renderKitsSection(catalog, kitsSection);
      if (tradeSection) CatalogAPI.renderTradeSection(catalog, tradeSection);
    } catch (err) {
      console.warn('Catalog load failed:', err.message);
    }
  }

  init();
})();
