// @ts-ignore
import google from 'googlethis';
import { tavily } from '@tavily/core';
import { config } from '../config.js';

export const searchWebTool = {
    type: 'function',
    function: {
        name: 'search_web',
        description: 'Realiza una búsqueda en internet en tiempo real para obtener información actualizada, noticias, el clima, o datos que desconozcas. Actúa como tu buscador interno.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Términos de búsqueda precisos que introducirías en Google (ej. "noticias tecnología de hoy España", "tiempo en Madrid", "precio Bitcoin").'
                }
            },
            required: ['query'],
            additionalProperties: false
        }
    }
};

export async function executeSearchWeb(args: { query: string }): Promise<string> {
    try {
        if (config.TAVILY_API_KEY) {
            console.log(`[Agente] Buscando en internet vía Tavily AI: "${args.query}"`);
            const tvly = tavily({ apiKey: config.TAVILY_API_KEY });
            const response = await tvly.search(args.query, { searchDepth: "basic", maxResults: 5 });

            if (!response.results || response.results.length === 0) {
                return `No se encontraron resultados en Tavily para "${args.query}". INSTRUCCIÓN DE EMERGENCIA: No busques repetidas veces. Responde al usuario con tus propios conocimientos ahora.`;
            }

            const topResults = response.results.map((r: any, idx: number) => {
                return `${idx + 1}. [${r.title}](${r.url})\n   Contenido: ${r.content}`;
            });

            return `Resultados de búsqueda en vivo (Tavily AI) para "${args.query}":\n\n${topResults.join('\n\n')}\n\nCon esta información, responde al usuario sintetizando los datos.`;
        }

        console.log(`[Agente] Buscando en internet vía Google (fallback gratuito): "${args.query}"`);
        const options = {
            page: 0,
            safe: false, // Opcional
            additional_params: {
                hl: 'es' // Resultados en español
            }
        };

        const response = await google.search(args.query, options);

        if (!response.results || response.results.length === 0) {
            return `No se encontraron resultados en internet para "${args.query}". INSTRUCCIÓN: No busques repetidamente, usa tus conocimientos previos ahora.`;
        }

        // Extraer los 4 primeros resultados
        const topResults = response.results.slice(0, 4).map((r: any, idx: number) => {
            return `${idx + 1}. [${r.title}](${r.url})\n   Resumen: ${r.description}`;
        });

        // Extraer también el knowledge panel o diccionario si Google lo arroja (ej. Clima)
        let extraInfo = '';
        if (response.knowledge_panel && response.knowledge_panel.title) {
            extraInfo += `Dato destacado: ${response.knowledge_panel.title} - ${response.knowledge_panel.description}\n`;
        }
        if (response.dictionary) {
            extraInfo += `Definición: ${response.dictionary.word}\n`;
        }

        return `Resultados de búsqueda en vivo para "${args.query}":\n\n${extraInfo}${topResults.join('\n\n')}\n\nCon esta información, responde al usuario sintetizando los datos. Sírvete de los enlaces si quieres citar fuentes.`;
    } catch (e: any) {
        return `Error crítico al buscar en internet: ${e.message}. INSTRUCCIÓN DE EMERGENCIA: La API de búsqueda está inactiva o dio error. ESTÁ ESTRICTAMENTE PROHIBIDO volver a llamar a la herramienta search_web. Discúlpate y responde usando tus propios conocimientos almacenados.`;
    }
}
