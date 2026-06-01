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
  const retryBtn = document.getElementById('verifyRetryBtn');

  let gateWidgetId = null;
  let submitWidgetId = null;
  let submitTokenPromise = null;

  function isEnabled() {
    return Boolean(config.turnstileSiteKey?.trim());
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

  function whenTurnstileReady() {
    return new Promise((resolve, reject) => {
      if (global.turnstile?.ready) {
        global.turnstile.ready(resolve);
        return;
      }

      const existing = document.querySelector('script[data-turnstile-loader]');
      if (existing) {
        existing.addEventListener('load', () => {
          if (global.turnstile?.ready) global.turnstile.ready(resolve);
          else reject(new Error('Verification failed to load.'));
        });
        return;
      }

      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.dataset.turnstileLoader = '1';
      s.onload = () => {
        if (global.turnstile?.ready) {
          global.turnstile.ready(resolve);
        } else {
          reject(new Error('Verification failed to load.'));
        }
      };
      s.onerror = () => reject(new Error('Could not load verification (blocked or offline).'));
      document.head.appendChild(s);
    });
  }

  function onVerifySuccess(token) {
    if (!token) return;
    showGateStatus('Verified — loading order form…', false);
    unlockApp();
  }

  function renderGateWidget() {
    if (!gateContainer || !global.turnstile) return false;

    if (gateWidgetId != null) {
      try {
        global.turnstile.remove(gateWidgetId);
      } catch {
        /* ignore */
      }
      gateWidgetId = null;
    }

    gateContainer.innerHTML = '';

    try {
      gateWidgetId = global.turnstile.render(gateContainer, {
        sitekey: config.turnstileSiteKey,
        theme: 'dark',
        size: 'normal',
        callback: onVerifySuccess,
        'error-callback'() {
          showGateStatus('Verification error. Click “Reload check” below.', true);
          if (retryBtn) retryBtn.hidden = false;
        },
        'expired-callback'() {
          showGateStatus('Check expired — complete it again.', true);
        },
        'timeout-callback'() {
          showGateStatus('Timed out — click “Reload check”.', true);
          if (retryBtn) retryBtn.hidden = false;
        },
      });
    } catch (err) {
      console.error('Turnstile render error:', err);
      return false;
    }

    return gateWidgetId != null;
  }

  function renderSubmitWidget() {
    if (!submitContainer || !global.turnstile) return;
    if (submitWidgetId != null) return;

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

  function widgetAppeared() {
    return Boolean(gateContainer?.querySelector('iframe, input[name="cf-turnstile-response"]'));
  }

  async function setupGate() {
    showGateStatus('Loading security check…', false);
    if (retryBtn) retryBtn.hidden = true;

    try {
      await whenTurnstileReady();
    } catch (err) {
      showGateStatus(err.message, true);
      if (retryBtn) retryBtn.hidden = false;
      return;
    }

    const ok = renderGateWidget();
    if (!ok) {
      showGateStatus('Could not show verification. Click “Reload check”.', true);
      if (retryBtn) retryBtn.hidden = false;
      return;
    }

    renderSubmitWidget();

    await new Promise((r) => setTimeout(r, 2500));

    if (!widgetAppeared()) {
      showGateStatus(
        'Verification did not load. Add this site’s domain in Cloudflare Turnstile settings, then reload.',
        true
      );
      if (retryBtn) retryBtn.hidden = false;
      return;
    }

    showGateStatus('Complete the check above (checkbox or challenge), then you can order.', false);
    if (retryBtn) retryBtn.hidden = false;
  }

  function getSubmitToken() {
    if (!isEnabled()) return Promise.resolve(null);

    return whenTurnstileReady().then(() => {
      renderSubmitWidget();
      if (submitWidgetId == null) {
        throw new Error('Verification not ready.');
      }
      return new Promise((resolve, reject) => {
        submitTokenPromise = { resolve, reject };
        global.turnstile.execute(submitWidgetId);
        setTimeout(() => {
          if (submitTokenPromise) {
            submitTokenPromise.reject(new Error('Verification timed out. Try again.'));
            submitTokenPromise = null;
          }
        }, 20000);
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
      whenTurnstileReady().then(renderSubmitWidget).catch(() => {});
      return;
    }

    if (appEl) appEl.hidden = true;
    if (gateEl) gateEl.hidden = false;

    retryBtn?.addEventListener('click', () => {
      setupGate();
    });

    setupGate();
  }

  global.OrderGate = {
    isEnabled,
    isUnlocked: () => !isEnabled() || isSessionVerified(),
    getSubmitToken,
  };

  init();
})(typeof window !== 'undefined' ? window : globalThis);
