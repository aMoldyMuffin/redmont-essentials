(function () {
  'use strict';

  const loginEl = document.getElementById('adminLogin');
  const panelEl = document.getElementById('adminPanel');
  const shopPanelEl = document.getElementById('adminShopPanel');
  const inventoryPanelEl = document.getElementById('adminInventoryPanel');
  const tabsEl = document.getElementById('adminTabs');
  const statusEl = document.getElementById('adminStatus');
  const kitsList = document.getElementById('kitsList');
  const categoriesList = document.getElementById('categoriesList');
  const editorEl = document.getElementById('catalogEditor');

  if (!loginEl) return;

  const STORAGE_KEY = 're_admin_token';
  let catalogSnapshot = null;

  function getToken() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }

  function setToken(t) {
    sessionStorage.setItem(STORAGE_KEY, t);
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = 'admin-status' + (isError ? ' error' : ' success');
  }

  function getActiveTab() {
    return tabsEl?.querySelector('.admin-tab.active')?.dataset.tab || 'shop';
  }

  function setActiveTab(tab) {
    if (!tabsEl) return;
    tabsEl.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (shopPanelEl) shopPanelEl.hidden = tab !== 'shop';
    if (inventoryPanelEl) inventoryPanelEl.hidden = tab !== 'inventory';
  }

  async function reloadActiveTab() {
    if (getActiveTab() === 'inventory' && window.InventoryAdmin) {
      await window.InventoryAdmin.load();
      showStatus('Inventory reloaded from Eleanor.', false);
      return;
    }
    CatalogAPI.clearCache();
    await loadCatalog();
    showStatus('Shop catalog reloaded.', false);
  }

  async function saveActiveTab() {
    if (getActiveTab() === 'inventory' && window.InventoryAdmin) {
      await window.InventoryAdmin.save();
      return;
    }
    await saveCatalog();
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function defaultKit() {
    return {
      id: 'New Kit',
      icon: '📦',
      description: '',
      shortDesc: '',
      price: 1000,
      featured: false,
      bullets: [],
    };
  }

  function defaultCategory() {
    return { id: 'New Category', price: 100 };
  }

  function kitCardHtml(kit, index) {
    const bullets = (kit.bullets || []).join('\n');
    return `
      <article class="admin-item" data-kit-index="${index}">
        <div class="admin-item-head">
          <strong>Kit ${index + 1}</strong>
          <button type="button" class="admin-remove" data-remove-kit aria-label="Remove kit">Remove</button>
        </div>
        <div class="admin-grid-2">
          <div class="admin-field">
            <label>Kit name (display)</label>
            <input type="text" data-kit-id value="${esc(kit.id)}" required maxlength="80" />
            <span class="field-hint">Shown on the site and Discord. Duplicate names like &quot;Coming Soon&quot; are OK.</span>
          </div>
          <div class="admin-field">
            <label>Icon (emoji)</label>
            <input type="text" data-kit-icon value="${esc(kit.icon)}" maxlength="8" placeholder="🎒" />
          </div>
        </div>
        <div class="admin-grid-2">
          <div class="admin-field">
            <label>Price (0 = quote on request)</label>
            <input type="number" data-kit-price min="0" step="1" value="${Number(kit.price) || 0}" />
          </div>
          <div class="admin-field admin-field-check">
            <label class="admin-check">
              <input type="checkbox" data-kit-featured ${kit.featured ? 'checked' : ''} />
              Most popular (homepage badge)
            </label>
          </div>
        </div>
        <div class="admin-field">
          <label>Short label (order page chip)</label>
          <input type="text" data-kit-short value="${esc(kit.shortDesc)}" maxlength="80" />
        </div>
        <div class="admin-field">
          <label>Description (homepage card)</label>
          <textarea data-kit-desc rows="2">${esc(kit.description)}</textarea>
        </div>
        <div class="admin-field">
          <label>Includes (one per line)</label>
          <textarea data-kit-bullets rows="3" placeholder="Stone tools set">${esc(bullets)}</textarea>
        </div>
      </article>
    `;
  }

  function categoryRowHtml(cat, index) {
    return `
      <article class="admin-item admin-item-compact" data-cat-index="${index}">
        <div class="admin-field admin-field-grow">
          <label>Category name</label>
          <input type="text" data-cat-id value="${esc(cat.id)}" required maxlength="80" />
        </div>
        <div class="admin-field admin-field-price">
          <label>Price</label>
          <input type="number" data-cat-price min="0" step="1" value="${Number(cat.price) || 0}" />
        </div>
        <button type="button" class="admin-remove" data-remove-cat aria-label="Remove">×</button>
      </article>
    `;
  }

  function renderForm(catalog) {
    catalogSnapshot = catalog;

    document.getElementById('currency').value = catalog.currency || '$';
    document.getElementById('sellMultiplier').value =
      catalog.pricing?.sellMultiplier ?? 0.8;

    const section = catalog.kitsSection || {};
    document.getElementById('kitsTag').value = section.tag || '';
    document.getElementById('kitsTitle').value = section.title || '';
    document.getElementById('kitsSubtitle').value = section.subtitle || '';

    kitsList.innerHTML = (catalog.kits || []).map((k, i) => kitCardHtml(k, i)).join('');
    categoriesList.innerHTML = (catalog.categories || [])
      .map((c, i) => categoryRowHtml(c, i))
      .join('');

    if (editorEl) editorEl.value = JSON.stringify(catalog, null, 2);
  }

  function collectKits() {
    const prev = catalogSnapshot?.kits || [];
    return [...kitsList.querySelectorAll('[data-kit-index]')].map((card, index) => {
      const bulletsRaw = card.querySelector('[data-kit-bullets]')?.value || '';
      const bullets = bulletsRaw
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean);
      const kit = {
        id: card.querySelector('[data-kit-id]')?.value.trim() || 'Unnamed Kit',
        icon: card.querySelector('[data-kit-icon]')?.value.trim() || '📦',
        description: card.querySelector('[data-kit-desc]')?.value.trim() || '',
        shortDesc: card.querySelector('[data-kit-short]')?.value.trim() || '',
        price: Number(card.querySelector('[data-kit-price]')?.value) || 0,
        featured: card.querySelector('[data-kit-featured]')?.checked || false,
        bullets,
      };
      if (prev[index]?.key) kit.key = prev[index].key;
      return kit;
    });
  }

  function collectCategories() {
    const prev = catalogSnapshot?.categories || [];
    return [...categoriesList.querySelectorAll('[data-cat-index]')].map((row, index) => {
      const cat = {
        id: row.querySelector('[data-cat-id]')?.value.trim() || 'Unnamed',
        price: Number(row.querySelector('[data-cat-price]')?.value) || 0,
      };
      if (prev[index]?.key) cat.key = prev[index].key;
      return cat;
    });
  }

  function collectCatalogFromForm() {
    const base = catalogSnapshot ? structuredClone(catalogSnapshot) : {};

    return {
      ...base,
      currency: document.getElementById('currency').value.trim() || '$',
      currencySuffix: base.currencySuffix || '',
      kitsSection: {
        tag: document.getElementById('kitsTag').value.trim(),
        title: document.getElementById('kitsTitle').value.trim(),
        subtitle: document.getElementById('kitsSubtitle').value.trim(),
      },
      orderTypes: base.orderTypes || [],
      kits: collectKits(),
      categories: collectCategories(),
      trade: base.trade || {},
      pricing: {
        ...(base.pricing || {}),
        sellMultiplier: Number(document.getElementById('sellMultiplier').value) || 0.8,
      },
    };
  }

  async function loadCatalog() {
    const catalog = await CatalogAPI.fetchCatalog();
    CatalogAPI.clearCache();
    renderForm(catalog);
  }

  async function saveCatalog() {
    const catalog = collectCatalogFromForm();

    if (!catalog.kits.length) {
      showStatus('Add at least one gear kit.', true);
      return;
    }

    const res = await fetch('/api/admin/catalog', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ catalog }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(data.error || 'Save failed', true);
      return;
    }
    CatalogAPI.clearCache();
    if (data.catalog) renderForm(data.catalog);
    showStatus('Saved! Website and Discord /order will update within a minute.', false);
  }

  kitsList?.addEventListener('click', (e) => {
    if (e.target.matches('[data-remove-kit]')) {
      e.target.closest('[data-kit-index]')?.remove();
      [...kitsList.querySelectorAll('[data-kit-index]')].forEach((el, i) => {
        el.dataset.kitIndex = i;
        el.querySelector('.admin-item-head strong').textContent = `Kit ${i + 1}`;
      });
    }
  });

  categoriesList?.addEventListener('click', (e) => {
    if (e.target.matches('[data-remove-cat]')) {
      e.target.closest('[data-cat-index]')?.remove();
    }
  });

  document.getElementById('addKitBtn')?.addEventListener('click', () => {
    const index = kitsList.querySelectorAll('[data-kit-index]').length;
    kitsList.insertAdjacentHTML('beforeend', kitCardHtml(defaultKit(), index));
  });

  document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
    const index = categoriesList.querySelectorAll('[data-cat-index]').length;
    categoriesList.insertAdjacentHTML('beforeend', categoryRowHtml(defaultCategory(), index));
  });

  document.getElementById('applyJsonBtn')?.addEventListener('click', () => {
    try {
      const catalog = JSON.parse(editorEl.value);
      renderForm(catalog);
      showStatus('JSON applied to form. Click Save changes to publish.', false);
    } catch {
      showStatus('Invalid JSON in advanced editor.', true);
    }
  });

  tabsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-tab');
    if (!btn?.dataset.tab) return;
    setActiveTab(btn.dataset.tab);
    showStatus(
      btn.dataset.tab === 'inventory'
        ? 'Edit materials and quantities, then Save.'
        : 'Edit shop fields, then Save.',
      false
    );
  });

  async function afterLogin() {
    loginEl.hidden = true;
    panelEl.hidden = false;
    if (tabsEl) tabsEl.hidden = false;
    setActiveTab('shop');
    await loadCatalog();
    if (window.InventoryAdmin) {
      try {
        await window.InventoryAdmin.load();
      } catch {
        /* Eleanor optional until configured */
      }
    }
    showStatus('Edit the fields below, then click Save changes.', false);
  }

  document.getElementById('adminLoginBtn')?.addEventListener('click', async () => {
    const token = document.getElementById('adminToken').value.trim();
    if (!token) {
      showStatus('Enter your admin secret.', true);
      return;
    }
    setToken(token);
    try {
      await afterLogin();
    } catch (err) {
      setToken('');
      showStatus(err.message || 'Could not load — check your secret.', true);
    }
  });

  document.getElementById('adminSaveBtn')?.addEventListener('click', saveActiveTab);
  document.getElementById('adminReloadBtn')?.addEventListener('click', async () => {
    try {
      await reloadActiveTab();
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
    setToken('');
    loginEl.hidden = false;
    panelEl.hidden = true;
    if (tabsEl) tabsEl.hidden = true;
    showStatus('', false);
  });

  if (getToken()) {
    afterLogin().catch(() => setToken(''));
  }
})();
