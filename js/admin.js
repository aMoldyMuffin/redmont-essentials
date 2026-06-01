(function () {
  'use strict';

  const loginEl = document.getElementById('adminLogin');
  const panelEl = document.getElementById('adminPanel');
  const statusEl = document.getElementById('adminStatus');
  const editorEl = document.getElementById('catalogEditor');

  if (!loginEl) return;

  const STORAGE_KEY = 're_admin_token';

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

  async function loadCatalog() {
    const catalog = await CatalogAPI.fetchCatalog();
    CatalogAPI.clearCache();
    editorEl.value = JSON.stringify(catalog, null, 2);
  }

  async function saveCatalog() {
    let catalog;
    try {
      catalog = JSON.parse(editorEl.value);
    } catch {
      showStatus('Invalid JSON — fix syntax before saving.', true);
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
    showStatus('Catalog saved! Homepage and order page will update within a minute.', false);
  }

  document.getElementById('adminLoginBtn')?.addEventListener('click', async () => {
    const token = document.getElementById('adminToken').value.trim();
    if (!token) {
      showStatus('Enter your admin secret.', true);
      return;
    }
    setToken(token);
    try {
      await loadCatalog();
      loginEl.hidden = true;
      panelEl.hidden = false;
      showStatus('Logged in. Edit JSON below and click Save.', false);
    } catch (err) {
      setToken('');
      showStatus(err.message || 'Could not load catalog — check your secret.', true);
    }
  });

  document.getElementById('adminSaveBtn')?.addEventListener('click', saveCatalog);
  document.getElementById('adminReloadBtn')?.addEventListener('click', async () => {
    CatalogAPI.clearCache();
    try {
      await loadCatalog();
      showStatus('Reloaded from server.', false);
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
    setToken('');
    loginEl.hidden = false;
    panelEl.hidden = true;
    showStatus('', false);
  });

  if (getToken()) {
    loadCatalog()
      .then(() => {
        loginEl.hidden = true;
        panelEl.hidden = false;
      })
      .catch(() => setToken(''));
  }
})();
