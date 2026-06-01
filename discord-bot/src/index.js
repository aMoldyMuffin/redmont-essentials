import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  EmbedBuilder,
  ActivityType,
} from 'discord.js';
import { STAFF_COMMAND_NAMES, registerGuildCommands } from './commands.js';
import { notifyCustomerOrderClaimed } from './notifications.js';
import { startApiServer } from './api.js';
import { getCatalog, buildKitsEmbed } from './catalog.js';
import {
  claimOrder,
  getLeaderboard,
  getStaffStats,
  getOpenOrderCount,
  getOrder,
  getOrderByMessageId,
} from './db.js';
import { buildOrderEmbed, buildClaimButton } from './orders.js';
import {
  buildOrderStartEmbed,
  buildOrderStartRow,
  handleDiscordOrderInteraction,
} from './discord-order.js';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;
const staffRoleId = process.env.STAFF_ROLE_ID;
const ordersChannelId = process.env.ORDERS_CHANNEL_ID;
const websiteUrl = process.env.WEBSITE_URL || 'https://example.com';
const apiPort = Number(process.env.PORT || process.env.API_PORT || 3847);
const apiSecret = process.env.MONTY_API_SECRET;
const adminSecret = process.env.ADMIN_SECRET || apiSecret;

if (!token || !guildId || !clientId) {
  console.error('Missing DISCORD_TOKEN, DISCORD_GUILD_ID, or DISCORD_CLIENT_ID');
  process.exit(1);
}

if (!ordersChannelId) {
  console.warn('Warning: ORDERS_CHANNEL_ID not set — website orders will fail until configured.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has('ManageMessages')) return true;
  if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
  return false;
}

function requireStaff(interaction) {
  if (isStaff(interaction.member)) return true;
  interaction.reply({
    content: 'That command is for staff only. Customers can use **/order** to place an order.',
    ephemeral: true,
  });
  return false;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await registerGuildCommands(rest, { clientId, guildId });
}

function formatLeaderboard(rows) {
  if (!rows.length) return 'No claims yet — be the first to claim an order!';

  return rows
    .map((row, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      return `${medal} **${row.username}** — ${row.total_weight} pts (${row.orders_claimed} orders)`;
    })
    .join('\n');
}

client.once('ready', () => {
  console.log(`Monty is online as ${client.user.tag}`);
  client.user.setActivity('Redmont Essentials orders', { type: ActivityType.Watching });

  if (apiSecret && ordersChannelId) {
    startApiServer(client, {
      port: apiPort,
      secret: apiSecret,
      adminSecret,
      ordersChannelId,
    });
  } else {
    console.warn('Monty API not started — set MONTY_API_SECRET and ORDERS_CHANNEL_ID');
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (
      (interaction.isButton() && interaction.customId.startsWith('monty_order:')) ||
      (interaction.isStringSelectMenu() && interaction.customId.startsWith('monty_order:')) ||
      (interaction.isModalSubmit() && interaction.customId === 'monty_order:modal')
    ) {
      const handled = await handleDiscordOrderInteraction(interaction, client, ordersChannelId);
      if (handled) return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('monty_claim:')) {
      let orderId = interaction.customId.slice('monty_claim:'.length);

      if (!isStaff(interaction.member)) {
        await interaction.reply({
          content: 'Only staff can claim orders.',
          ephemeral: true,
        });
        return;
      }

      let order = getOrder(orderId);
      if (!order && interaction.message?.id) {
        order = getOrderByMessageId(interaction.message.id);
        if (order) orderId = order.id;
      }

      if (!order) {
        console.warn(
          `Claim failed: order ${orderId} not in DB (message ${interaction.message?.id}). ` +
            'If Monty restarted or Railway has no volume, orders are lost — place a new order.'
        );
        await interaction.reply({
          content:
            'This order is not in Monty’s database (often after a bot restart without persistent storage). ' +
            'Place a new order, or add a Railway volume for the database — see discord-bot/README.md.',
          ephemeral: true,
        });
        return;
      }

      const result = claimOrder(orderId, interaction.user.id, interaction.user.username);
      if (result?.error === 'already_claimed') {
        await interaction.reply({
          content: `This order was already claimed by **${result.order.claimed_by_name}**.`,
          ephemeral: true,
        });
        return;
      }
      if (!result?.ok) {
        await interaction.reply({
          content: 'Could not claim this order. Try again.',
          ephemeral: true,
        });
        return;
      }

      const claimed = result.order;
      await interaction.update({
        content: `✅ Order **#${orderId}** claimed by ${interaction.user}`,
        embeds: [buildOrderEmbed(claimed, { claimed: true })],
        components: [buildClaimButton(orderId, true)],
      });

      notifyCustomerOrderClaimed(client, guildId, claimed, interaction.user).catch((err) =>
        console.warn('Claim notification failed:', err.message)
      );
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (STAFF_COMMAND_NAMES.has(interaction.commandName) && !requireStaff(interaction)) {
      return;
    }

    if (interaction.commandName === 'shop') {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('Redmont Essentials')
            .setDescription('Everything you need to get started on Democracy Craft.')
            .addFields(
              { name: 'Website', value: websiteUrl, inline: false },
              { name: 'Order online', value: `${websiteUrl}/order.html`, inline: false },
            )
            .setFooter({ text: 'Monty · Redmont Essentials' }),
        ],
      });
      return;
    }

    if (interaction.commandName === 'kits') {
      const catalog = getCatalog();
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('Starter Gear Kits')
            .setDescription(buildKitsEmbed(catalog))
            .setFooter({ text: 'Use /order to purchase · Monty' }),
        ],
      });
      return;
    }

    if (interaction.commandName === 'order') {
      const catalog = getCatalog();
      await interaction.reply({
        embeds: [buildOrderStartEmbed(catalog)],
        components: [buildOrderStartRow()],
      });
      return;
    }

    if (interaction.commandName === 'leaderboard') {
      const rows = getLeaderboard(10);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('🏆 Staff Leaderboard')
            .setDescription(formatLeaderboard(rows))
            .setFooter({ text: 'Ranked by weighted order points · Monty' }),
        ],
      });
      return;
    }

    if (interaction.commandName === 'mystats') {
      const stats = getStaffStats(interaction.user.id);
      if (!stats) {
        await interaction.reply({
          content: 'You have not claimed any orders yet. Claim one from the orders channel!',
          ephemeral: true,
        });
        return;
      }

      const rank = getLeaderboard(100).findIndex((r) => r.user_id === interaction.user.id) + 1;
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📊 Your Stats')
            .addFields(
              { name: 'Orders claimed', value: `${stats.orders_claimed}`, inline: true },
              { name: 'Total points', value: `${stats.total_weight}`, inline: true },
              { name: 'Rank', value: rank ? `#${rank}` : 'Unranked', inline: true },
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === 'orders') {
      const open = getOpenOrderCount();
      await interaction.reply({
        content: open
          ? `📬 **${open}** order${open === 1 ? '' : 's'} waiting to be claimed in <#${ordersChannelId}>`
          : '✅ No open orders — all caught up!',
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const hint = err?.message?.includes('showModal')
      ? 'Could not open the form — run `/order` again and pick your kit.'
      : 'Something went wrong.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: hint, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: hint, ephemeral: true }).catch(() => {});
    }
  }
});

registerCommands()
  .catch((err) => console.error('Command registration failed:', err))
  .finally(() => client.login(token));
