import { BotModule } from '../../types';
import { command } from './commands/help';

const helpModule: BotModule = {
  name: 'help',
  commands: [command],
};

export default helpModule;
