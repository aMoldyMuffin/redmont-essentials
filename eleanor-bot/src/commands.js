import { PermissionFlagsBits, Routes, SlashCommandBuilder } from 'discord.js';

export const ELEANOR_COMMAND_NAMES = new Set(['ledger', 'inventory', 'leaderboard']);

function staffPermissions() {
  const roleIds = (process.env.ELEANOR_ROLE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (roleIds.length) {
    return PermissionFlagsBits.SendMessages;
  }

  return PermissionFlagsBits.ManageMessages;
}

export function buildCommandDefinitions() {
  const perm = staffPermissions();

  return [
    {
      json: new SlashCommandBuilder()
        .setName('ledger')
        .setDescription('Manage the shared inventory ledger message (authorized roles)')
        .setDefaultMemberPermissions(perm)
        .addSubcommand((sub) =>
          sub.setName('post').setDescription('Post or replace the live ledger in this channel')
        )
        .addSubcommand((sub) =>
          sub.setName('refresh').setDescription('Refresh the ledger embed with current counts')
        )
        .toJSON(),
    },
    {
      json: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View current raw material stock (authorized roles)')
        .setDefaultMemberPermissions(perm)
        .toJSON(),
    },
    {
      json: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Manage the staff leaderboard (authorized roles)')
        .setDefaultMemberPermissions(perm)
        .addSubcommand((sub) =>
          sub.setName('post').setDescription('Post or replace the live leaderboard in this channel')
        )
        .addSubcommand((sub) =>
          sub.setName('refresh').setDescription('Refresh the leaderboard embed')
        )
        .addSubcommand((sub) =>
          sub
            .setName('sync')
            .setDescription('Add everyone with the configured role (starts at 0 pts)')
        )
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Set a member’s score')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('Member').setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt.setName('score').setDescription('New score').setRequired(true).setMinValue(0)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add or subtract points')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('Member').setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt
                .setName('points')
                .setDescription('Points to add (use negative to subtract)')
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('Remove a member from the leaderboard')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('Member').setRequired(true)
            )
        )
        .addSubcommand((sub) => sub.setName('view').setDescription('View current standings'))
        .toJSON(),
    },
  ];
}

export async function registerGuildCommands(rest, { clientId, guildId }) {
  const body = buildCommandDefinitions().map((d) => d.json);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log('Eleanor slash commands registered (/ledger, /inventory, /leaderboard).');
}
