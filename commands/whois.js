const { SlashCommandBuilder } = require('discord.js');
const { get } = require('../db');
const { requireOperator } = require('../auth');
const { quickProfile } = require('../utils/roblox');
const { base, COLORS, SEVERITY_EMOJI, STATUS_EMOJI, ts, tsDate } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Live Roblox profile lookup — does not require entity to be in the DB')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Roblox username')
        .setRequired(true)),

  async execute(interaction) {
    const op = await requireOperator(interaction);
    if (!op) return;

    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username').trim();

    const [profile, dbEntity] = await Promise.all([
      quickProfile(username),
      get(
        `SELECT id, severity, status, category, min_clearance FROM roblox_entities WHERE LOWER(username) = LOWER($1)`,
        [username]
      ),
    ]);

    if (!profile) {
      const embed = base(COLORS.RED)
        .setTitle('User Not Found')
        .setDescription(`No Roblox account found for **${username}**.\nThey may have changed their username or never existed.`);
      return interaction.editReply({ embeds: [embed] });
    }

    const isBanned   = profile.is_banned;
    const created    = profile.created ? tsDate(profile.created) : 'Unknown';
    const color      = isBanned
      ? COLORS.RED
      : dbEntity
        ? (COLORS[dbEntity.severity] ?? COLORS.BLUE)
        : COLORS.BLUE;

    const embed = base(color)
      .setAuthor({
        name: 'Roblox Profile Lookup',
        iconURL: 'https://images.rbxcdn.com/90f64b7e15980a4e17e9a4a43d0e3b62-roblox-logo.webp',
      })
      .setTitle(profile.username + (profile.display_name !== profile.username ? `  ·  ${profile.display_name}` : ''))
      .setURL(`https://www.roblox.com/users/${profile.roblox_id}/profile`)
      .setThumbnail(profile.avatar_url)
      .addFields(
        { name: '🆔  Roblox ID',   value: profile.roblox_id,               inline: true },
        { name: '📅  Account created', value: created,                      inline: true },
        { name: '🚫  Banned',       value: isBanned ? 'Yes' : 'No',         inline: true },
        { name: '👥  Friends',      value: String(profile.friends_count),   inline: true },
        { name: '👁️  Followers',    value: String(profile.followers_count), inline: true },
        { name: '🏘️  Groups',       value: String(profile.groups.length),   inline: true },
      );

    if (profile.description) {
      embed.addFields({ name: '📝  Bio', value: profile.description.slice(0, 300) });
    }

    if (profile.groups.length > 0) {
      const groupList = profile.groups
        .slice(0, 5)
        .map(g => `• **${g.group.name}** — ${g.role.name}`)
        .join('\n');
      embed.addFields({
        name: `🏘️  Groups (${profile.groups.length}${profile.groups.length > 5 ? ', showing 5' : ''})`,
        value: groupList,
      });
    }

    // Intel DB cross-reference
    if (dbEntity) {
      const sev  = SEVERITY_EMOJI[dbEntity.severity]  ?? '❓';
      const stat = STATUS_EMOJI[dbEntity.status]       ?? '❓';
      embed.addFields({
        name: '🗂️  Intel DB Record',
        value: [
          `${sev} **${dbEntity.severity}**  ${stat} **${dbEntity.status}**`,
          `Category: **${dbEntity.category}**  ·  DB ID: \`${dbEntity.id}\``,
          dbEntity.min_clearance > 1 ? `Clearance req: **${dbEntity.min_clearance}**` : '',
        ].filter(Boolean).join('\n'),
      });
    } else {
      embed.addFields({
        name: '🗂️  Intel DB Record',
        value: '⚠️ Not in database — use `/flag` to add them.',
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
