import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, Partials, Interaction } from 'discord.js';
import { Command, ButtonHandler, SelectMenuHandler } from './types';
import { loadModules } from './loader';
import { startWebServer } from './web/server';

const client = Object.assign(
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  }),
  {
    commands: new Collection<string, Command>(),
    buttons: new Collection<string, ButtonHandler>(),
    selectMenus: new Collection<string, SelectMenuHandler>(),
  }
);

loadModules(client);

client.once(Events.ClientReady, (c) => {
  console.log(`[GlitchBot] Ready — logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(`[autocomplete:${interaction.commandName}]`, err);
    }
    return;
  }

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

  else if (interaction.isUserSelectMenu()) {
    const prefix = interaction.customId.split('_').slice(0, 2).join('_');
    const handler = client.selectMenus.get(prefix);
    if (!handler) return;
    try {
      await handler.execute(interaction);
    } catch (err) {
      console.error(`[selectMenu:${interaction.customId}]`, err);
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
startWebServer(parseInt(process.env.PORT ?? '3003', 10));
