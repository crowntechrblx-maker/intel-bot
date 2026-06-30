const { SlashCommandBuilder } = require('discord.js');
const { pool } = require('../db');
const { base, COLORS } = require('../utils/embeds');

const START_TIME = Date.now();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency, database connection, and uptime'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const wsLatency = interaction.client.ws.ping;

    // DB latency
    let dbLatency = null;
    let dbOk = false;
    try {
      const t0 = Date.now();
      await pool.query('SELECT 1');
      dbLatency = Date.now() - t0;
      dbOk = true;
    } catch {}

    const uptimeMs  = Date.now() - START_TIME;
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const d = Math.floor(uptimeSec / 86400);
    const h = Math.floor((uptimeSec % 86400) / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const uptimeStr = [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');

    const dbStatus  = dbOk
      ? `🟢 \`${dbLatency}ms\``
      : '🔴 Unreachable';
    const wsStatus  = wsLatency >= 0
      ? `🟢 \`${wsLatency}ms\``
      : '🟡 Measuring…';

    const color = dbOk ? COLORS.GREEN : COLORS.RED;

    const embed = base(color)
      .setAuthor({ name: 'MI5 Intel Bot — System Check' })
      .setTitle('Pong!')
      .addFields(
        { name: '🌐  Gateway',  value: wsStatus,  inline: true },
        { name: '🗄️  Database', value: dbStatus,  inline: true },
        { name: '⏱️  Uptime',   value: uptimeStr, inline: true },
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
