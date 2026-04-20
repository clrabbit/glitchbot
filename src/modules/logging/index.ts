import { BotModule } from '../../types';
import messageUpdateEvent from './events/messageUpdate';
import { command } from './commands/logging';

const loggingModule: BotModule = {
  name: 'logging',
  commands: [command],
  events: [messageUpdateEvent],
};

export default loggingModule;
