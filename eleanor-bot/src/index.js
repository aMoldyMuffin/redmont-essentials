import 'dotenv/config';
import { Client, GatewayIntentBits, REST, ActivityType } from 'discord.js';
import { registerGuildCommands } from './commands.js';
import { startApiServer } from './api.js';
import {
  buildLedgerEmbed,
  getInventory,
  postLedgerMessage,
  refreshLedgerMessage,
} from './inventory.js';
import { handleInventoryInteraction, isAuthorized } from './interactions.js';
import {
  ensureMemberOnLeaderboard,
  refreshLeaderboardMessage,
  syncLeaderboardFromRole,
} from './leaderboard.js';
import {
  handleLeaderboardCommand,
  handleLeaderboardInteraction,
} from './leaderboard-interactions.js';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;
const inventoryChannelId = process.env.INVENTORY_CHANNEL_ID;
const leaderboardChannelId = process.env.LEADERBOARD_CHANNEL_ID;
const apiPort = Number(process.env.PORT || process.env.API_PORT || 3848);
const apiSecret = process.env.ELEANOR_API_SECRET;
const adminSecret = process.env.ADMIN_SECRET || apiSecret;

if (!token || !guildId || !clientId) {
  console.error('Missing DISCORD_TOKEN, DISCORD_GUILD_ID, or DISCORD_CLIENT_ID');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await registerGuildCommands(rest, { clientId, guildId });
}

client.once('ready', async () => {
  console.log(`Eleanor is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (err) {
    const code = err?.code ?? err?.rawError?.code;
    console.error(
      'Slash command registration FAILED — commands will not appear in Discord.',
      err?.rawError || err?.message || err
    );
    if (code === 20012) {
      console.error(
        'Fix: DISCORD_CLIENT_ID must be the Application ID for the SAME bot as DISCORD_TOKEN. ' +
          'Open Eleanor in the Discord Developer Portal → General → Application ID. ' +
          'Do not use Monty\'s client ID on Eleanor\'s Railway service.'
      );
    }
    if (code === 50001 || err?.message?.includes('Missing Access')) {
      console.error(
        'Fix: Re-invite Eleanor with bot + applications.commands scopes, or check channel permissions.'
      );
    }
  }

  client.user.setActivity('inventory & leaderboard', { type: ActivityType.Watching });

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

  try {
    const sync = await syncLeaderboardFromRole(client, guildId);
    if (sync.ok && sync.added > 0) {
      console.log(`Leaderboard: added ${sync.added} members from role on startup.`);
    }
    await refreshLeaderboardMessage(client);
  } catch (err) {
    console.warn('Leaderboard startup sync:', err.message);
    if (err.message?.includes('Unknown Guild')) {
      console.warn(
        'Fix: DISCORD_GUILD_ID must be your server ID and Eleanor must be invited to that server.'
      );
    }
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const added = await ensureMemberOnLeaderboard(client, guildId, newMember);
    if (added) {
      console.log(`Leaderboard: auto-added ${newMember.user.username} (role granted).`);
    }
  } catch (err) {
    console.warn('guildMemberUpdate leaderboard:', err.message);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    const handledInv = await handleInventoryInteraction(interaction);
    if (handledInv) return;

    const handledLb = await handleLeaderboardInteraction(interaction, client, guildId);
    if (handledLb) return;

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
      return;
    }

    if (interaction.commandName === 'leaderboard') {
      await handleLeaderboardCommand(
        interaction,
        client,
        guildId,
        leaderboardChannelId
      );
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

client.login(token);
