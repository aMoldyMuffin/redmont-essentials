(function () {
  'use strict';

  const config = typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : {};

  // ── Header scroll state ──
  const header = document.getElementById('header');
  let lastScroll = 0;

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 40);
    lastScroll = y;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Mobile nav ──
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ── Scroll reveal ──
  const revealEls = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => revealObserver.observe(el));

  // ── Active nav link on scroll ──
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navAnchors.forEach((a) => {
            const match = a.getAttribute('href') === `#${id}`;
            a.style.color = match ? 'var(--gold-400)' : '';
          });
        }
      });
    },
    { threshold: 0.35, rootMargin: '-20% 0px -55% 0px' }
  );

  sections.forEach((s) => sectionObserver.observe(s));

  // ── Discord invite link ──
  const discordBtn = document.getElementById('discordInvite');
  if (discordBtn && config.discordInviteUrl) {
    discordBtn.href = config.discordInviteUrl;
  }

  // ── Discord live card (works without Server Widget enabled) ──
  const discordPanel = document.getElementById('discordPanel');
  const inviteCode = config.discordInviteCode || config.discordInviteUrl?.split('/').pop();

  if (discordPanel && inviteCode) {
    fetch(`https://discord.com/api/v10/invites/${inviteCode}?with_counts=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.guild) {
          discordPanel.innerHTML = buildDiscordFallback(config.discordInviteUrl);
          return;
        }

        const guild = data.guild;
        const iconUrl = guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
          : '';
        const members = data.approximate_member_count ?? '—';
        const online = data.approximate_presence_count ?? '—';
        const inviteUrl = config.discordInviteUrl || `https://discord.gg/${inviteCode}`;

        discordPanel.innerHTML = `
          <div class="discord-panel-inner">
            ${iconUrl ? `<img src="${iconUrl}" alt="${guild.name}" class="discord-panel-icon" />` : ''}
            <div class="discord-panel-info">
              <span class="discord-panel-label">Discord Server</span>
              <h3 class="discord-panel-name">${guild.name}</h3>
              <div class="discord-panel-stats">
                <span><strong>${online}</strong> online</span>
                <span class="discord-stat-dot">·</span>
                <span><strong>${members}</strong> members</span>
              </div>
            </div>
          </div>
          <a href="${inviteUrl}" class="btn btn-discord" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            Join Server
          </a>
        `;
      })
      .catch(() => {
        discordPanel.innerHTML = buildDiscordFallback(config.discordInviteUrl);
      });
  }

  function buildDiscordFallback(inviteUrl) {
    return `
      <div class="discord-panel-inner">
        <div class="discord-panel-info">
          <span class="discord-panel-label">Discord Server</span>
          <h3 class="discord-panel-name">Redmont Essentials</h3>
          <p class="discord-panel-desc">Orders, support &amp; community</p>
        </div>
      </div>
      <a href="${inviteUrl}" class="btn btn-discord" target="_blank" rel="noopener noreferrer">Join Server</a>
    `;
  }

  // ── Order form ──
  const orderForm = document.getElementById('orderForm');
  const orderStatus = document.getElementById('orderStatus');
  const orderSubmit = document.getElementById('orderSubmit');
  const orderKitSelect = document.getElementById('orderKit');

  document.querySelectorAll('[data-kit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kit = btn.getAttribute('data-kit');
      if (orderKitSelect && kit) orderKitSelect.value = kit;
    });
  });

  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      orderStatus.textContent = '';
      orderStatus.className = 'order-status';

      const formData = new FormData(orderForm);
      const payload = {
        ign: formData.get('ign'),
        orderType: formData.get('orderType'),
        kit: formData.get('kit'),
        discord: formData.get('discord'),
        notes: formData.get('notes'),
        website: formData.get('website'),
      };

      orderSubmit.disabled = true;
      orderSubmit.textContent = 'Sending…';

      try {
        const apiUrl = config.orderApiUrl || '/api/order';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Something went wrong. Try again or order on Discord.');
        }

        orderStatus.textContent = data.message || 'Order sent! We will be in touch soon.';
        orderStatus.classList.add('success');
        orderForm.reset();
      } catch (err) {
        orderStatus.textContent = err.message || 'Could not send order. Join our Discord to order instead.';
        orderStatus.classList.add('error');
      } finally {
        orderSubmit.disabled = false;
        orderSubmit.textContent = 'Submit Order';
      }
    });
  }

  // ── Smooth anchor offset fix on load ──
  if (window.location.hash) {
    requestAnimationFrame(() => {
      const target = document.querySelector(window.location.hash);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }
})();
