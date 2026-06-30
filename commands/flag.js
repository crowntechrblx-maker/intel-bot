const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { get, run } = require('../db');
const { requireOperator } = require('../auth');

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
      // Already exists — log to audit and note the operator
      await run(
        `INSERT INTO audit_logs (action, actor, target, target_type, details)
         VALUES ('FLAG_DUPLICATE', $1, $2, 'entity', $3)`,
        [op.username, username, `Already exists (ID ${existing.id}, status: ${existing.status}). Reason: ${reason}`]
      );

      return interaction.editReply({
        content: `**${username}** is already in the database (ID \`${existing.id}\`, status: **${existing.status}**, severity: **${existing.severity}**).\nYour flag reason has been logged. Use \`/note\` to append details.`,
      });
    }

    // Insert new entity — roblox_id unknown at flag time, use username as placeholder
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

    const embed = new EmbedBuilder()
      .setColor(0xf4a400)
      .setTitle('Entity Flagged')
      .addFields(
        { name: 'Username',  value: username,      inline: true },
        { name: 'Severity',  value: 'MEDIUM',      inline: true },
        { name: 'Status',    value: 'ACTIVE',      inline: true },
        { name: 'Flagged by', value: op.username,  inline: true },
        { name: 'DB ID',     value: String(insert.id), inline: true },
      )
      .addFields({ name: 'Reason', value: reason })
      .setFooter({ text: 'Portal operators can update severity and resolve the Roblox ID via HQ.' });

    await interaction.editReply({ embeds: [embed] });
  },
};
