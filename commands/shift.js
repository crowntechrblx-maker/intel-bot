const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Start or end your duty shift')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Clock in for duty')
        .addStringOption(opt =>
          opt.setName('division')
            .setDescription('Your division (optional)')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('Clock out — ends your active shift')),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const discordUserId   = interaction.user.id;
    const discordUsername = interaction.user.tag;

    if (sub === 'start') {
      // Check for an already-open shift
      const active = await get(
        `SELECT id, start_time FROM shift_logs
          WHERE discord_user_id = $1 AND end_time IS NULL
          ORDER BY start_time DESC
          LIMIT 1`,
        [discordUserId]
      );

      if (active) {
        const ts = Math.floor(new Date(active.start_time).getTime() / 1000);
        return interaction.editReply({
          content: `You already have an active shift that started <t:${ts}:R>. Use \`/shift end\` to close it first.`,
        });
      }

      const division = interaction.options.getString('division') ?? null;

      const insert = await run(
        `INSERT INTO shift_logs (discord_user_id, discord_username, division, start_time)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, start_time`,
        [discordUserId, discordUsername, division]
      );

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Shift Started')
        .addFields(
          { name: 'Operator',  value: discordUsername, inline: true },
          { name: 'Division',  value: division ?? '—',  inline: true },
          { name: 'Shift ID',  value: String(insert.id), inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Use /shift end when you clock off.' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'end') {
      const active = await get(
        `SELECT id, start_time, division FROM shift_logs
          WHERE discord_user_id = $1 AND end_time IS NULL
          ORDER BY start_time DESC
          LIMIT 1`,
        [discordUserId]
      );

      if (!active) {
        return interaction.editReply({
          content: `You have no active shift. Use \`/shift start\` to begin one.`,
        });
      }

      const now       = new Date();
      const startMs   = new Date(active.start_time).getTime();
      const durationMinutes = Math.round((now.getTime() - startMs) / 60000);

      await run(
        `UPDATE shift_logs
            SET end_time = NOW(), duration_minutes = $1
          WHERE id = $2`,
        [durationMinutes, active.id]
      );

      const hours   = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const durationStr = hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Shift Ended')
        .addFields(
          { name: 'Operator',  value: discordUsername,     inline: true },
          { name: 'Division',  value: active.division ?? '—', inline: true },
          { name: 'Duration',  value: durationStr,          inline: true },
          { name: 'Shift ID',  value: String(active.id),   inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
