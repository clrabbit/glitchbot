import { BotModule } from '../../types';
import { command, voteButton, closeButton } from './commands/schedule';

const schedulingModule: BotModule = {
  name: 'scheduling',
  commands: [command],
  buttons: [voteButton, closeButton],
};

export default schedulingModule;
