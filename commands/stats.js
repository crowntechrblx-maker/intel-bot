const { SlashCommandBuilder } = require('discord.js');
const { all, get } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Live database statistics from the Intel Portal'),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: true });

    const [
      total, critical, high, medium, low,
      active, banned, archived,
      notes, reports, shifts,
      recentEntity,
    ] = await Promise.all([
      get(`SELECT COUNT(*) AS c FROM roblox_entities`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE severity='CRITICAL'`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE severity='HIGH'`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE severity='MEDIUM'`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE severity='LOW'`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE status='ACTIVE'`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE status='BANNED'`),
      get(`SELECT COUNT(*) AS c FROM roblox_entities WHERE status='ARCHIVED'`),
      get(`SELECT COUNT(*) AS c FROM entity_notes`),
      get(`SELECT COUNT(*) AS c FROM interview_reports`),
      get(`SELECT COUNT(*) AS c FROM shift_logs WHERE end_time IS NOT NULL`),
      get(`SELECT username, added_at FROM roblox_entities ORDER BY added_at DESC LIMIT 1`),
    ]);

    const embed = base(COLORS.BLUE)
      .setAuthor({ name: 'MI5 Intel Portal — Live Statistics' })
      .setTitle('Database Overview')
      .addFields(
        {
          name: '⬛  Severity Breakdown',
          value: [
            `⬛ Critical  **${critical.c}**`,
            `🟥 High      **${high.c}**`,
            `🟧 Medium   **${medium.c}**`,
            `🟦 Low       **${low.c}**`,
            `\n**Total entities: ${total.c}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📋  Status',
          value: [
            `🟢 Active    **${active.c}**`,
            `🚫 Banned   **${banned.c}**`,
            `🗃️  Archived  **${archived.c}**`,
          ].join('\n'),
          inline: true,
        },
        { name: '​', value: '​', inline: true },
        { name: '📝  Case Notes',        value: `**${notes.c}**`,   inline: true },
        { name: '📄  Interview Reports', value: `**${reports.c}**`, inline: true },
        { name: '🕐  Shifts Logged',     value: `**${shifts.c}**`,  inline: true },
      );

    if (recentEntity) {
      embed.addFields({
        name: '🕵️  Last Entity Added',
        value: `**${recentEntity.username}** — <t:${Math.floor(new Date(recentEntity.added_at).getTime() / 1000)}:R>`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
