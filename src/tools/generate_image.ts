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
        // Semilla aleatoria para variar los resultados aunque se use el mismo prompt
        const randomSeed = Math.floor(Math.random() * 1000000);
        // Generar la URL de Pollinations.ai (gratuita, sin key)
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024`;

        return `ÉXITO. La imagen se ha generado y está en este enlace temporal: ${url}
Instrucciones obligatorias para tu próxima respuesta: 
- Informa brevemente al usuario de que su imagen ha sido creada.
- DEBES incluir exactamente esta cadena en alguna parte de tu respuesta de texto: [IMAGE: ${url}] 
El sistema interceptará esa cadena y se la enviará adjunta al usuario.`;
    } catch (e: any) {
        return `Error crítico al generar la imagen: ${e.message}`;
    }
}
