import { BotModule } from '../../types';
import { command, setWinnerButton, winnerSelectMenu } from './commands/gamewheel';

const gameWheelModule: BotModule = {
  name: 'gamewheel',
  commands: [command],
  buttons: [setWinnerButton],
  selectMenus: [winnerSelectMenu],
};

export default gameWheelModule;
