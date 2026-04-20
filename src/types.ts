import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  UserSelectMenuInteraction,
  Collection,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ButtonHandler {
  customIdPrefix: string;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface SelectMenuHandler {
  customIdPrefix: string;
  execute: (interaction: UserSelectMenuInteraction) => Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void>;
}

export interface BotModule {
  name: string;
  commands?: Command[];
  buttons?: ButtonHandler[];
  selectMenus?: SelectMenuHandler[];
  events?: BotEvent[];
}

export interface ExtendedClient {
  commands: Collection<string, Command>;
  buttons: Collection<string, ButtonHandler>;
  selectMenus: Collection<string, SelectMenuHandler>;
}
