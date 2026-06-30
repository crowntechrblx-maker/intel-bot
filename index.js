require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { initBotSchema } = require('./db');
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
