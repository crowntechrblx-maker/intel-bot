const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Append a note to an entity record')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Roblox username')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('note')
        .setDescription('Note to append')
        .setRequired(true)),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username').trim();
    const note     = interaction.options.getString('note').trim();

    const entity = await get(
      `SELECT id, min_clearance FROM roblox_entities WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (!entity) {
      return interaction.editReply({
        content: `No entity found for **${username}**. Use \`/flag\` to add them first.`,
      });
    }

    if (entity.min_clearance > op.clearance_level) {
      return interaction.editReply({
        content: `**Access Denied.** This record requires clearance level **${entity.min_clearance}**.`,
      });
    }

    await run(
      `INSERT INTO entity_notes (entity_id, author, note) VALUES ($1, $2, $3)`,
      [entity.id, op.username, note]
    );

    await run(
      `INSERT INTO audit_logs (action, actor, target, target_type, details)
       VALUES ('ADD_NOTE', $1, $2, 'entity', $3)`,
      [op.username, username, note.slice(0, 500)]
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Note Added')
      .addFields(
        { name: 'Entity',  value: username,    inline: true },
        { name: 'Author',  value: op.username, inline: true },
      )
      .addFields({ name: 'Note', value: note.slice(0, 1024) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
