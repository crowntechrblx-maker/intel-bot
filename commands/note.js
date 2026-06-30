const { SlashCommandBuilder } = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS, ts } = require('../utils/embeds');

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
        embeds: [
          base(COLORS.GREY)
            .setTitle('Entity Not Found')
            .setDescription(`No record for **${username}**. Use \`/flag\` to add them first.`),
        ],
      });
    }

    if (entity.min_clearance > op.clearance_level) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Access Denied')
            .setDescription(`This record requires clearance level **${entity.min_clearance}**.`),
        ],
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

    const embed = base(COLORS.GREEN)
      .setAuthor({ name: 'Intel Database — Case Note Added' })
      .setTitle(`📝  Note filed on ${username}`)
      .addFields(
        { name: '👤  Author', value: op.username, inline: true },
        { name: '🆔  Entity DB ID', value: `\`${entity.id}\``, inline: true },
      )
      .addFields({ name: '📋  Note', value: note.slice(0, 1024) });

    await interaction.editReply({ embeds: [embed] });
  },
};
