const { get } = require('./db');

/**
 * Returns the admin_users row if the Discord user is linked and not suspended,
 * or null if they are not authorised.
 */
async function getOperator(discordUserId) {
  return get(
    `SELECT id, username, display_name, role, clearance_level
       FROM admin_users
      WHERE discord_id = $1
        AND suspended = FALSE`,
    [discordUserId]
  );
}

/**
 * Replies with an ephemeral "not authorised" message and returns false.
 * Use as: if (!await requireOperator(interaction)) return;
 */
async function requireOperator(interaction) {
  const op = await getOperator(interaction.user.id);
  if (!op) {
    await interaction.reply({
      content: '**Access Denied.** Your Discord account is not linked to a portal operator account.\nUse `/verify <portal-username> <token>` to link your account.',
      ephemeral: true,
    });
    return null;
  }
  return op;
}

module.exports = { getOperator, requireOperator };
