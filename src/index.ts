import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { Command, ButtonHandler } from './types';
import { loadModules } from './loader';

const client = Object.assign(
  new Client({ intents: [GatewayIntentBits.Guilds] }),
  {
    commands: new Collection<string, Command>(),
    buttons: new Collection<string, ButtonHandler>(),
  }
);

loadModules(client);

client.once(Events.ClientReady, (c) => {
  console.log(`[GlitchBot] Ready — logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[command:${interaction.commandName}]`, err);
      const msg = { content: 'Something went wrong.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  }

  else if (interaction.isButton()) {
    const prefix = interaction.customId.split('_').slice(0, 2).join('_');
    const handler = client.buttons.get(prefix);
    if (!handler) return;
    try {
      await handler.execute(interaction);
    } catch (err) {
      console.error(`[button:${interaction.customId}]`, err);
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
