import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { config } from '../config.js';
import { addMessage, getHistory, ChatMessage } from '../memory/db.js';
import { tools, executeTool } from '../tools/index.js';

const groq = config.GROQ_API_KEY ? new Groq({ apiKey: config.GROQ_API_KEY }) : null;
const openrouter = config.OPENROUTER_API_KEY ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.OPENROUTER_API_KEY,
}) : null;

if (!groq && !openrouter) {
    throw new Error('No LLM client configured. Please set GROQ_API_KEY or OPENROUTER_API_KEY in .env');
}

const SYSTEM_PROMPT = `Eres OpenGravity, un asistente de inteligencia artificial personal seguro y útil, que funciona localmente a través de Telegram.
Responde de manera concisa y útil. Utiliza las herramientas disponibles de forma proactiva cuando te soliciten información que requiera una de ellas (por ejemplo, obtener la hora actual).
Debes comunicarte y pensar siempre en ESPAÑOL.`;

// Cliente activo a utilizar
const client = (groq || openrouter) as any;
const modelName = groq ? 'llama-3.3-70b-versatile' : config.OPENROUTER_MODEL;

export async function processUserMessage(userId: number, text: string): Promise<string> {
    // 1. Guardar el mensaje del usuario en la base de datos persistente
    await addMessage(userId, 'user', text);

    // 2. Obtener el historial conversacional
    const history = await getHistory(userId, 15);

    // 3. Preparar el array de mensajes en memoria para este bucle de razonamiento
    const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((msg: ChatMessage) => ({
            role: msg.role,
            content: msg.content,
        }))
    ];

    const maxIterations = 5;
    let iterations = 0;

    while (iterations < maxIterations) {
        iterations++;

        try {
            // Llamada al LLM
            const completion = await client.chat.completions.create({
                messages,
                model: modelName,
                tools: tools as any[],
                tool_choice: 'auto',
            });

            const responseMessage = completion.choices[0]?.message;
            if (!responseMessage) {
                return "Error: No se recibió respuesta del modelo.";
            }

            // Añadir el mensaje del asistente a la memoria temporal (necesario para la secuencia de llamadas a herramientas)
            messages.push(responseMessage);

            const toolCalls = responseMessage.tool_calls;

            // Si el agente decide usar herramientas
            if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

                    console.log(`[Agente] Ejecutando herramienta ${functionName} con argumentos:`, functionArgs);

                    // Ejecutar herramienta
                    const toolResult = await executeTool(functionName, functionArgs);

                    // Añadir el resultado a la secuencia de mensajes para que el LLM lo lea en la siguiente iteración
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: functionName,
                        content: toolResult,
                    });
                }
                // Continuar bucle para pasar los resultados al LLM
                continue;
            }

            // Si es un mensaje final al usuario
            if (responseMessage.content) {
                // Guardar la respuesta final en la base de datos persistente
                await addMessage(userId, 'assistant', responseMessage.content);
                return responseMessage.content;
            }

        } catch (error: any) {
            console.error("Error en la ejecución del Agente:", error);
            return `Ocurrió un error en mi procesamiento interno: ${error.message}`;
        }
    }

    return "He alcanzado el límite máximo de reflexión y llamadas a herramientas (5 iteraciones). Abortando para evitar bucles infinitos.";
}
