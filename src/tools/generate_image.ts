import { config } from '../config.js';
import OpenAI from 'openai';

export const generateImageTool = {
    type: 'function',
    function: {
        name: 'generate_image',
        description: 'Genera una imagen a partir de una descripción detallada en texto. Útil cuando el usuario te solicita crear, dibujar o visualizar algo.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Descripción detallada en inglés de la imagen que quieres generar. Debe ser muy específica y descriptiva.'
                }
            },
            required: ['prompt'],
            additionalProperties: false
        }
    }
};

export async function executeGenerateImage(args: { prompt: string }): Promise<string> {
    try {
        const encodedPrompt = encodeURIComponent(args.prompt);
        const randomSeed = Math.floor(Math.random() * 1000000);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024`;

        // Probar Pollinations con timeout para evitar fallos de Telegram (IMAGE_PROCESS_FAILED)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seg de espera

        const testRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const contentType = testRes.headers.get('content-type') || '';
        if (testRes.ok && contentType.includes('image')) {
            return `¡ÉXITO! La imagen se ha generado gratuitamente. Informa de esto al usuario y adjunta esta URL usando exclusivamente el siguiente tag especial: [IMAGE: ${url}]`;
        } else {
            throw new Error(`Invalid content-type from Pollinations: ${contentType}`);
        }
    } catch (e: any) {
        console.warn(`[Generación Gratuita] Falló (${e.message}). Intentando fallback con DALL-E 3 Premiun...`);

        if (config.OPENAI_API_KEY) {
            try {
                const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
                const response = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: args.prompt.substring(0, 1000), // DALL-E tiene limite de prompt
                    n: 1,
                    size: "1024x1024",
                });
                const openaiUrl = response.data?.[0]?.url;
                if (!openaiUrl) throw new Error("OpenAI no devolvió una URL válida");
                return `¡ÉXITO! La imagen Premium se ha generado con DALL-E 3. Informa al usuario y adjunta la URL usando exclusivamente el tag especial: [IMAGE: ${openaiUrl}]`;
            } catch (openaiErr: any) {
                console.error("[DALL-E Fallback Error]", openaiErr.message);
                return `FATAL ERROR: API DALL-E FAIL. DO NOT RETRY THIS TOOL. Inform the user in plain text that image generation servers are completely down. (${openaiErr.message})`;
            }
        }

        return `FATAL ERROR: NO SERVERS. DO NOT RETRY THIS TOOL. Inform the user that the free server is down and there is no backup API key.`;
    }
}
