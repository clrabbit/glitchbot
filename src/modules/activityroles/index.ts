import { BotModule } from '../../types';
import { colorCommand } from './commands/color';
import voiceStateUpdateEvent from './events/voiceStateUpdate';
import messageCreateEvent from './events/messageCreate';
import presenceUpdateEvent from './events/presenceUpdate';
import readyEvent from './events/ready';

const activityRolesModule: BotModule = {
  name: 'activityroles',
  commands: [colorCommand],
  events: [voiceStateUpdateEvent, messageCreateEvent, presenceUpdateEvent, readyEvent],
};

export default activityRolesModule;
