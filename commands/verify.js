const { SlashCommandBuilder } = require('discord.js');
const { get, run } = require('../db');
const { base, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Discord account to your portal operator account')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Your portal username')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('token')
        .setDescription('Verification token from portal settings')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const portalUsername = interaction.options.getString('username').trim();
    const token          = interaction.options.getString('token').trim();
    const discordUserId  = interaction.user.id;

    const user = await get(
      `SELECT id, username, display_name, suspended, verify_token, verify_token_expires
         FROM admin_users WHERE LOWER(username) = LOWER($1)`,
      [portalUsername]
    );

    if (!user) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Account Not Found')
            .setDescription(`No portal account found for **${portalUsername}**.\nCheck your username and try again.`),
        ],
      });
    }

    if (user.suspended) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Account Suspended')
            .setDescription('This account is suspended. Contact an administrator.'),
        ],
      });
    }

    if (!user.verify_token || user.verify_token !== token) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Invalid Token')
            .setDescription('That token is invalid. Generate a fresh one from **Portal → Settings → Discord Link**.'),
        ],
      });
    }

    if (user.verify_token_expires && new Date(user.verify_token_expires) < new Date()) {
      return interaction.editReply({
        embeds: [
          base(COLORS.YELLOW)
            .setTitle('Token Expired')
            .setDescription('This token has expired. Generate a new one from **Portal → Settings → Discord Link**.'),
        ],
      });
    }

    const conflict = await get(
      `SELECT id FROM admin_users WHERE discord_id = $1 AND id != $2`,
      [discordUserId, user.id]
    );

    if (conflict) {
      return interaction.editReply({
        embeds: [
          base(COLORS.RED)
            .setTitle('Discord Already Linked')
            .setDescription('Your Discord account is already linked to a different portal account. Contact an administrator.'),
        ],
      });
    }

    await run(
      `UPDATE admin_users SET discord_id = $1, verify_token = NULL, verify_token_expires = NULL WHERE id = $2`,
      [discordUserId, user.id]
    );

    await run(
      `INSERT INTO audit_logs (action, actor, target, target_type, details)
       VALUES ('DISCORD_LINK', $1, $1, 'admin_user', $2)`,
      [user.username, `Linked Discord ID ${discordUserId}`]
    );

    const embed = base(COLORS.GREEN)
      .setAuthor({ name: 'MI5 Intel Portal — Account Verification' })
      .setTitle('✅  Account Linked')
      .setDescription(`Your Discord is now linked to portal operator **${user.display_name ?? user.username}**.\nYou can now use all field commands.`)
      .addFields({ name: '👤  Portal username', value: user.username, inline: true });

    await interaction.editReply({ embeds: [embed] });
  },
};
