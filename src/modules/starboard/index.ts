import { BotModule } from '../../types';
import reactionAddEvent from './events/reactionAdd';
import reactionRemoveEvent from './events/reactionRemove';

const starboardModule: BotModule = {
  name: 'starboard',
  events: [reactionAddEvent, reactionRemoveEvent],
};

export default starboardModule;
