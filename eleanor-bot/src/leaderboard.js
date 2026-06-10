import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import db from './db.js';

const TITLE_KEY = 'leaderboard_title';
const MESSAGE_KEY = 'leaderboard_message';
const CHANNEL_KEY = 'leaderboard_channel';

const DEFAULT_TITLE = 'Staff Leaderboard';

export function leaderboardRoleId() {
  return process.env.LEADERBOARD_ROLE_ID?.trim() || null;
}

export function getLeaderboardTitle() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(TITLE_KEY);
  return row?.value || DEFAULT_TITLE;
}

export function setLeaderboardTitle(title) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(TITLE_KEY, String(title).trim() || DEFAULT_TITLE);
}

export function getLeaderboardMessageIds() {
  const msg = db.prepare('SELECT value FROM settings WHERE key = ?').get(MESSAGE_KEY);
  const ch = db.prepare('SELECT value FROM settings WHERE key = ?').get(CHANNEL_KEY);
  return { messageId: msg?.value || null, channelId: ch?.value || null };
}

export function setLeaderboardMessageIds(channelId, messageId) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(CHANNEL_KEY, String(channelId));
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(MESSAGE_KEY, String(messageId));
}

export function getLeaderboardEntries(limit = 50) {
  return db
    .prepare(`
      SELECT user_id, username, score, source, updated_at
      FROM leaderboard
      ORDER BY score DESC, username COLLATE NOCASE ASC
      LIMIT ?
    `)
    .all(limit);
}

export function getLeaderboardEntry(userId) {
  return db.prepare('SELECT * FROM leaderboard WHERE user_id = ?').get(userId);
}

export function upsertLeaderboardEntry(userId, username, score, source = 'manual') {
  const now = Date.now();
  const existing = getLeaderboardEntry(userId);
  if (existing) {
    db.prepare(`
      UPDATE leaderboard
      SET username = ?, score = ?, source = ?, updated_at = ?
      WHERE user_id = ?
    `).run(username, Math.max(0, Math.floor(score)), source, now, userId);
  } else {
    db.prepare(`
      INSERT INTO leaderboard (user_id, username, score, source, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, Math.max(0, Math.floor(score)), source, now);
  }
  return getLeaderboardEntry(userId);
}

export function addLeaderboardScore(userId, username, delta) {
  const existing = getLeaderboardEntry(userId);
  const current = existing?.score ?? 0;
  const next = Math.max(0, current + Math.floor(delta));
  return upsertLeaderboardEntry(userId, username, next, existing?.source || 'manual');
}

export function removeLeaderboardEntry(userId) {
  return db.prepare('DELETE FROM leaderboard WHERE user_id = ?').run(userId).changes > 0;
}

export function formatLeaderboardLines(rows) {
  if (!rows.length) {
    return '_No entries yet — run `/leaderboard sync` to add everyone with the configured role._';
  }

  return rows
    .map((row, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      return `${medal} <@${row.user_id}> — **${row.score.toLocaleString()}** pts`;
    })
    .join('\n');
}

export function buildLeaderboardEmbed(rows = getLeaderboardEntries()) {
  const roleId = leaderboardRoleId();
  const subtitle = roleId
    ? 'Auto-includes members with the configured role. Staff can edit scores below.'
    : 'Set `LEADERBOARD_ROLE_ID` to auto-add members.';

  return new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle(`🏆 ${getLeaderboardTitle()}`)
    .setDescription([subtitle, '', formatLeaderboardLines(rows)].join('\n'))
    .setFooter({ text: 'Eleanor · Leaderboard' })
    .setTimestamp();
}

export function buildLeaderboardControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('eleanor_lb:edit')
      .setLabel('Edit scores')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('eleanor_lb:sync')
      .setLabel('Sync role')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );
}

export function buildMemberSelectRow(entries) {
  const options = entries.slice(0, 25).map((row) => ({
    label: row.username.slice(0, 100),
    value: row.user_id,
    description: `${row.score.toLocaleString()} pts`.slice(0, 100),
  }));

  if (!options.length) {
    return null;
  }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('eleanor_lb:member')
      .setPlaceholder('Choose a member to edit')
      .addOptions(options)
  );
}

export function buildScoreActionRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`eleanor_lb:add:${userId}`)
      .setLabel('Add points')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId(`eleanor_lb:sub:${userId}`)
      .setLabel('Remove points')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖'),
    new ButtonBuilder()
      .setCustomId(`eleanor_lb:set:${userId}`)
      .setLabel('Set score')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📌')
  );
}

export async function refreshLeaderboardMessage(client) {
  const { channelId, messageId } = getLeaderboardMessageIds();
  if (!channelId || !messageId) return false;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return false;
    const message = await channel.messages.fetch(messageId);
    await message.edit({
      embeds: [buildLeaderboardEmbed()],
      components: [buildLeaderboardControlsRow()],
    });
    return true;
  } catch (err) {
    console.warn('Could not refresh leaderboard message:', err.message);
    return false;
  }
}

export async function postLeaderboardMessage(client, channelId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error('Channel not found or not text-based');
  }

  const message = await channel.send({
    embeds: [buildLeaderboardEmbed()],
    components: [buildLeaderboardControlsRow()],
  });

  setLeaderboardMessageIds(channel.id, message.id);
  return message;
}

export async function syncLeaderboardFromRole(client, guildId) {
  const roleId = leaderboardRoleId();
  if (!roleId) {
    return { error: 'no_role', added: 0, total: getLeaderboardEntries(500).length };
  }

  const guild = await client.guilds.fetch(guildId);
  await guild.members.fetch();

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    return { error: 'role_not_found', added: 0, total: getLeaderboardEntries(500).length };
  }

  let added = 0;
  for (const [, member] of role.members) {
    if (!getLeaderboardEntry(member.id)) {
      upsertLeaderboardEntry(member.id, member.user.username, 0, 'role');
      added++;
    } else {
      db.prepare('UPDATE leaderboard SET username = ? WHERE user_id = ?').run(
        member.user.username,
        member.id
      );
    }
  }

  return { ok: true, added, total: getLeaderboardEntries(500).length };
}

export async function ensureMemberOnLeaderboard(client, guildId, member) {
  const roleId = leaderboardRoleId();
  if (!roleId || !member.roles.cache.has(roleId)) return false;

  if (!getLeaderboardEntry(member.id)) {
    upsertLeaderboardEntry(member.id, member.user.username, 0, 'role');
    await refreshLeaderboardMessage(client);
    return true;
  }

  db.prepare('UPDATE leaderboard SET username = ? WHERE user_id = ?').run(
    member.user.username,
    member.id
  );
  return false;
}
