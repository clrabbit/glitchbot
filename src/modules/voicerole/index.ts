import { BotModule } from '../../types';
import voiceStateUpdateEvent from './events/voiceStateUpdate';
import readyEvent from './events/ready';

const voiceRoleModule: BotModule = {
  name: 'voicerole',
  events: [voiceStateUpdateEvent, readyEvent],
};

export default voiceRoleModule;
