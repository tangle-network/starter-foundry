import { startChatStepRunner } from './chat-step-runner';
import { wireTools } from './tools';
import { agentLoop } from './agent-loop';

const main = async () => {
  await wireTools();
  await agentLoop();
  await startChatStepRunner();
};

main();