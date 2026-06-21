import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { getOrder, setOrderTicketChannel, clearOrderTicketChannel } from './db.js';
import { resolveDiscordUserId } from './notifications.js';
import { isTicketLoggingEnabled, logTicketClosed, logTicketOpened } from './ticket-log.js';

function ticketCategoryId() {
  return process.env.TICKET_CATEGORY_ID?.trim() || null;
}

export function isTicketsEnabled() {
  return Boolean(ticketCategoryId());
}

function sanitizeChannelName(orderId) {
  return `order-${String(orderId).toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 100);
}

export function buildTicketCloseRow(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`monty_ticket_close:${orderId}`)
      .setLabel('Close ticket')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔒')
  );
}

/**
 * Private channel for customer + claiming staff (Tickety-style).
 */
export async function createOrderTicket(client, guildId, order, staffUser) {
  const parentId = ticketCategoryId();
  if (!parentId) return null;

  if (order.ticket_channel_id) {
    const existing = await client.channels.fetch(order.ticket_channel_id).catch(() => null);
    if (existing) return { channel: existing, customerId: null, existing: true };
  }

  const guild = await client.guilds.fetch(guildId);
  const customerText = order.customer_discord || order.customerDiscord;
  const customerId = customerText
    ? await resolveDiscordUserId(client, guildId, customerText)
    : null;

  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: staffUser.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  if (customerId && customerId !== staffUser.id) {
    overwrites.push({
      id: customerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: sanitizeChannelName(order.id),
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `Order #${order.id} · ${order.ign}`,
    permissionOverwrites: overwrites,
  });

  setOrderTicketChannel(order.id, channel.id);

  const lines = [
    'This private channel is for your order. Chat here to coordinate delivery.',
    '',
    `**Order #${order.id}**`,
    `**Minecraft IGN:** ${order.ign}`,
    `**Type:** ${order.order_type || order.orderType}`,
    `**Items:** ${order.item}`,
  ];
  if (order.notes) lines.push(`**Notes:** ${order.notes}`);

  const mentions = [];
  if (customerId && customerId !== staffUser.id) mentions.push(`<@${customerId}>`);
  mentions.push(`<@${staffUser.id}>`);

  await channel.send({
    content: mentions.join(' '),
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎫 Order #${order.id}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Press Close ticket when you are done' }),
    ],
    components: [buildTicketCloseRow(order.id)],
  });

  if (!customerId && customerText) {
    await channel.send({
      content:
        `⚠️ Could not add **${customerText}** to this channel automatically. ` +
        'They must be in the server with a matching username, or add them manually.',
    });
  }

  if (isTicketLoggingEnabled()) {
    logTicketOpened(client, order, staffUser, channel).catch((err) =>
      console.warn('Ticket open log failed:', err.message)
    );
  }

  return { channel, customerId, existing: false };
}

export async function canCloseTicket(client, guildId, order, userId, member) {
  if (!order) return false;
  if (order.claimed_by_id === userId) return true;
  if (member?.permissions?.has('ManageMessages')) return true;
  const customerText = order.customer_discord || order.customerDiscord;
  if (!customerText) return false;
  const customerId = await resolveDiscordUserId(client, guildId, customerText);
  return customerId === userId;
}

export async function closeOrderTicketChannel(interaction, orderId) {
  const order = getOrder(orderId);
  if (!order?.ticket_channel_id) {
    await interaction.reply({ content: 'Ticket not found for this order.', ephemeral: true });
    return;
  }

  if (interaction.channelId !== order.ticket_channel_id) {
    await interaction.reply({ content: 'Use the Close button inside the ticket channel.', ephemeral: true });
    return;
  }

  const allowed = await canCloseTicket(
    interaction.client,
    interaction.guildId,
    order,
    interaction.user.id,
    interaction.member
  );
  if (!allowed) {
    await interaction.reply({
      content: 'Only the customer, the staff who claimed this order, or moderators can close the ticket.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ content: '🔒 Closing ticket…' });

  const ticketChannel = interaction.channel;

  if (isTicketLoggingEnabled()) {
    try {
      await logTicketClosed(interaction.client, order, ticketChannel, interaction.user);
    } catch (err) {
      console.warn('Ticket close log / transcript failed:', err.message);
    }
  }

  clearOrderTicketChannel(orderId);
  await ticketChannel.delete().catch((err) => {
    console.warn('Could not delete ticket channel:', err.message);
  });
}
