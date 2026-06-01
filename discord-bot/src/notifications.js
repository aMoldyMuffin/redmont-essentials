import { EmbedBuilder } from 'discord.js';

export function parseDiscordUserId(text) {
  if (!text) return null;
  const mention = String(text).match(/<@!?(\d{17,20})>/);
  if (mention) return mention[1];
  const trimmed = String(text).trim();
  if (/^\d{17,20}$/.test(trimmed)) return trimmed;
  return null;
}

export async function resolveDiscordUserId(client, guildId, text) {
  const direct = parseDiscordUserId(text);
  if (direct) return direct;

  const raw = String(text || '').trim();
  const username = raw.replace(/^@/, '').split('#')[0].trim();
  if (!username || username.length < 2) return null;

  try {
    const guild = await client.guilds.fetch(guildId);
    const members = await guild.members.fetch({ query: username, limit: 10 });
    const lower = username.toLowerCase();
    const match = members.find(
      (m) =>
        m.user.username.toLowerCase() === lower ||
        m.displayName.toLowerCase() === lower ||
        m.user.globalName?.toLowerCase() === lower
    );
    return match?.id ?? null;
  } catch (err) {
    console.warn('Could not resolve Discord user:', err.message);
    return null;
  }
}

export async function notifyCustomerOrderClaimed(client, guildId, order, claimedBy) {
  const customerText = order.customer_discord || order.customerDiscord;
  if (!customerText) return;

  const userId = await resolveDiscordUserId(client, guildId, customerText);
  if (!userId) {
    console.warn(`Claim notify: could not resolve Discord user from "${customerText}"`);
    return;
  }

  if (userId === claimedBy.id) return;

  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`✅ Order #${order.id} claimed`)
      .setDescription(
        `Your **${order.order_type || order.orderType}** order has been picked up by staff.`
      )
      .addFields(
        { name: 'Minecraft IGN', value: order.ign, inline: true },
        { name: 'Claimed by', value: `${claimedBy.username}`, inline: true },
        { name: 'Items', value: order.item, inline: false },
      )
      .setFooter({ text: 'Redmont Essentials · Monty' })
      .setTimestamp();

    await user.send({
      content: `Hi <@${userId}> — your Redmont Essentials order was claimed!`,
      embeds: [embed],
    });
  } catch (err) {
    console.warn(`Claim notify: could not DM user ${userId}:`, err.message);
  }
}
