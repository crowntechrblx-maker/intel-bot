const { SlashCommandBuilder } = require('discord.js');
const { get, all } = require('../db');
const { requireOperator } = require('../auth');
const { base, COLORS, SEVERITY_EMOJI, STATUS_EMOJI, ts, tsDate } = require('../utils/embeds');

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
      `SELECT * FROM roblox_entities WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username]
    );

    if (!entity) {
      return interaction.editReply({
        embeds: [
          base(COLORS.GREY)
            .setTitle('Entity Not Found')
            .setDescription(`No record found for **${username}**.\nUse \`/flag\` to add them or \`/whois\` to look up their Roblox profile.`),
        ],
      });
    }

    if (entity.min_clearance > op.clearance_level) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Access Denied')
            .setDescription(`This record requires clearance level **${entity.min_clearance}**.\nYour current level: **${op.clearance_level}**.`),
        ],
      });
    }

    const recentNotes = await all(
      `SELECT note, author, created_at FROM entity_notes
        WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 3`,
      [entity.id]
    );

    const sev   = SEVERITY_EMOJI[entity.severity]  ?? '❓';
    const stat  = STATUS_EMOJI[entity.status]       ?? '❓';
    const color = COLORS[entity.severity]           ?? COLORS.GREY;

    const lastFetched = entity.last_fetched
      ? ts(entity.last_fetched)
      : '`Never`';

    const embed = base(color)
      .setAuthor({ name: 'Intel Database — Entity Record' })
      .setTitle(entity.username + (entity.display_name && entity.display_name !== entity.username ? `  ·  ${entity.display_name}` : ''))
      .setURL(`https://www.roblox.com/users/${entity.roblox_id}/profile`)
      .setThumbnail(entity.avatar_url ?? null)
      .addFields(
        { name: `${sev}  Severity`,   value: `**${entity.severity}**`,  inline: true },
        { name: `${stat}  Status`,    value: `**${entity.status}**`,    inline: true },
        { name: '🗂️  Category',      value: entity.category,           inline: true },
        { name: '🆔  Roblox ID',     value: `\`${entity.roblox_id}\``, inline: true },
        { name: '🔐  Clearance req', value: `**${entity.min_clearance}**`, inline: true },
        { name: '🔄  Last fetched',  value: lastFetched,                inline: true },
        { name: '➕  Added by',      value: entity.added_by,           inline: true },
        { name: '📅  Added',         value: tsDate(entity.added_at),   inline: true },
        { name: '🆔  DB ID',         value: `\`${entity.id}\``,        inline: true },
      );

    if (entity.notes) {
      embed.addFields({ name: '📋  Summary', value: entity.notes.slice(0, 1024) });
    }

    if (recentNotes.length > 0) {
      const notesText = recentNotes
        .map(n => `${ts(n.created_at)}  **${n.author}**: ${n.note.slice(0, 120)}`)
        .join('\n');
      embed.addFields({ name: `📝  Recent Notes (${recentNotes.length})`, value: notesText });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
