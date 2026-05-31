import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;
const websiteUrl = process.env.WEBSITE_URL || 'https://example.com';

if (!token || !guildId || !clientId) {
  console.error('Missing DISCORD_TOKEN, DISCORD_GUILD_ID, or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ── Slash commands ──
const commands = [
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Get Redmont Essentials shop info and website link'),
  new SlashCommandBuilder()
    .setName('kits')
    .setDescription('List available starter gear kits'),
  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Post a stock update to the website channel (staff only)')
    .addStringOption((opt) =>
      opt.setName('message').setDescription('Stock update message').setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('Slash commands registered.');
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'shop') {
    const embed = new EmbedBuilder()
      .setColor(0xd4af37)
      .setTitle('Redmont Essentials')
      .setDescription('Everything you need to get started on Democracy Craft.')
      .addFields(
        { name: 'Gear Kits', value: 'Survival Starter · Adventurer · Builder Bundle', inline: false },
        { name: 'Buy & Sell', value: 'General goods via in-game chest shops (`b: Redmont Essentials`)', inline: false },
        { name: 'Website', value: websiteUrl, inline: false },
      )
      .setFooter({ text: 'Order custom kits here on Discord!' });

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'kits') {
    const embed = new EmbedBuilder()
      .setColor(0xd4af37)
      .setTitle('Starter Gear Kits')
      .addFields(
        {
          name: '🎒 Survival Starter',
          value: 'Stone tools, food, torches & building blocks',
          inline: false,
        },
        {
          name: '⚔️ Adventurer Kit (Popular)',
          value: 'Iron armor, full tool set, crafting table, furnace & supplies',
          inline: false,
        },
        {
          name: '🏗️ Builder Bundle',
          value: 'Common blocks, glass, doors & decor basics',
          inline: false,
        },
      )
      .setFooter({ text: 'DM staff or open a ticket to order. Prices on request.' });

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'stock') {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
      await interaction.reply({ content: 'Staff only.', ephemeral: true });
      return;
    }

    const message = interaction.options.getString('message', true);
    const channelId = process.env.STOCK_CHANNEL_ID;

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('📦 Stock Update')
      .setDescription(message)
      .setTimestamp()
      .setFooter({ text: 'Redmont Essentials' });

    if (channelId) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    }

    await interaction.reply({ content: 'Stock update posted.', ephemeral: true });

    // Future: POST to a Cloudflare Worker API to sync with the website live feed
  }
});

registerCommands()
  .then(() => client.login(token))
  .catch(console.error);
