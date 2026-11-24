import { renderReplay } from './render.ts';
import { replayScenario } from './scenario.ts';

const result = replayScenario();

console.log(renderReplay(result));
