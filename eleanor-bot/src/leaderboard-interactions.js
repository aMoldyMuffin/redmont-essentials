import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { isAuthorized } from './interactions.js';
import {
  addLeaderboardScore,
  buildLeaderboardEmbed,
  buildMemberSelectRow,
  buildScoreActionRow,
  getLeaderboardEntries,
  getLeaderboardEntry,
  postLeaderboardMessage,
  refreshLeaderboardMessage,
  removeLeaderboardEntry,
  syncLeaderboardFromRole,
  upsertLeaderboardEntry,
} from './leaderboard.js';

function buildPointsModal(userId, action) {
  const entry = getLeaderboardEntry(userId);
  const name = entry?.username || 'member';
  const titles = {
    add: `Add points — ${name}`,
    sub: `Remove points — ${name}`,
    set: `Set score — ${name}`,
  };

  const modal = new ModalBuilder()
    .setCustomId(`eleanor_lb:modal:${action}:${userId}`)
    .setTitle((titles[action] || 'Update score').slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel(action === 'set' ? 'New score' : 'Points')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(10)
          .setRequired(true)
          .setPlaceholder(action === 'set' ? 'e.g. 100' : 'e.g. 10')
      )
    );

  return modal;
}

function parseAmount(raw) {
  return Math.floor(Number(String(raw).trim().replace(/,/g, '')));
}

