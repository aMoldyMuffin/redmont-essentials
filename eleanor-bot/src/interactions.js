import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  adjustMaterial,
  buildActionRow,
  buildMaterialSelectRow,
  formatQuantity,
  getMaterial,
  getRecentLog,
  refreshLedgerMessage,
} from './inventory.js';

const pendingMaterial = new Map();

function buildQuantityModal(materialId, action) {
  const material = getMaterial(materialId);
  const title = action === 'add' ? `Add ${material?.label || 'stock'}` : `Remove ${material?.label || 'stock'}`;

  return new ModalBuilder()
    .setCustomId(`eleanor_inv:modal:${action}:${materialId}`)
    .setTitle(title.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Quantity')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(10)
          .setRequired(true)
          .setPlaceholder('e.g. 64')
      )
    );
}

export function isAuthorized(member) {
  if (!member) return false;
  if (member.permissions.has('ManageMessages')) return true;

  const roleIds = (process.env.ELEANOR_ROLE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!roleIds.length) return false;
  return roleIds.some((id) => member.roles.cache.has(id));
}

export async function handleInventoryInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === 'eleanor_inv:adjust') {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({
        content: 'You do not have permission to adjust inventory.',
        ephemeral: true,
      });
      return true;
    }

    await interaction.reply({
      content: 'Pick a material, then choose **Add** or **Remove**.',
      components: [buildMaterialSelectRow()],
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'eleanor_inv:material') {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const materialId = interaction.values[0];
    const material = getMaterial(materialId);
    if (!material) {
      await interaction.update({ content: 'Unknown material.', components: [] });
      return true;
    }

    pendingMaterial.set(interaction.user.id, materialId);

    await interaction.update({
      content: `**${material.emoji} ${material.label}** — current stock: \`${formatQuantity(material.quantity)}\`\nAdd or remove how many?`,
      components: [buildActionRow(materialId)],
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('eleanor_inv:add:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const materialId = interaction.customId.slice('eleanor_inv:add:'.length);
    await interaction.showModal(buildQuantityModal(materialId, 'add'));
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('eleanor_inv:sub:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const materialId = interaction.customId.slice('eleanor_inv:sub:'.length);
    await interaction.showModal(buildQuantityModal(materialId, 'sub'));
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('eleanor_inv:modal:')) {
    if (!isAuthorized(interaction.member)) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true });
      return true;
    }

    const parts = interaction.customId.split(':');
    const action = parts[2];
    const materialId = parts[3];
    const raw = interaction.fields.getTextInputValue('amount').trim();
    const amount = Math.floor(Number(raw.replace(/,/g, '')));

    if (!Number.isFinite(amount) || amount <= 0) {
      await interaction.reply({
        content: 'Enter a positive whole number.',
        ephemeral: true,
      });
      return true;
    }

    const delta = action === 'sub' ? -amount : amount;
    const result = adjustMaterial(
      materialId,
      delta,
      interaction.user.id,
      interaction.user.username
    );

    if (result.error === 'insufficient_stock') {
      await interaction.reply({
        content: `Not enough stock. Current: **${formatQuantity(result.current)}**, tried to remove **${amount}**.`,
        ephemeral: true,
      });
      return true;
    }

    if (result.error) {
      await interaction.reply({ content: 'Could not update inventory.', ephemeral: true });
      return true;
    }

    pendingMaterial.delete(interaction.user.id);
    const log = getRecentLog(1)[0];
    await refreshLedgerMessage(interaction.client, log);

    const sign = delta > 0 ? '+' : '';
    await interaction.reply({
      content: `✅ **${result.material.emoji} ${result.material.label}** ${sign}${amount} → \`${formatQuantity(result.material.quantity)}\` in stock.`,
      ephemeral: true,
    });
    return true;
  }

  return false;
}
