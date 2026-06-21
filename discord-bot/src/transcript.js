import { AttachmentBuilder } from 'discord.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(ms) {
  return new Date(ms).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function messageBody(message) {
  const parts = [];

  if (message.content) {
    parts.push(`<div class="content">${escapeHtml(message.content)}</div>`);
  }

  for (const embed of message.embeds) {
    const lines = [];
    if (embed.title) lines.push(`<strong>${escapeHtml(embed.title)}</strong>`);
    if (embed.description) lines.push(escapeHtml(embed.description));
    for (const field of embed.fields ?? []) {
      lines.push(`<strong>${escapeHtml(field.name)}:</strong> ${escapeHtml(field.value)}`);
    }
    if (lines.length) {
      parts.push(`<div class="embed">${lines.join('<br>')}</div>`);
    }
  }

  for (const attachment of message.attachments.values()) {
    const name = escapeHtml(attachment.name || 'attachment');
    const url = escapeHtml(attachment.url);
    parts.push(`<div class="attachment"><a href="${url}">${name}</a></div>`);
  }

  if (!parts.length) {
    parts.push('<div class="content muted">(no text content)</div>');
  }

  return parts.join('');
}

export async function fetchChannelMessages(channel) {
  const messages = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });
    if (!batch.size) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

export function buildTranscriptHtml({ order, channel, messages, closedBy }) {
  const openedAt = channel.createdTimestamp;
  const closedAt = Date.now();
  const customer = order.customer_discord || order.customerDiscord || 'Unknown';
  const staff = order.claimed_by_name || 'Unknown';

  const messageRows = messages
    .map((msg) => {
      const author = msg.author?.bot ? `${msg.author.username} (bot)` : msg.author?.username || 'Unknown';
      return `
        <div class="message">
          <div class="meta">
            <span class="author">${escapeHtml(author)}</span>
            <span class="time">${formatTimestamp(msg.createdTimestamp)}</span>
          </div>
          ${messageBody(msg)}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Order #${escapeHtml(order.id)} transcript</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #1e1f22; color: #dbdee1; margin: 0; padding: 24px; }
    .header { background: #2b2d31; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 12px; font-size: 1.25rem; }
    .header dl { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; margin: 0; }
    .header dt { color: #949ba4; }
    .message { background: #2b2d31; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
    .meta { margin-bottom: 8px; }
    .author { font-weight: 600; color: #f2f3f5; }
    .time { color: #949ba4; font-size: 0.85rem; margin-left: 8px; }
    .content { white-space: pre-wrap; word-break: break-word; }
    .embed { margin-top: 8px; padding: 10px; border-left: 3px solid #5865f2; background: #1e1f22; border-radius: 4px; }
    .attachment { margin-top: 8px; }
    .attachment a { color: #00a8fc; }
    .muted { color: #949ba4; font-style: italic; }
    .footer { color: #949ba4; font-size: 0.85rem; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Order ticket #${escapeHtml(order.id)}</h1>
    <dl>
      <dt>Channel</dt><dd>#${escapeHtml(channel.name)}</dd>
      <dt>Minecraft IGN</dt><dd>${escapeHtml(order.ign)}</dd>
      <dt>Order type</dt><dd>${escapeHtml(order.order_type || order.orderType || '')}</dd>
      <dt>Items</dt><dd>${escapeHtml(order.item)}</dd>
      <dt>Customer</dt><dd>${escapeHtml(customer)}</dd>
      <dt>Claimed by</dt><dd>${escapeHtml(staff)}</dd>
      <dt>Opened</dt><dd>${formatTimestamp(openedAt)}</dd>
      <dt>Closed</dt><dd>${formatTimestamp(closedAt)} by ${escapeHtml(closedBy?.username || 'Unknown')}</dd>
      <dt>Messages</dt><dd>${messages.length}</dd>
    </dl>
  </div>
  ${messageRows || '<p class="muted">No messages in this ticket.</p>'}
  <p class="footer">Monty · Redmont Essentials</p>
</body>
</html>`;
}

export function buildTranscriptAttachment(html, orderId) {
  const safeId = String(orderId).toLowerCase().replace(/[^a-z0-9-]/g, '');
  return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
    name: `order-${safeId}-transcript.html`,
    description: `Transcript for order #${orderId}`,
  });
}
