import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getCatalog, calculateOrderPrice, formatMoney, findKit, findCategory } from './catalog.js';
import { processWebsiteOrder } from './orders.js';

const pendingOrders = new Map();

export function buildOrderStartEmbed(catalog) {
  return new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle('🛒 Place an Order')
    .setDescription(
      'Order gear kits, buy items, or sell materials — same as the website.\n\nClick **Start order** below, pick your items, then enter your Minecraft username.'
    )
    .setFooter({ text: 'Redmont Essentials · Monty' });
}

export function buildOrderStartRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('monty_order:start')
      .setLabel('Start order')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛒')
  );
}

function buildTypeSelect(catalog) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('monty_order:type')
      .setPlaceholder('What kind of order?')
      .addOptions(
        catalog.orderTypes.map((t) => ({
          label: `${t.icon || ''} ${t.label}`.trim(),
          value: t.id,
          description: t.desc?.slice(0, 100),
        }))
      )
  );
}

function buildKitSelect(catalog) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('monty_order:kit')
      .setPlaceholder('Choose a gear kit')
      .addOptions(
        catalog.kits.map((k) => ({
          label: `${k.icon ? `${k.icon} ` : ''}${k.id}`.trim().slice(0, 100),
          value: k.key,
          description: `${formatMoney(catalog, k.price)} · ${k.shortDesc || ''}`.slice(0, 100),
        }))
      )
  );
}

function buildCategorySelect(catalog, orderType) {
  const isSell = orderType === 'Sell Items';
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('monty_order:categories')
      .setPlaceholder(isSell ? 'What are you selling?' : 'What do you want to buy?')
      .setMinValues(1)
      .setMaxValues(Math.min(5, catalog.categories.length))
      .addOptions(
        catalog.categories.map((c) => {
          const price = isSell
            ? Math.round(c.price * (catalog.pricing?.sellMultiplier ?? 0.8))
            : c.price;
          return {
            label: c.id.slice(0, 100),
            value: c.key,
            description: formatMoney(catalog, price).slice(0, 100),
          };
        })
      )
  );
}

function buildIgnModal() {
  return new ModalBuilder()
    .setCustomId('monty_order:modal')
    .setTitle('Your order details')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ign')
          .setLabel('Minecraft username')
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(16)
          .setRequired(true)
          .setPlaceholder('Your IGN')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Notes (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(false)
          .setPlaceholder('When you are online, quantity, etc.')
      )
    );
}

export async function handleDiscordOrderInteraction(interaction, client, ordersChannelId) {
  const catalog = getCatalog();

  if (interaction.isButton() && interaction.customId === 'monty_order:start') {
    await interaction.reply({
      content: '**Step 1 of 3** — Pick an order type:',
      components: [buildTypeSelect(catalog)],
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'monty_order:type') {
    const orderType = interaction.values[0];
    pendingOrders.set(interaction.user.id, { orderType, items: [] });

    if (orderType === 'Gear Kit') {
      await interaction.update({
        content: '**Step 2 of 3** — Choose a kit:',
        components: [buildKitSelect(catalog)],
      });
      return true;
    }

    if (orderType === 'Buy Items' || orderType === 'Sell Items') {
      await interaction.update({
        content: '**Step 2 of 3** — Select one or more categories:',
        components: [buildCategorySelect(catalog, orderType)],
      });
      return true;
    }

    pendingOrders.set(interaction.user.id, { orderType, items: ['Custom request'] });
    // Discord only allows showModal OR update — not both on one interaction
    await interaction.showModal(buildIgnModal());
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'monty_order:kit') {
    const kit = findKit(catalog, interaction.values[0]);
    const pending = pendingOrders.get(interaction.user.id) || { orderType: 'Gear Kit' };
    pending.items = [kit?.id || interaction.values[0]];
    pendingOrders.set(interaction.user.id, pending);

    await interaction.showModal(buildIgnModal());
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'monty_order:categories') {
    const pending = pendingOrders.get(interaction.user.id);
    if (!pending) {
      await interaction.reply({ content: 'Session expired — run `/order` again.', ephemeral: true });
      return true;
    }
    pending.items = interaction.values.map((v) => findCategory(catalog, v)?.id || v);
    pendingOrders.set(interaction.user.id, pending);

    await interaction.showModal(buildIgnModal());
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'monty_order:modal') {
    const pending = pendingOrders.get(interaction.user.id);
    if (!pending) {
      await interaction.reply({ content: 'Session expired — run `/order` again.', ephemeral: true });
      return true;
    }

    const ign = interaction.fields.getTextInputValue('ign').trim();
    const notes = interaction.fields.getTextInputValue('notes')?.trim() || null;

    if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
      await interaction.reply({
        content: 'Invalid Minecraft username (3–16 letters, numbers, underscores).',
        ephemeral: true,
      });
      return true;
    }

    let item =
      pending.orderType === 'Other'
        ? notes || 'Custom request'
        : pending.items.join(', ');

    if (pending.orderType === 'Other' && !notes) {
      await interaction.reply({ content: 'Please describe your request in the notes field.', ephemeral: true });
      return true;
    }

    const pricing = calculateOrderPrice(catalog, pending.orderType, item);
    pendingOrders.delete(interaction.user.id);

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await processWebsiteOrder(client, ordersChannelId, {
        ign,
        orderType: pending.orderType,
        item,
        notes: pending.orderType !== 'Other' ? notes : null,
        discord: `<@${interaction.user.id}> (${interaction.user.username})`,
        price: pricing.total,
        priceDisplay: pricing.display,
        source: 'discord',
      });

      await interaction.editReply({
        content: `✅ Order **#${result.id}** submitted!\n**Total:** ${pricing.display}\nStaff will claim it in the orders channel.`,
      });
    } catch (err) {
      console.error('Discord order error:', err);
      await interaction.editReply({
        content: 'Could not submit your order. Try again or use the website.',
      });
    }
    return true;
  }

  return false;
}