export async function handleLeaderboardInteraction(interaction, client, guildId) {
  if (interaction.isButton() && interaction.customId === 'eleanor_lb:edit') {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const entries = getLeaderboardEntries(25);
    const row = buildMemberSelectRow(entries);
    if (!row) {
      await interaction.reply({
        content: 'No leaderboard entries yet. Run `/leaderboard sync` first.',
        ephemeral: true,
      });
      return true;
    }

    await interaction.reply({
      content: 'Pick a member, then add/remove/set their score.',
      components: [row],
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'eleanor_lb:sync') {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await syncLeaderboardFromRole(client, guildId);
    if (result.error === 'no_role') {
      await interaction.editReply({
        content: 'Set **LEADERBOARD_ROLE_ID** in Eleanor’s environment to enable auto-sync.',
      });
      return true;
    }
    if (result.error === 'role_not_found') {
      await interaction.editReply({ content: 'Configured leaderboard role was not found.' });
      return true;
    }

    await refreshLeaderboardMessage(client);
    await interaction.editReply({
      content: `✅ Synced role — **${result.added}** new member${result.added === 1 ? '' : 's'} added (${result.total} total on board).`,
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'eleanor_lb:member') {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const userId = interaction.values[0];
    const entry = getLeaderboardEntry(userId);
    await interaction.update({
      content: entry
        ? `Editing **${entry.username}** — current score: **${entry.score.toLocaleString()}**`
        : 'Unknown member.',
      components: entry ? [buildScoreActionRow(userId)] : [],
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('eleanor_lb:add:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }
    await interaction.showModal(buildPointsModal(interaction.customId.slice('eleanor_lb:add:'.length), 'add'));
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('eleanor_lb:sub:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }
    await interaction.showModal(buildPointsModal(interaction.customId.slice('eleanor_lb:sub:'.length), 'sub'));
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('eleanor_lb:set:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }
    await interaction.showModal(buildPointsModal(interaction.customId.slice('eleanor_lb:set:'.length), 'set'));
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('eleanor_lb:modal:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const parts = interaction.customId.split(':');
    const action = parts[2];
    const userId = parts[3];
    const amount = parseAmount(interaction.fields.getTextInputValue('amount'));

    if (!Number.isFinite(amount) || amount < 0) {
      await interaction.reply({ content: 'Enter a valid whole number (0 or higher).', ephemeral: true });
      return true;
    }

    if (action === 'add' && amount === 0) {
      await interaction.reply({ content: 'Enter a positive number of points to add.', ephemeral: true });
      return true;
    }

    if (action === 'sub' && amount === 0) {
      await interaction.reply({ content: 'Enter a positive number of points to remove.', ephemeral: true });
      return true;
    }

    let entry = getLeaderboardEntry(userId);
    if (!entry) {
      await interaction.reply({ content: 'That member is not on the leaderboard.', ephemeral: true });
      return true;
    }

    if (action === 'set') {
      entry = upsertLeaderboardEntry(userId, entry.username, amount, 'manual');
    } else if (action === 'add') {
      entry = addLeaderboardScore(userId, entry.username, amount);
    } else {
      entry = addLeaderboardScore(userId, entry.username, -amount);
    }

    await refreshLeaderboardMessage(interaction.client);
    await interaction.reply({
      content: `✅ **${entry.username}** is now at **${entry.score.toLocaleString()}** pts.`,
      ephemeral: true,
    });
    return true;
  }

  return false;
}

export async function handleLeaderboardCommand(interaction, client, guildId, leaderboardChannelId) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'post') {
    await interaction.deferReply({ ephemeral: true });
    const channelId = leaderboardChannelId || interaction.channelId;
    await postLeaderboardMessage(client, channelId);
    await interaction.editReply({
      content: `✅ Leaderboard posted in <#${channelId}>. Use **Edit scores** or **Sync role** on the message.`,
    });
    return;
  }

  if (sub === 'refresh') {
    await interaction.deferReply({ ephemeral: true });
    const ok = await refreshLeaderboardMessage(client);
    await interaction.editReply({
      content: ok ? '✅ Leaderboard refreshed.' : 'No leaderboard message found. Run `/leaderboard post` first.',
    });
    return;
  }

  if (sub === 'sync') {
    await interaction.deferReply({ ephemeral: true });
    const result = await syncLeaderboardFromRole(client, guildId);
    if (result.error === 'no_role') {
      await interaction.editReply({
        content: 'Set **LEADERBOARD_ROLE_ID** in Eleanor’s environment first.',
      });
      return;
    }
    if (result.error === 'role_not_found') {
      await interaction.editReply({ content: 'Configured leaderboard role was not found.' });
      return;
    }
    await refreshLeaderboardMessage(client);
    await interaction.editReply({
      content: `✅ **${result.added}** new member${result.added === 1 ? '' : 's'} added from role (${result.total} total).`,
    });
    return;
  }

  if (sub === 'set') {
    const user = interaction.options.getUser('user', true);
    const score = interaction.options.getInteger('score', true);
    upsertLeaderboardEntry(user.id, user.username, score, 'manual');
    await refreshLeaderboardMessage(client);
    await interaction.reply({
      content: `✅ Set **${user.username}** to **${score.toLocaleString()}** pts.`,
      ephemeral: true,
    });
    return;
  }

  if (sub === 'add') {
    const user = interaction.options.getUser('user', true);
    const points = interaction.options.getInteger('points', true);
    if (!getLeaderboardEntry(user.id)) {
      upsertLeaderboardEntry(user.id, user.username, 0, 'manual');
    }
    const entry = addLeaderboardScore(user.id, user.username, points);
    await refreshLeaderboardMessage(client);
    await interaction.reply({
      content: `✅ **${entry.username}** ${points >= 0 ? '+' : ''}${points} → **${entry.score.toLocaleString()}** pts.`,
      ephemeral: true,
    });
    return;
  }

  if (sub === 'remove') {
    const user = interaction.options.getUser('user', true);
    const removed = removeLeaderboardEntry(user.id);
    await refreshLeaderboardMessage(client);
    await interaction.reply({
      content: removed
        ? `✅ Removed **${user.username}** from the leaderboard.`
        : `**${user.username}** was not on the leaderboard.`,
      ephemeral: true,
    });
    return;
  }

  if (sub === 'view') {
    await interaction.reply({
      embeds: [buildLeaderboardEmbed()],
      ephemeral: true,
    });
  }
}
