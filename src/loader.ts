import { Client, Collection } from 'discord.js';
import { Command, ButtonHandler, SelectMenuHandler, BotModule } from './types';

// Register modules here — adding a new cog is just importing and adding to this array
import schedulingModule from './modules/scheduling';
import helpModule from './modules/help';
import gameWheelModule from './modules/gamewheel';
import starboardModule from './modules/starboard';
import loggingModule from './modules/logging';

const modules: BotModule[] = [
  schedulingModule,
  helpModule,
  gameWheelModule,
  starboardModule,
  loggingModule,
  // voiceRoleModule,
  // audioModule,
];

export function loadModules(client: Client & { commands: Collection<string, Command>; buttons: Collection<string, ButtonHandler>; selectMenus: Collection<string, SelectMenuHandler> }) {
  for (const mod of modules) {
    for (const cmd of mod.commands ?? []) {
      client.commands.set(cmd.data.name, cmd);
    }
    for (const btn of mod.buttons ?? []) {
      client.buttons.set(btn.customIdPrefix, btn);
    }
    for (const menu of mod.selectMenus ?? []) {
      client.selectMenus.set(menu.customIdPrefix, menu);
    }
    for (const event of mod.events ?? []) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
    }
    console.log(`[loader] Loaded module: ${mod.name}`);
  }
}

export function getCommandData() {
  return modules.flatMap((m) => m.commands?.map((c) => c.data.toJSON()) ?? []);
}
