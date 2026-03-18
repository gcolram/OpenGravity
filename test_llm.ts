import { processUserMessage } from './src/agent/index.js';
console.log("Testing LLM call...");
processUserMessage(12345, "Abre google y dime qué ves").then(console.log).catch(console.error);
