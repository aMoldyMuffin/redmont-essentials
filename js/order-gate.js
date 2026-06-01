/**
 * Cloudflare Turnstile — verify screen + per-submit token
 */
(function (global) {
  'use strict';

  const config = typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : {};
  const VERIFY_KEY = 're_verified';
  const VERIFY_TTL_MS = 4 * 60 * 60 * 1000;

  const gateEl = document.getElementById('orderVerify');
  const appEl = document.getElementById('orderApp');
  const gateStatus = document.getElementById('verifyStatus');
  const gateContainer = document.getElementById('turnstileGate');
  const submitContainer = document.getElementById('turnstileSubmit');

  let scriptLoaded = false;
  let gateWidgetId = null;
  let submitWidgetId = null;
  let submitTokenPromise = null;

  function isEnabled() {
    return Boolean(config.turnstileSiteKey);
  }

  function isSessionVerified() {
    try {
      const raw = sessionStorage.getItem(VERIFY_KEY);
      if (!raw) return false;
      const { at } = JSON.parse(raw);
      return Date.now() - at < VERIFY_TTL_MS;
    } catch {
      return false;
    }
  }

  function setSessionVerified() {
    sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ at: Date.now() }));
  }

  function showGateStatus(msg, isError) {
    if (!gateStatus) return;
    gateStatus.textContent = msg;
    gateStatus.className = 'order-status' + (isError ? ' error' : '');
  }

  function unlockApp() {
    if (gateEl) gateEl.hidden = true;
    if (appEl) appEl.hidden = false;
    setSessionVerified();
  }

  function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
      if (global.turnstile) {
        resolve();
        return;
      }
      if (scriptLoaded) {
        const t = setInterval(() => {
          if (global.turnstile) {
            clearInterval(t);
            resolve();
          }
        }, 50);
        return;
      }
      scriptLoaded = true;
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load verification.'));
      document.head.appendChild(s);
    });
  }

  function renderGateWidget() {
    if (!gateContainer || !global.turnstile) return;
    gateContainer.innerHTML = '';
    gateWidgetId = global.turnstile.render(gateContainer, {
      sitekey: config.turnstileSiteKey,
      theme: 'dark',
      callback(token) {
        if (token) {
          showGateStatus('Verified — loading order form…', false);
          unlockApp();
        }
      },
      'error-callback'() {
        showGateStatus('Verification failed. Refresh and try again.', true);
      },
      'expired-callback'() {
        showGateStatus('Verification expired. Complete the check again.', true);
      },
    });
  }

  function renderSubmitWidget() {
    if (!submitContainer || !global.turnstile || submitWidgetId != null) return;
    submitWidgetId = global.turnstile.render(submitContainer, {
      sitekey: config.turnstileSiteKey,
      theme: 'dark',
      size: 'invisible',
      callback(token) {
        if (submitTokenPromise) {
          submitTokenPromise.resolve(token);
          submitTokenPromise = null;
        }
      },
      'error-callback'() {
        if (submitTokenPromise) {
          submitTokenPromise.reject(new Error('Verification failed. Try submitting again.'));
          submitTokenPromise = null;
        }
      },
    });
  }

  function getSubmitToken() {
    if (!isEnabled()) return Promise.resolve(null);

    return loadTurnstileScript().then(() => {
      renderSubmitWidget();
      return new Promise((resolve, reject) => {
        submitTokenPromise = { resolve, reject };
        global.turnstile.execute(submitWidgetId);
        setTimeout(() => {
          if (submitTokenPromise) {
            submitTokenPromise.reject(new Error('Verification timed out. Try again.'));
            submitTokenPromise = null;
          }
        }, 15000);
      });
    });
  }

  function init() {
    if (!isEnabled()) {
      if (gateEl) gateEl.hidden = true;
      if (appEl) appEl.hidden = false;
      return;
    }

    if (isSessionVerified()) {
      unlockApp();
      loadTurnstileScript().then(renderSubmitWidget).catch(() => {});
      return;
    }

    if (appEl) appEl.hidden = true;
    if (gateEl) gateEl.hidden = false;

    loadTurnstileScript()
      .then(() => {
        renderGateWidget();
        renderSubmitWidget();
      })
      .catch((err) => {
        showGateStatus(err.message || 'Could not load verification.', true);
      });
  }

  global.OrderGate = {
    isEnabled,
    isUnlocked: () => !isEnabled() || isSessionVerified(),
    getSubmitToken,
  };

  init();
})(typeof window !== 'undefined' ? window : globalThis);
