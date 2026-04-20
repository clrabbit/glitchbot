import { BotModule } from '../../types';
import messageUpdateEvent from './events/messageUpdate';

const loggingModule: BotModule = {
  name: 'logging',
  events: [messageUpdateEvent],
};

export default loggingModule;
