import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getCommandData } from '../src/loader';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID;

const rest = new REST().setToken(token);
const commands = getCommandData();

(async () => {
  console.log(`Deploying ${commands.length} command(s)...`);
  if (guildId) {
    // Guild deploy — instant, use during dev
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Deployed to guild ${guildId}`);
  } else {
    // Global deploy — up to 1 hour to propagate
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Deployed globally');
  }
})();
