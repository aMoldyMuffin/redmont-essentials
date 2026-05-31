(function () {
  'use strict';

  const config = typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : {};

  const discordBtn = document.getElementById('discordInvite');
  if (discordBtn && config.discordInviteUrl) {
    discordBtn.href = config.discordInviteUrl;
  }

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
          <a href="${inviteUrl}" class="btn btn-discord" target="_blank" rel="noopener noreferrer">Join Server</a>
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

  if (window.location.hash) {
    requestAnimationFrame(() => {
      const target = document.querySelector(window.location.hash);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }
})();
