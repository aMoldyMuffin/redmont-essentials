import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { createOrder, setOrderMessage, getOrder } from './db.js';
import { calculateOrderWeight } from './weights.js';
import { calculateOrderPrice, formatMoney, getCatalog } from './catalog.js';

export function buildOrderId() {
  return randomUUID().slice(0, 8).toUpperCase();
}

export function buildOrderEmbed(order, { claimed = false } = {}) {
  const weight = order.weight ?? calculateOrderWeight(order.order_type || order.orderType, order.item);
  const catalog = getCatalog();
  const priceVal = order.price ?? 0;
  const priceLabel =
    priceVal > 0
      ? formatMoney(catalog, priceVal)
      : order.price_display || order.priceDisplay || 'Quote on request';

  const embed = new EmbedBuilder()
    .setColor(claimed ? 0x5865f2 : 0xd4af37)
    .setTitle(claimed ? `✅ Order #${order.id} — Claimed` : `🛒 New Order #${order.id}`)
    .addFields(
      { name: 'Minecraft IGN', value: order.ign, inline: true },
      { name: 'Order Type', value: order.order_type || order.orderType, inline: true },
      { name: 'Est. Total', value: priceLabel, inline: true },
      { name: 'Weight', value: `${weight} pts`, inline: true },
      { name: 'Details', value: order.item, inline: false },
    )
    .setFooter({ text: 'Redmont Essentials · Monty' })
    .setTimestamp(order.created_at ? new Date(order.created_at) : new Date());

  if (order.customer_discord || order.customerDiscord) {
    embed.addFields({
      name: 'Customer Discord',
      value: order.customer_discord || order.customerDiscord,
      inline: true,
    });
  }

  if (order.notes) {
    embed.addFields({ name: 'Notes', value: order.notes, inline: false });
  }

  if (claimed && order.claimed_by_name) {
    embed.addFields({
      name: 'Claimed by',
      value: `<@${order.claimed_by_id}> (${order.claimed_by_name})`,
      inline: false,
    });
  }

  return embed;
}

export function buildClaimButton(orderId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`monty_claim:${orderId}`)
      .setLabel('Claim Order')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋')
      .setDisabled(disabled)
  );
}

export async function processWebsiteOrder(client, channelId, payload) {
  const id = buildOrderId();
  const weight = calculateOrderWeight(payload.orderType, payload.item);
  const catalog = getCatalog();
  const pricing =
    payload.price != null
      ? { total: payload.price, display: payload.priceDisplay || formatMoney(catalog, payload.price) }
      : calculateOrderPrice(catalog, payload.orderType, payload.item);
  const createdAt = Date.now();

  const order = {
    id,
    ign: payload.ign,
    orderType: payload.orderType,
    item: payload.item,
    weight,
    price: pricing.total,
    priceDisplay: pricing.display,
    notes: payload.notes || null,
    customerDiscord: payload.discord || null,
    createdAt,
  };

  createOrder({
    id,
    ign: order.ign,
    orderType: order.orderType,
    item: order.item,
    weight,
    price: order.price,
    notes: order.notes,
    customerDiscord: order.customerDiscord,
    createdAt,
  });

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error('Orders channel not found or not text-based');
  }

  const dbOrder = getOrder(id);
  const sourceLabel = payload.source === 'discord' ? 'Discord' : 'Website';
  const message = await channel.send({
    content: `📬 **New ${sourceLabel} order!** Staff — click Claim when you pick this up.`,
    embeds: [buildOrderEmbed({ ...dbOrder, price_display: pricing.display })],
    components: [buildClaimButton(id)],
  });

  setOrderMessage(id, message.id, channel.id);
  return { id, weight, messageId: message.id };
}
