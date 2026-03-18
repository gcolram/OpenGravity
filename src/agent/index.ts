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
const openaiDirect = config.OPENAI_API_KEY ? new OpenAI({
    apiKey: config.OPENAI_API_KEY,
}) : null;

if (!groq && !openrouter && !openaiDirect) {
    throw new Error('No LLM client configured. Please set GROQ_API_KEY, OPENROUTER_API_KEY or OPENAI_API_KEY in .env');
}

const SYSTEM_PROMPT = `Eres OpenGravity, un asistente de inteligencia artificial personal seguro y útil, que funciona localmente a través de Telegram.
Responde de manera concisa y útil. Utiliza las herramientas disponibles de forma proactiva cuando te soliciten información que requiera una de ellas (por ejemplo, obtener la hora actual).
Debes comunicarte y pensar siempre en ESPAÑOL.`;

// Cliente activo principal a utilizar
const client = (groq || openrouter || openaiDirect) as any;
const modelName = groq ? 'llama-3.3-70b-versatile' : (openrouter ? config.OPENROUTER_MODEL : 'gpt-4o-mini');

export async function processUserMessage(userId: number, text: string, imageUrl?: string): Promise<string> {
    const userMessageContent: any = imageUrl
        ? [
            { type: "text", text: text || "Por favor, describe esta imagen." },
            { type: "image_url", image_url: { url: imageUrl } }
        ]
        : text;

    // 1. Guardar el mensaje del usuario en la base de datos persistente
    await addMessage(userId, 'user', userMessageContent);

    // 2. Obtener el historial conversacional
    const history = await getHistory(userId, 15);

    // 3. Preparar el array de mensajes en memoria para este bucle de razonamiento
    let activeClient = client;
    let activeModel = modelName;

    if (imageUrl) {
        if (openrouter) {
            activeClient = openrouter;
            activeModel = 'google/gemini-2.5-flash';
        } else if (groq) {
            throw new Error("Groq ha desactivado temporalmente sus modelos de visión. Por favor, configura tu OPENROUTER_API_KEY en el archivo .env para poder enviar imágenes al bot.");
        }
    }

    const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((msg: ChatMessage) => {
            let contentContent = msg.content;
            // Si el mensaje del historial tiene un array (imagen) y estamos usando un modelo que quizás no sea de visión, extraemos solo el texto
            if (Array.isArray(contentContent) && !imageUrl) {
                const textObj = contentContent.find(c => c.type === 'text');
                contentContent = textObj ? textObj.text : '[Imagen enviada previamente]';
            }
            return {
                role: msg.role,
                content: contentContent,
            };
        })
    ];

    const maxIterations = 5;
    let iterations = 0;

    while (iterations < maxIterations) {
        iterations++;

        try {
            // Llamada al LLM con Fallback a OpenAI si falla
            let completion;
            try {
                completion = await activeClient.chat.completions.create({
                    messages,
                    model: activeModel,
                    tools: tools as any[],
                    tool_choice: 'auto',
                });
            } catch (primaryError: any) {
                // FALLBACK KEY: Si la petición falla (ej. cuotas de OpenRouter, modelo no soportado) y hay clave de OpenAI
                if (openaiDirect && activeClient !== openaiDirect) {
                    console.warn(`[Agente] Falló el modelo primario (${primaryError.message}). Ejecutando fallback mágico de seguridad con OpenAI (gpt-4o-mini)...`);
                    completion = await openaiDirect.chat.completions.create({
                        messages,
                        model: 'gpt-4o-mini',
                        tools: tools as any[],
                        tool_choice: 'auto',
                    });
                } else {
                    throw primaryError; // Relanzar si no hay fallback disponible
                }
            }

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

            // Intentar recuperar de errores 400 causados por mala sintaxis de llamadas a herramientas (ej. <function=...>)
            if (error.status === 400 && error.error?.code === 'tool_use_failed') {
                const failedGen = error.error?.failed_generation;
                if (typeof failedGen === 'string') {
                    console.log("[Agente] Intentando recuperar llamada a herramienta fallida...");
                    const match = failedGen.match(/<function=([\w_]+).*?({.*?}).*?><\/function>/);

                    if (match) {
                        const functionName = match[1];
                        try {
                            // Limpiar escapes extras en el JSON
                            const jsonStr = match[2].replace(/\\"/g, '"');
                            const functionArgs = JSON.parse(jsonStr);
                            console.log(`[Agente] Recuperada llamada a ${functionName}:`, functionArgs);

                            const toolResult = await executeTool(functionName, functionArgs);

                            // Añadimos la generación fallida y el resultado de la función para continuar
                            messages.push({
                                role: 'assistant',
                                content: failedGen
                            });
                            messages.push({
                                role: 'system',
                                content: `La función ${functionName} fue ejecutada con éxito. Su resultado es: ${toolResult}\nContinúa respondiendo de forma natural.`
                            });

                            continue; // Reintentar la siguiente iteración
                        } catch (e) {
                            console.error("Error al parsear o ejecutar la herramienta recuperada:", e);
                        }
                    } else if (failedGen.includes('<function')) {
                        console.log("[Agente] Match regex fallido para tool call manual, solicitando reintentar...");
                        messages.push({
                            role: 'assistant',
                            content: failedGen
                        });
                        messages.push({
                            role: 'system',
                            content: "ERROR AL LLAMAR A LA HERRAMIENTA: Formato incorrecto. Por favor, asegúrate de NO usar tags <function>. Reintenta."
                        });
                        continue;
                    }
                }
            }

            return `Ocurrió un error en mi procesamiento interno: ${error.message}`;
        }
    }

    return "He alcanzado el límite máximo de reflexión y llamadas a herramientas (5 iteraciones). Abortando para evitar bucles infinitos.";
}
