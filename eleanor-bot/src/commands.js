import { PermissionFlagsBits, Routes, SlashCommandBuilder } from 'discord.js';

export const ELEANOR_COMMAND_NAMES = new Set(['ledger', 'inventory']);

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
  ];
}

export async function registerGuildCommands(rest, { clientId, guildId }) {
  const body = buildCommandDefinitions().map((d) => d.json);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log('Eleanor slash commands registered (/ledger, /inventory).');
}
