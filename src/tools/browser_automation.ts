import { getBrowserSession, closeBrowserSession } from '../agent/browser.js';

export const browserAutomationTool = {
    type: 'function',
    function: {
        name: 'browser_automation',
        description: 'Abre un navegador real (Chrome) y controla páginas web. USA ESTA HERRAMIENTA SIEMPRE que el usuario pida: navegar a una URL concreta, hacer login, rellenar formularios, hacer clicks en botones, extraer datos de una web específica, o realizar gestiones en portales de internet. Es tu principal herramienta de acción en internet, no search_web.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['goto', 'act', 'extract', 'observe', 'close'],
                    description: '"goto": ir a URL. "act": hacer click/escribir (ej: "click on the login button", "fill email with user@email.com"). "extract": leer datos de la pantalla. "observe": ver qué elementos interactivos hay disponibles. "close": cerrar y liberar RAM.'
                },
                target: {
                    type: 'string',
                    description: 'URL completa si es "goto" (ej: https://www.adeslas.es). Instrucción en inglés concreta si es "act"/"extract"/"observe" (ej: "click on Acceso pacientes button"). Dejar en blanco para "close".'
                }
            },
            required: ['action', 'target'],
            additionalProperties: false
        }
    }
};

export async function executeBrowserAutomation(userId: number, args: { action: string, target: string }): Promise<string> {
    if (args.action === 'close') {
        await closeBrowserSession(userId);
        return 'Navegador cerrado con éxito. La memoria RAM ha sido liberada.';
    }

    try {
        const stagehand = await getBrowserSession(userId);

        if (args.action === 'goto') {
            // Usar el contexto de Playwright directamente para la navegación
            const pages = stagehand.context.pages();
            const page = pages.length > 0 ? pages[0] : await stagehand.context.newPage();
            await page.goto(args.target, { waitUntil: 'networkidle', timeoutMs: 30000 });
            const pageTitle = await page.title();
            return `Navegación exitosa a ${args.target}. Título de la página: "${pageTitle}". Usa 'observe' para ver qué botones/links hay, o 'act' para interactuar directamente.`;
        }
        else if (args.action === 'act') {
            const result = await stagehand.act(args.target);
            return `Acción ejecutada: "${args.target}". Resultado: ${JSON.stringify(result)}\n\n(Puedes encadenar más acciones o usar 'extract'/'observe' para ver la pantalla).`;
        }
        else if (args.action === 'extract') {
            const result = await stagehand.extract(args.target);
            return `Resultados de extracción web: ${JSON.stringify(result)}`;
        }
        else if (args.action === 'observe') {
            let instruction = args.target;
            if (!instruction || instruction.length < 2) instruction = 'find all interactive elements (links, inputs, buttons)';
            const result = await stagehand.observe(instruction);
            return `Elementos disponibles en pantalla: ${JSON.stringify(result)}`;
        }

        return 'Acción web desconocida u orden malformada.';
    } catch (e: any) {
        return `Error controlando el navegador: ${e.message}\nConsidera usar "observe" para entender mejor la página o "close" para reiniciar el navegador.`;
    }
}
