import { PermissionFlagsBits, Routes, SlashCommandBuilder } from 'discord.js';

export const STAFF_COMMAND_NAMES = new Set(['shop', 'kits', 'leaderboard', 'mystats', 'orders']);

export function buildCommandDefinitions() {
  const staffPerm = PermissionFlagsBits.ManageMessages;

  return [
    {
      staff: false,
      json: new SlashCommandBuilder()
        .setName('order')
        .setDescription('Place an order with Redmont Essentials')
        .toJSON(),
    },
    {
      staff: true,
      json: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Redmont Essentials shop info (staff)')
        .setDefaultMemberPermissions(staffPerm)
        .toJSON(),
    },
    {
      staff: true,
      json: new SlashCommandBuilder()
        .setName('kits')
        .setDescription('List starter gear kits (staff)')
        .setDefaultMemberPermissions(staffPerm)
        .toJSON(),
    },
    {
      staff: true,
      json: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Staff leaderboard by order points')
        .setDefaultMemberPermissions(staffPerm)
        .toJSON(),
    },
    {
      staff: true,
      json: new SlashCommandBuilder()
        .setName('mystats')
        .setDescription('Your staff claim stats')
        .setDefaultMemberPermissions(staffPerm)
        .toJSON(),
    },
    {
      staff: true,
      json: new SlashCommandBuilder()
        .setName('orders')
        .setDescription('Open orders waiting to be claimed (staff)')
        .setDefaultMemberPermissions(staffPerm)
        .toJSON(),
    },
  ];
}

export async function registerGuildCommands(rest, { clientId, guildId, staffRoleId }) {
  const defs = buildCommandDefinitions();
  const body = defs.map((d) => d.json);
  const registered = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });

  if (staffRoleId) {
    for (const cmd of registered) {
      if (!STAFF_COMMAND_NAMES.has(cmd.name)) continue;
      await rest.put(Routes.applicationCommandPermissions(clientId, guildId, cmd.id), {
        body: {
          permissions: [{ id: staffRoleId, type: 1, permission: true }],
        },
      });
    }
  }

  console.log('Monty slash commands registered (customers: /order only).');
  return registered;
}
