import { EmbedBuilder } from 'discord.js';
import {
  buildTranscriptAttachment,
  buildTranscriptHtml,
  fetchChannelMessages,
} from './transcript.js';

export function botLogChannelId() {
  return process.env.BOT_LOG_CHANNEL_ID?.trim() || process.env.TICKET_LOG_CHANNEL_ID?.trim() || null;
}

export function transcriptChannelId() {
  return process.env.TRANSCRIPT_CHANNEL_ID?.trim() || botLogChannelId();
}

export function isTicketLoggingEnabled() {
  return Boolean(botLogChannelId() || transcriptChannelId());
}

async function getLogChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

function orderSummaryFields(order, extra = []) {
  const customer = order.customer_discord || order.customerDiscord || '—';
  return [
    { name: 'Order', value: `#${order.id}`, inline: true },
    { name: 'IGN', value: order.ign || '—', inline: true },
    { name: 'Type', value: order.order_type || order.orderType || '—', inline: true },
    { name: 'Items', value: (order.item || '—').slice(0, 1024), inline: false },
    { name: 'Customer', value: customer.slice(0, 1024), inline: true },
    { name: 'Staff', value: order.claimed_by_name || '—', inline: true },
    ...extra,
  ];
}

export async function logTicketOpened(client, order, staffUser, ticketChannel) {
  const channel = await getLogChannel(client, botLogChannelId());
  if (!channel) return;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🎫 Ticket opened')
        .setDescription(`Private channel ${ticketChannel} created for order **#${order.id}**.`)
        .addFields(
          ...orderSummaryFields(order, [
            { name: 'Claimed by', value: `<@${staffUser.id}>`, inline: true },
            { name: 'Ticket', value: `${ticketChannel}`, inline: true },
          ])
        )
        .setFooter({ text: 'Monty · Bot log' })
        .setTimestamp(),
    ],
  });
}

export async function logTicketClosed(client, order, ticketChannel, closedBy) {
  const logChannel = await getLogChannel(client, botLogChannelId());
  const transcriptTarget = await getLogChannel(client, transcriptChannelId());

  let messages = [];
  try {
    messages = await fetchChannelMessages(ticketChannel);
  } catch (err) {
    console.warn('Could not fetch ticket messages for transcript:', err.message);
  }

  const html = buildTranscriptHtml({
    order,
    channel: ticketChannel,
    messages,
    closedBy,
  });
  const attachment = buildTranscriptAttachment(html, order.id);

  if (transcriptTarget) {
    await transcriptTarget.send({
      content: `📄 Transcript for order **#${order.id}** · closed by **${closedBy.username}**`,
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Order #${order.id}`)
          .addFields(
            { name: 'Customer', value: order.customer_discord || order.customerDiscord || '—', inline: true },
            { name: 'Staff', value: order.claimed_by_name || '—', inline: true },
            { name: 'Messages', value: `${messages.length}`, inline: true },
            { name: 'Closed by', value: `<@${closedBy.id}>`, inline: true },
          )
          .setFooter({ text: 'Monty · Transcript' })
          .setTimestamp(),
      ],
      files: [attachment],
    });
  }

  if (logChannel && logChannel.id !== transcriptTarget?.id) {
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('🔒 Ticket closed')
          .setDescription(
            transcriptTarget
              ? `Order **#${order.id}** ticket closed. Transcript posted in ${transcriptTarget}.`
              : `Order **#${order.id}** ticket closed.`
          )
          .addFields(
            ...orderSummaryFields(order, [
              { name: 'Closed by', value: `<@${closedBy.id}>`, inline: true },
              { name: 'Messages', value: `${messages.length}`, inline: true },
            ])
          )
          .setFooter({ text: 'Monty · Bot log' })
          .setTimestamp(),
      ],
    });
  } else if (logChannel && logChannel.id === transcriptTarget?.id) {
    // Single channel: transcript post above is enough; add a short close line if we only had one channel
    // (transcript message already includes close info)
  }
}
