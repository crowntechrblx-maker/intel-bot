const { SlashCommandBuilder } = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS, ts } = require('../utils/embeds');

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

    const sub             = interaction.options.getSubcommand();
    const discordUserId   = interaction.user.id;
    const discordUsername = interaction.user.tag;

    if (sub === 'start') {
      const active = await get(
        `SELECT id, start_time FROM shift_logs
          WHERE discord_user_id = $1 AND end_time IS NULL
          ORDER BY start_time DESC LIMIT 1`,
        [discordUserId]
      );

      if (active) {
        return interaction.editReply({
          embeds: [
            base(COLORS.YELLOW)
              .setTitle('Already On Shift')
              .setDescription(`You have an active shift that started ${ts(active.start_time)}.\nUse \`/shift end\` to close it first.`),
          ],
        });
      }

      const division = interaction.options.getString('division') ?? null;

      const insert = await run(
        `INSERT INTO shift_logs (discord_user_id, discord_username, division, start_time)
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [discordUserId, discordUsername, division]
      );

      const embed = base(COLORS.GREEN)
        .setAuthor({ name: 'MI5 Intel Portal — Shift Management' })
        .setTitle('🟢  Shift Started')
        .addFields(
          { name: '👤  Operator', value: discordUsername,       inline: true },
          { name: '🏢  Division', value: division ?? '—',       inline: true },
          { name: '🆔  Shift ID', value: `\`${insert.id}\``,   inline: true },
        )
        .setFooter({ text: 'MI5 Intel Portal — Use /shift end when you clock off' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'end') {
      const active = await get(
        `SELECT id, start_time, division FROM shift_logs
          WHERE discord_user_id = $1 AND end_time IS NULL
          ORDER BY start_time DESC LIMIT 1`,
        [discordUserId]
      );

      if (!active) {
        return interaction.editReply({
          embeds: [
            base(COLORS.GREY)
              .setTitle('No Active Shift')
              .setDescription(`You have no active shift. Use \`/shift start\` to begin one.`),
          ],
        });
      }

      const durationMinutes = Math.round((Date.now() - new Date(active.start_time).getTime()) / 60000);

      await run(
        `UPDATE shift_logs SET end_time = NOW(), duration_minutes = $1 WHERE id = $2`,
        [durationMinutes, active.id]
      );

      const h = Math.floor(durationMinutes / 60);
      const m = durationMinutes % 60;
      const durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

      const embed = base(COLORS.RED)
        .setAuthor({ name: 'MI5 Intel Portal — Shift Management' })
        .setTitle('🔴  Shift Ended')
        .addFields(
          { name: '👤  Operator', value: discordUsername,           inline: true },
          { name: '🏢  Division', value: active.division ?? '—',   inline: true },
          { name: '⏱️  Duration', value: `**${durationStr}**`,     inline: true },
          { name: '🆔  Shift ID', value: `\`${active.id}\``,       inline: true },
          { name: '🕐  Started',  value: ts(active.start_time),    inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
