const { EmbedBuilder } = require('discord.js');

const COLORS = {
  GREEN:    0x57f287,
  RED:      0xed4245,
  YELLOW:   0xfee75c,
  BLUE:     0x5865f2,
  BLURPLE:  0x5865f2,
  GREY:     0x4f545c,
  WHITE:    0xffffff,
  ORANGE:   0xe67e22,

  // Severity
  LOW:      0x00b0f4,
  MEDIUM:   0xf4a400,
  HIGH:     0xe04040,
  CRITICAL: 0x8b0000,

  // Status
  ACTIVE:   0x57f287,
  INACTIVE: 0x4f545c,
  ARCHIVED: 0x4f545c,
  BANNED:   0xed4245,
};

const SEVERITY_EMOJI = { LOW: '🟦', MEDIUM: '🟧', HIGH: '🟥', CRITICAL: '⬛' };
const STATUS_EMOJI   = { ACTIVE: '🟢', INACTIVE: '⚫', ARCHIVED: '🗃️', BANNED: '🚫' };

function base(color) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: 'MI5 Intel Portal' })
    .setTimestamp();
}

function success(title, description) {
  return base(COLORS.GREEN).setTitle(`✅  ${title}`).setDescription(description ?? null);
}

function error(title, description) {
  return base(COLORS.RED).setTitle(`❌  ${title}`).setDescription(description ?? null);
}

function warn(title, description) {
  return base(COLORS.YELLOW).setTitle(`⚠️  ${title}`).setDescription(description ?? null);
}

function info(title, description) {
  return base(COLORS.BLUE).setTitle(title).setDescription(description ?? null);
}

function ts(date) {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}

function tsDate(date) {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:D>`;
}

module.exports = { COLORS, SEVERITY_EMOJI, STATUS_EMOJI, base, success, error, warn, info, ts, tsDate };
