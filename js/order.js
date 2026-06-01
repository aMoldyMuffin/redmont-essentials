/**
 * Order page — catalog-driven fields, pricing total
 */
(function () {
  'use strict';

  const config = typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : {};

  const form = document.getElementById('orderForm');
  if (!form) return;

  const orderTypeInput = document.getElementById('orderTypeInput');
  const itemInput = document.getElementById('itemInput');
  const typeGrid = document.getElementById('orderTypeGrid');
  const detailPanel = document.getElementById('orderDetailPanel');
  const detailLabel = document.getElementById('orderDetailLabel');
  const detailHint = document.getElementById('orderDetailHint');
  const orderStatus = document.getElementById('orderStatus');
  const orderSubmit = document.getElementById('orderSubmit');
  const successScreen = document.getElementById('orderSuccess');
  const orderTotalEl = document.getElementById('orderTotal');

  let catalog = null;
  let selectedType = 'Gear Kit';
  let selectedItems = new Set();

  function formatPrice(amount) {
    return CatalogAPI.formatMoney(catalog, amount);
  }

  function categoryPrice(catId) {
    const cat = catalog.categories.find((c) => c.id === catId);
    if (!cat) return 0;
    if (selectedType === 'Sell Items') {
      return Math.round(cat.price * (catalog.pricing?.sellMultiplier ?? 0.8));
    }
    return cat.price;
  }

  function updateOrderTotal() {
    syncItemInput();
    if (!orderTotalEl || !catalog) return;

    const itemText = itemInput.value.trim();
    if (!itemText) {
      orderTotalEl.innerHTML = '<span class="order-total-label">Estimated total</span><span class="order-total-value">—</span>';
      return;
    }

    const pricing = CatalogAPI.calculateOrderPrice(catalog, selectedType, itemText);
    orderTotalEl.innerHTML = `
      <span class="order-total-label">Estimated total</span>
      <span class="order-total-value">${pricing.display}</span>
    `;
    orderTotalEl.dataset.price = String(pricing.total);
    orderTotalEl.dataset.display = pricing.display;
  }

  function renderTypeGrid() {
    typeGrid.innerHTML = catalog.orderTypes
      .map(
        (t) => `
        <button type="button" class="choice-card ${t.id === selectedType ? 'selected' : ''}" data-type="${t.id}">
          <span class="choice-icon">${t.icon}</span>
          <span class="choice-label">${t.label}</span>
          <span class="choice-desc">${t.desc}</span>
        </button>
      `
      )
      .join('');

    typeGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.addEventListener('click', () => setOrderType(btn.dataset.type));
    });
  }

  function renderDetailPanel() {
    selectedItems.clear();
    detailPanel.classList.remove('visible');
    void detailPanel.offsetWidth;
    detailPanel.classList.add('visible');

    if (selectedType === 'Gear Kit') {
      detailLabel.textContent = 'Choose a kit';
      detailHint.textContent = 'Select the starter package you want';
      detailPanel.innerHTML = `
        <div class="chip-grid chip-grid-kits" id="detailOptions">
          ${catalog.kits.map(
            (k) => `
              <button type="button" class="chip chip-lg" data-value="${k.id}">
                <span class="chip-title">${k.id}</span>
                <span class="chip-sub">${k.shortDesc}</span>
                <span class="chip-price">${k.price > 0 ? formatPrice(k.price) : 'Quote'}</span>
              </button>
            `
          ).join('')}
        </div>
      `;
      bindSingleSelect(detailPanel.querySelector('#detailOptions'));
    } else if (selectedType === 'Buy Items' || selectedType === 'Sell Items') {
      detailLabel.textContent =
        selectedType === 'Buy Items' ? 'What do you want to buy?' : 'What are you selling?';
      detailHint.textContent = 'Pick one or more — tap again to deselect';
      detailPanel.innerHTML = `
        <div class="chip-grid" id="detailOptions">
          ${catalog.categories
            .map((c) => {
              const p = categoryPrice(c.id);
              return `<button type="button" class="chip" data-value="${c.id}">
                <span class="chip-title">${c.id}</span>
                <span class="chip-price">${formatPrice(p)}</span>
              </button>`;
            })
            .join('')}
        </div>
        <div class="form-row form-row-spaced">
          <label for="customItem">Specific items <span class="optional">(optional)</span></label>
          <input type="text" id="customItem" maxlength="120" placeholder="e.g. 2 stacks of iron, wheat, oak logs…" />
        </div>
      `;
      bindMultiSelect(detailPanel.querySelector('#detailOptions'));
    } else {
      detailLabel.textContent = 'Describe your request';
      detailHint.textContent = catalog.pricing?.otherNote || 'Tell us what you need';
      detailPanel.innerHTML = `
        <div class="form-row">
          <textarea id="otherRequest" rows="4" maxlength="200" placeholder="What can we help you with?" required></textarea>
        </div>
      `;
    }

    updateOrderTotal();
  }

  function bindSingleSelect(container) {
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedItems.clear();
        selectedItems.add(chip.dataset.value);
        updateOrderTotal();
      });
    });
  }

  function bindMultiSelect(container) {
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.value;
        if (selectedItems.has(val)) {
          selectedItems.delete(val);
          chip.classList.remove('selected');
        } else {
          selectedItems.add(val);
          chip.classList.add('selected');
        }
        updateOrderTotal();
      });
    });
  }

  function syncItemInput() {
    if (selectedType === 'Other') {
      const other = document.getElementById('otherRequest');
      itemInput.value = other?.value.trim() || '';
      return;
    }

    if (selectedType === 'Buy Items' || selectedType === 'Sell Items') {
      const custom = document.getElementById('customItem')?.value.trim();
      const cats = [...selectedItems];
      if (cats.length && custom) itemInput.value = `${cats.join(', ')} — ${custom}`;
      else if (cats.length) itemInput.value = cats.join(', ');
      else itemInput.value = custom || '';
      return;
    }

    itemInput.value = selectedItems.size ? [...selectedItems][0] : '';
  }

  function setOrderType(type) {
    if (selectedType === type) return;
    selectedType = type;
    orderTypeInput.value = type;
    typeGrid.querySelectorAll('.choice-card').forEach((c) => {
      c.classList.toggle('selected', c.dataset.type === type);
    });
    renderDetailPanel();
  }

  function preselectFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const item = params.get('item');

    if (type && catalog.orderTypes.some((t) => t.id === type)) {
      selectedType = type;
      orderTypeInput.value = type;
    }

    renderTypeGrid();
    renderDetailPanel();

    if (item) {
      requestAnimationFrame(() => {
        if (selectedType === 'Gear Kit') {
          const chip = detailPanel.querySelector(`[data-value="${CSS.escape(item)}"]`);
          if (chip) chip.click();
        } else if (selectedType === 'Buy Items' || selectedType === 'Sell Items') {
          item.split(',').forEach((part) => {
            const chip = detailPanel.querySelector(`[data-value="${CSS.escape(part.trim())}"]`);
            if (chip) chip.click();
          });
          const custom = document.getElementById('customItem');
          if (custom && !detailPanel.querySelector(`[data-value="${CSS.escape(item.trim())}"]`)) {
            custom.value = item;
            updateOrderTotal();
          }
        } else {
          const other = document.getElementById('otherRequest');
          if (other) other.value = item;
          updateOrderTotal();
        }
      });
    }
  }

  detailPanel.addEventListener('input', (e) => {
    if (e.target.matches('#customItem, #otherRequest')) updateOrderTotal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    syncItemInput();

    orderStatus.textContent = '';
    orderStatus.className = 'order-status';

    if (!itemInput.value.trim()) {
      orderStatus.textContent = 'Please select or describe what you need.';
      orderStatus.classList.add('error');
      detailPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const pricing = CatalogAPI.calculateOrderPrice(catalog, selectedType, itemInput.value.trim());
    const formData = new FormData(form);
    const payload = {
      ign: formData.get('ign'),
      orderType: orderTypeInput.value,
      item: itemInput.value.trim(),
      discord: formData.get('discord'),
      notes: formData.get('notes'),
      website: formData.get('website'),
      price: pricing.total,
      priceDisplay: pricing.display,
    };

    orderSubmit.disabled = true;
    orderSubmit.classList.add('loading');

    try {
      const res = await fetch(config.orderApiUrl || '/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) {
          const discordUrl = config.discordInviteUrl || 'https://discord.gg/YEK4K2cY7n';
          const msg = data?.error || "Monty isn't connected yet.";
          orderStatus.innerHTML = `${msg} <a href="${discordUrl}" target="_blank" rel="noopener">Order on Discord</a> for now — use <code>/order</code> in the server.`;
          orderStatus.classList.add('error');
          return;
        }
        throw new Error(data.error || 'Something went wrong. Try again or order on Discord.');
      }

      form.hidden = true;
      document.querySelector('.order-page-intro')?.classList.add('hidden');
      document.getElementById('orderTotalBar')?.classList.add('hidden');
      successScreen.hidden = false;
      successScreen.classList.add('visible');
    } catch (err) {
      orderStatus.textContent = err.message;
      orderStatus.classList.add('error');
    } finally {
      orderSubmit.disabled = false;
      orderSubmit.classList.remove('loading');
    }
  });

  CatalogAPI.fetchCatalog()
    .then((c) => {
      catalog = c;
      preselectFromUrl();
    })
    .catch((err) => {
      orderStatus.textContent = err.message;
      orderStatus.classList.add('error');
    });
})();
