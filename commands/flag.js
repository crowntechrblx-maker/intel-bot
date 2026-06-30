const { SlashCommandBuilder } = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flag')
    .setDescription('Flag a Roblox user for investigation')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Roblox username to flag')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for flagging')
        .setRequired(true)),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username').trim();
    const reason   = interaction.options.getString('reason').trim();

    const existing = await get(
      `SELECT id, status, severity FROM roblox_entities WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (existing) {
      await run(
        `INSERT INTO audit_logs (action, actor, target, target_type, details)
         VALUES ('FLAG_DUPLICATE', $1, $2, 'entity', $3)`,
        [op.username, username, `Already exists (ID ${existing.id}). Reason: ${reason}`]
      );

      return interaction.editReply({
        embeds: [
          base(COLORS.YELLOW)
            .setTitle('Already in Database')
            .setDescription(`**${username}** already exists in the intel database.`)
            .addFields(
              { name: '🆔  DB ID',    value: `\`${existing.id}\``,  inline: true },
              { name: '📊  Severity', value: existing.severity,      inline: true },
              { name: '📋  Status',   value: existing.status,        inline: true },
            )
            .addFields({ name: '📝  Your flag reason (logged)', value: reason }),
        ],
      });
    }

    const insert = await run(
      `INSERT INTO roblox_entities
         (roblox_id, username, added_by, severity, status, category, notes)
       VALUES ($1, $2, $3, 'MEDIUM', 'ACTIVE', 'UNCATEGORISED', $4)
       RETURNING id`,
      [
        `PENDING_${username.toLowerCase()}`,
        username,
        op.username,
        `Flagged via Discord by ${op.username}: ${reason}`,
      ]
    );

    await run(
      `INSERT INTO audit_logs (action, actor, target, target_type, details)
       VALUES ('FLAG_ENTITY', $1, $2, 'entity', $3)`,
      [op.username, username, reason]
    );

    const embed = base(COLORS.ORANGE)
      .setAuthor({ name: 'Intel Database — New Flag' })
      .setTitle(`🚩  ${username} Flagged`)
      .addFields(
        { name: '🆔  DB ID',      value: `\`${insert.id}\``, inline: true },
        { name: '📊  Severity',   value: 'MEDIUM',           inline: true },
        { name: '📋  Status',     value: 'ACTIVE',           inline: true },
        { name: '👤  Flagged by', value: op.username,        inline: true },
      )
      .addFields({ name: '📝  Reason', value: reason })
      .setFooter({ text: 'MI5 Intel Portal — Update severity and resolve Roblox ID at HQ' });

    await interaction.editReply({ embeds: [embed] });
  },
};
