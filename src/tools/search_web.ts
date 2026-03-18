// @ts-ignore
import google from 'googlethis';

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
        const options = {
            page: 0,
            safe: false, // Opcional
            additional_params: {
                hl: 'es' // Resultados en español
            }
        };

        const response = await google.search(args.query, options);

        if (!response.results || response.results.length === 0) {
            return `No se encontraron resultados en internet para "${args.query}".`;
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
        return `Error al buscar en internet: ${e.message}`;
    }
}
