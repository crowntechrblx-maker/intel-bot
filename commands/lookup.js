const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { get, all } = require('../db');
const { requireOperator } = require('../auth');

const SEVERITY_COLOR = {
  LOW: 0x00b0f4,
  MEDIUM: 0xf4a400,
  HIGH: 0xe04040,
  CRITICAL: 0x8b0000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Look up an entity in the intel database')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Roblox username to look up')
        .setRequired(true)),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username').trim();

    const entity = await get(
      `SELECT e.*, au.username AS added_by_name
         FROM roblox_entities e
         LEFT JOIN admin_users au ON au.username = e.added_by
        WHERE LOWER(e.username) = LOWER($1)
        LIMIT 1`,
      [username]
    );

    if (!entity) {
      return interaction.editReply({
        content: `No entity found for **${username}**. Use \`/flag\` to add them.`,
      });
    }

    if (entity.min_clearance > op.clearance_level) {
      return interaction.editReply({
        content: `**Access Denied.** This record requires clearance level **${entity.min_clearance}**.`,
      });
    }

    const recentNotes = await all(
      `SELECT note, author, created_at
         FROM entity_notes
        WHERE entity_id = $1
        ORDER BY created_at DESC
        LIMIT 3`,
      [entity.id]
    );

    const color = SEVERITY_COLOR[entity.severity] ?? 0x36393f;
    const lastUpdated = entity.last_fetched
      ? `<t:${Math.floor(new Date(entity.last_fetched).getTime() / 1000)}:R>`
      : 'Never';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Entity — ${entity.username}`)
      .setURL(`https://www.roblox.com/users/${entity.roblox_id}/profile`)
      .setThumbnail(entity.avatar_url ?? null)
      .addFields(
        { name: 'Severity',        value: entity.severity,  inline: true },
        { name: 'Status',          value: entity.status,    inline: true },
        { name: 'Category',        value: entity.category,  inline: true },
        { name: 'Clearance req.',  value: String(entity.min_clearance), inline: true },
        { name: 'Roblox ID',       value: entity.roblox_id, inline: true },
        { name: 'Last fetched',    value: lastUpdated,       inline: true },
        { name: 'Added by',        value: entity.added_by ?? 'Unknown', inline: true },
        { name: 'Added',           value: `<t:${Math.floor(new Date(entity.added_at).getTime() / 1000)}:D>`, inline: true },
      );

    if (entity.display_name && entity.display_name !== entity.username) {
      embed.setDescription(`Display name: **${entity.display_name}**`);
    }

    if (entity.notes) {
      embed.addFields({ name: 'Summary notes', value: entity.notes.slice(0, 1024) });
    }

    if (recentNotes.length > 0) {
      const notesText = recentNotes.map(n => {
        const ts = Math.floor(new Date(n.created_at).getTime() / 1000);
        return `<t:${ts}:d> **${n.author}**: ${n.note.slice(0, 120)}`;
      }).join('\n');
      embed.addFields({ name: 'Recent notes', value: notesText });
    }

    embed.setFooter({ text: `Intel Portal • ID ${entity.id}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
