(function () {
  'use strict';

  const panelEl = document.getElementById('adminInventoryPanel');
  const materialsList = document.getElementById('materialsList');
  if (!panelEl || !materialsList) return;

  let inventorySnapshot = null;

  function getToken() {
    return sessionStorage.getItem('re_admin_token') || '';
  }

  function showStatus(msg, isError) {
    const statusEl = document.getElementById('adminStatus');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'admin-status' + (isError ? ' error' : ' success');
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function defaultMaterial() {
    return { id: 'new_material', label: 'New Material', emoji: '📦', quantity: 0 };
  }

  function materialRowHtml(mat, index) {
    return `
      <article class="admin-item admin-item-compact" data-mat-index="${index}">
        <div class="admin-field">
          <label>Name</label>
          <input type="text" data-mat-label value="${esc(mat.label)}" required maxlength="40" />
        </div>
        <div class="admin-field admin-field-icon">
          <label>Emoji</label>
          <input type="text" data-mat-emoji value="${esc(mat.emoji)}" maxlength="8" placeholder="💎" />
        </div>
        <div class="admin-field admin-field-price">
          <label>Quantity</label>
          <input type="number" data-mat-qty min="0" step="1" value="${Number(mat.quantity) || 0}" />
        </div>
        <button type="button" class="admin-remove" data-remove-mat aria-label="Remove">×</button>
      </article>
    `;
  }

  function renderForm(inventory) {
    inventorySnapshot = inventory;
    document.getElementById('invTitle').value = inventory.title || '';
    document.getElementById('invSubtitle').value = inventory.subtitle || '';
    materialsList.innerHTML = (inventory.materials || [])
      .map((m, i) => materialRowHtml(m, i))
      .join('');
  }

  function collectMaterials() {
    return [...materialsList.querySelectorAll('[data-mat-index]')].map((row) => ({
      label: row.querySelector('[data-mat-label]')?.value.trim() || 'Unnamed',
      emoji: row.querySelector('[data-mat-emoji]')?.value.trim() || '📦',
      quantity: Number(row.querySelector('[data-mat-qty]')?.value) || 0,
    }));
  }

  function collectInventoryFromForm() {
    return {
      title: document.getElementById('invTitle').value.trim() || 'Shared Inventory',
      subtitle: document.getElementById('invSubtitle').value.trim() || '',
      materials: collectMaterials(),
    };
  }

  async function loadInventory() {
    const res = await fetch('/api/inventory');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Could not load inventory — is Eleanor running?');
    }
    renderForm(data.inventory || data);
  }

  async function saveInventory() {
    const inventory = collectInventoryFromForm();

    if (!inventory.materials.length) {
      showStatus('Add at least one material.', true);
      return;
    }

    const res = await fetch('/api/admin/inventory', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ inventory }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(data.error || 'Inventory save failed', true);
      return;
    }
    if (data.inventory) renderForm(data.inventory);
    showStatus('Saved! Discord ledger will update within a minute.', false);
  }

  materialsList.addEventListener('click', (e) => {
    if (e.target.matches('[data-remove-mat]')) {
      e.target.closest('[data-mat-index]')?.remove();
    }
  });

  document.getElementById('addMaterialBtn')?.addEventListener('click', () => {
    const index = materialsList.querySelectorAll('[data-mat-index]').length;
    materialsList.insertAdjacentHTML('beforeend', materialRowHtml(defaultMaterial(), index));
  });

  window.InventoryAdmin = {
    load: loadInventory,
    save: saveInventory,
  };
})();
