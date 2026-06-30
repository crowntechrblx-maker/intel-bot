const { SlashCommandBuilder } = require('discord.js');
const { all } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Show all operators currently on shift'),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: false }); // visible to all — it's a team tool

    const active = await all(
      `SELECT discord_username, division, start_time
         FROM shift_logs
        WHERE end_time IS NULL
        ORDER BY start_time ASC`
    );

    if (active.length === 0) {
      const embed = base(COLORS.GREY)
        .setAuthor({ name: 'MI5 Intel Portal — Active Roster' })
        .setTitle('No operators on shift')
        .setDescription('Nobody is currently clocked in. Use `/shift start` to begin a shift.');

      return interaction.editReply({ embeds: [embed] });
    }

    const lines = active.map((row, i) => {
      const ts   = Math.floor(new Date(row.start_time).getTime() / 1000);
      const div  = row.division ? ` · ${row.division}` : '';
      return `\`${String(i + 1).padStart(2, '0')}\`  **${row.discord_username}**${div}\n       Started <t:${ts}:R>`;
    });

    const embed = base(COLORS.GREEN)
      .setAuthor({ name: 'MI5 Intel Portal — Active Roster' })
      .setTitle(`${active.length} Operator${active.length !== 1 ? 's' : ''} On Shift`)
      .setDescription(lines.join('\n\n'));

    await interaction.editReply({ embeds: [embed] });
  },
};
