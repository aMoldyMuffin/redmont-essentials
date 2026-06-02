import 'dotenv/config';
import { Client, GatewayIntentBits, REST, ActivityType } from 'discord.js';
import { registerGuildCommands } from './commands.js';
import { startApiServer } from './api.js';
import {
  buildLedgerEmbed,
  formatQuantity,
  getInventory,
  postLedgerMessage,
  refreshLedgerMessage,
} from './inventory.js';
import { handleInventoryInteraction, isAuthorized } from './interactions.js';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;
const inventoryChannelId = process.env.INVENTORY_CHANNEL_ID;
const apiPort = Number(process.env.PORT || process.env.API_PORT || 3848);
const apiSecret = process.env.ELEANOR_API_SECRET;
const adminSecret = process.env.ADMIN_SECRET || apiSecret;

if (!token || !guildId || !clientId) {
  console.error('Missing DISCORD_TOKEN, DISCORD_GUILD_ID, or DISCORD_CLIENT_ID');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await registerGuildCommands(rest, { clientId, guildId });
}

client.once('ready', async () => {
  console.log(`Eleanor is online as ${client.user.tag}`);
  client.user.setActivity('raw materials ledger', { type: ActivityType.Watching });

  if (apiSecret) {
    startApiServer(client, { port: apiPort, secret: apiSecret, adminSecret });
  } else {
    console.warn('Eleanor API not started — set ELEANOR_API_SECRET');
  }

  const refreshed = await refreshLedgerMessage(client);
  if (refreshed) {
    console.log('Ledger message refreshed on startup.');
  } else if (inventoryChannelId) {
    try {
      await postLedgerMessage(client, inventoryChannelId);
      console.log(`Posted new ledger to channel ${inventoryChannelId}.`);
    } catch (err) {
      console.warn('Could not auto-post ledger:', err.message);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    const handled = await handleInventoryInteraction(interaction);
    if (handled) return;

    if (!interaction.isChatInputCommand()) return;

    if (!isAuthorized(interaction.member)) {
      await interaction.reply({
        content: 'Eleanor commands are restricted to authorized inventory roles.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === 'ledger') {
      const sub = interaction.options.getSubcommand();

      if (sub === 'post') {
        await interaction.deferReply({ ephemeral: true });
        const channelId = inventoryChannelId || interaction.channelId;
        await postLedgerMessage(client, channelId);
        await interaction.editReply({
          content: `✅ Live ledger posted in <#${channelId}>. It updates automatically when stock changes.`,
        });
        return;
      }

      if (sub === 'refresh') {
        await interaction.deferReply({ ephemeral: true });
        const ok = await refreshLedgerMessage(client);
        await interaction.editReply({
          content: ok
            ? '✅ Ledger embed refreshed.'
            : 'No ledger message found. Run `/ledger post` first.',
        });
        return;
      }
    }

    if (interaction.commandName === 'inventory') {
      await interaction.reply({
        embeds: [buildLedgerEmbed(getInventory())],
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error('Eleanor interaction error:', err);
    const hint = err?.message?.includes('showModal')
      ? 'Could not open the form — try again.'
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
