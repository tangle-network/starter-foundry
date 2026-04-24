import { Agent } from '@zk-mixer-ui/agent';
import { ToolRegistry } from '@zk-mixer-ui/tool-registry';
import { ChatStepFunction } from '@zk-mixer-ui/chat-step-function';

const agent = new Agent();
const toolRegistry = new ToolRegistry();
const chatStepFunction = new ChatStepFunction();

agent.registerToolRegistry(toolRegistry);
agent.registerChatStepFunction(chatStepFunction);

agent.start();