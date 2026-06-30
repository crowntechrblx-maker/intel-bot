require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { initBotSchema } = require('./db');

const START_TIME = Date.now();

const PORT = process.env.PORT || 3001;
http.createServer((req, res) => {
  if (req.url === '/status' || req.url === '/') {
    const uptimeMs = Date.now() - START_TIME;
    const uptimeStr = formatUptime(uptimeMs);
    const botReady  = client?.isReady?.() ?? false;
    const botTag    = botReady ? client.user.tag : 'Connecting…';
    const guilds    = botReady ? client.guilds.cache.size : 0;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(statusPage({ botTag, botReady, uptimeStr, guilds }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT);

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

function statusPage({ botTag, botReady, uptimeStr, guilds }) {
  const dot   = botReady ? '#57f287' : '#ed4245';
  const label = botReady ? 'ONLINE' : 'OFFLINE';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>MI5 Intel Bot — Status</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px 48px;max-width:480px;width:100%;text-align:center}
  .badge{display:inline-flex;align-items:center;gap:8px;background:#21262d;border:1px solid #30363d;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:600;letter-spacing:.05em;margin-bottom:32px}
  .dot{width:9px;height:9px;border-radius:50%;background:${dot};box-shadow:0 0 8px ${dot}}
  h1{font-size:22px;font-weight:700;margin-bottom:6px;letter-spacing:.02em}
  .sub{color:#8b949e;font-size:13px;margin-bottom:32px}
  .stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left}
  .stat{background:#21262d;border:1px solid #30363d;border-radius:8px;padding:14px 18px}
  .stat-val{font-size:20px;font-weight:700;font-family:monospace}
  .stat-lbl{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.07em;margin-top:3px}
  .footer{margin-top:28px;font-size:11px;color:#484f58}
</style>
</head>
<body>
<div class="card">
  <div class="badge"><span class="dot"></span>${label}</div>
  <h1>MI5 Intel Bot</h1>
  <p class="sub">${botTag}</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-val">${uptimeStr}</div>
      <div class="stat-lbl">Uptime</div>
    </div>
    <div class="stat">
      <div class="stat-val">${guilds}</div>
      <div class="stat-lbl">Servers</div>
    </div>
  </div>
  <div class="footer">Auto-refreshes every 30s &nbsp;·&nbsp; ${new Date().toUTCString()}</div>
</div>
</body>
</html>`;
}
const reportCommand = require('./commands/report');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// Load all command files
const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

client.once('ready', async () => {
  console.log(`[intel-bot] Logged in as ${client.user.tag}`);
  await initBotSchema();
  console.log('[intel-bot] DB schema ready');

  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Listening to encrypted channels', type: 2 }], // 2 = Listening
  });
});

client.on('interactionCreate', async interaction => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[${interaction.commandName}]`, err);
      const msg = { content: 'An error occurred while executing that command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId === reportCommand.MODAL_ID) {
      try {
        await reportCommand.handleModal(interaction);
      } catch (err) {
        console.error('[report modal]', err);
        const msg = { content: 'Failed to submit report.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
