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
const SYSTEM_PROMPT = () => `Eres OpenGravity, un asistente de inteligencia artificial personal seguro y útil, que funciona localmente a través de Telegram.
La fecha y hora de tu sistema operativo actual es: ${new Date().toLocaleString('es-ES')}.
Responde de manera concisa y útil. TIENES ACCESO A INTERNET REAL Y A UN NAVEGADOR AUTÓNOMO DE VERDAD.

CAPACIDADES DEL NAVEGADOR (WEB AGENT):
- Usando la herramienta 'browser_automation', puedes navegar por webs reales como lo haría un ser humano.
- La sesión de navegador se mantiene VIVA entre tus respuestas. Típico flujo de varios pasos:
  Paso 1: browser_automation({ action: "goto", target: "url" }) -> la web carga.
  Paso 2: browser_automation({ action: "act", target: "click en X" }) -> haces click.
  Paso 3: browser_automation({ action: "extract", target: "dame los resultados" }) -> lees los datos.
- PERMISOS: Si el trámite implica compras, pago, o envío definitivo, DEBES pausar y preguntar al usuario "¿Me autorizas a enviar?". NO uses la herramienta hasta que el usuario confirme.
- ACABANDO: Una vez terminado, usa { action: "close" } para liberar RAM.

REGLAS ABSOLUTAS E IRREVOCABLES:
0. SI EL USUARIO TE PIDE ENTRAR A UNA WEB, NAVEGAR, BUSCAR EN UNA PÁGINA CONCRETA O HACER CLICK EN ALGO: TIENES ABSOLUTAMENTE PROHIBIDO RESPONDER SIN USAR PRIMERO browser_automation. DA IGUAL LO QUE SEA LA WEB, DA IGUAL SI ES COMPLEJA. INTENTA SIEMPRE.
1. PREGUNTAS SOBRE NOTICIAS/DATOS ACTUALES: Usa 'search_web' SIEMPRE.
2. Debes comunicarte y pensar siempre en ESPAÑOL.`;

// Cliente activo principal a utilizar
const client = (groq || openrouter || openaiDirect) as any;
const modelName = groq ? 'llama-3.3-70b-versatile' : (openrouter ? config.OPENROUTER_MODEL : 'gpt-4o');

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
        { role: 'system', content: SYSTEM_PROMPT() },
        ...history.map((msg: ChatMessage) => {
            let contentContent: any = msg.content;
            // Si el mensaje del historial tiene un array (imagen) y estamos usando un modelo que quizás no sea de visión, extraemos solo el texto
            if (Array.isArray(contentContent) && !imageUrl) {
                const textObj = contentContent.find((c: any) => c.type === 'text');
                contentContent = textObj ? textObj.text : '[Imagen enviada previamente]';
            }
            // Evitar null content que crashea a Groq. Los mensajes 'tool' con null se marcan vacíos.
            if (contentContent === null || contentContent === undefined) {
                contentContent = '';
            }
            return {
                role: msg.role,
                content: contentContent,
            };
        })
    ];

    const maxIterations = 8;
    let iterations = 0;
    let primaryErrorLog = false; // Flag para no spamear console.warn en bucles de herramientas
    let stickyFallback = false; // Si Groq falla por cuota, remainá en OpenAI todo el bucle

    while (iterations < maxIterations) {
        iterations++;

        try {
            // Llamada al LLM con Fallback a OpenAI si falla
            let completion;
            try {
                // Si el modelo primario ya falló antes (cuota, etc.), saltar directo al fallback
                if (stickyFallback && openaiDirect) {
                    throw new Error('Sticky fallback activo');
                }

                completion = await activeClient.chat.completions.create({
                    messages,
                    model: activeModel,
                    tools: tools as any[],
                    tool_choice: 'auto',
                });
            } catch (primaryError: any) {
                // FALLBACK KEY: Si la petición falla (ej. cuotas de OpenRouter, modelo no soportado) y hay clave de OpenAI
                if (openaiDirect && activeClient !== openaiDirect) {
                    if (!primaryErrorLog) {
                        console.warn(`[Agente] Falló el modelo primario (${primaryError.message}). Ejecutando fallback mágico de seguridad con OpenAI (gpt-4o-mini)...`);
                        primaryErrorLog = true;
                        stickyFallback = true; // Activar el modo pegajoso: usar OpenAI el resto del bucle
                    }
                    completion = await openaiDirect.chat.completions.create({
                        messages,
                        model: 'gpt-4o', // Modelo completo, mejor para razonar con herramientas
                        tools: tools as any[],
                        tool_choice: 'auto',
                    });
                } else {
                    throw primaryError; // Relanzar si no hay fallback disponible
                }
            }

            // DEBUG
            if (activeClient !== openaiDirect || primaryErrorLog) primaryErrorLog = false; // Reset log flag if needed

            const responseMessage = completion.choices[0]?.message;
            if (!responseMessage) {
                return "Error: No se recibió respuesta del modelo.";
            }

            // Añadir el mensaje del asistente a la memoria temporal, SANITIZADO para evitar cuelgues (ej. content null)
            const safeMessage: any = { role: responseMessage.role, content: responseMessage.content || "" };
            if (responseMessage.tool_calls) safeMessage.tool_calls = responseMessage.tool_calls;
            messages.push(safeMessage);

            const toolCalls = responseMessage.tool_calls;

            // Si el agente decide usar herramientas
            if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

                    console.log(`[Agente] Ejecutando herramienta ${functionName} con argumentos:`, functionArgs);

                    // Ejecutar herramienta
                    const toolResult = await executeTool(userId, functionName, functionArgs);

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

                            const toolResult = await executeTool(userId, functionName, functionArgs);

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

            const errorMsg = `Ocurrió un error en mi procesamiento interno: ${error.message}`;
            await addMessage(userId, 'assistant', errorMsg);
            return errorMsg;
        }
    }

    const abortMsg = "He alcanzado el límite máximo de reflexión y llamadas a herramientas (8 iteraciones). Abortando para evitar bucles infinitos.";
    await addMessage(userId, 'assistant', abortMsg);
    return abortMsg;
}
