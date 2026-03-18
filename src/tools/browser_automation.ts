import { getBrowserSession, closeBrowserSession } from '../agent/browser.js';

export const browserAutomationTool = {
    type: 'function',
    function: {
        name: 'browser_automation',
        description: 'Navegador Web Autónomo. Usa esto para visitar webs, hacer click en botones, rellenar formularios, leer datos o hacer gestiones complejas por el usuario.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['goto', 'act', 'extract', 'observe', 'close'],
                    description: 'La acción: "goto" (navegar a URL), "act" (hacer click, escribir, interactuar: ej. "fill email with x"), "extract" (leer datos: ej. "coge la lista de precios"), "observe" (ver elementos interactivos), "close" (cerrar navegador).'
                },
                target: {
                    type: 'string',
                    description: 'El objetivo: Una URL válida si es "goto", o una instrucción natural precisa en inglés o español si es "act", "extract" o "observe". Vacio para "close".'
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
            await stagehand.page.goto(args.target);
            return `Navegación exitosa a ${args.target}. La página se ha cargado. Puedes usar 'observe' para ver qué botones hay, o 'act' para interactuar.`;
        }
        else if (args.action === 'act') {
            const result = await stagehand.page.act(args.target);
            return `Acción ejecutada: "${args.target}". Resultado/Feedback de la UI: ${JSON.stringify(result)}\n\n(Puedes encadenar más acciones, o usar 'extract'/'observe' para ver la pantalla).`;
        }
        else if (args.action === 'extract') {
            const result = await stagehand.page.extract(args.target);
            return `Resultados de extracción web: ${JSON.stringify(result)}`;
        }
        else if (args.action === 'observe') {
            let instruction = args.target;
            // Si el user no envia instruction o pone "null", le pasamos el default
            if (!instruction || instruction.length < 2) instruction = "encuentra todos los elementos principales interactivos (links, inputs, botones)";

            const result = await stagehand.page.observe(instruction);
            return `Elementos visualmente disponibles en pantalla listos para interactuar: ${JSON.stringify(result)}`;
        }

        return 'Acción web desconocida u orden malformada.';
    } catch (e: any) {
        return `Error crítico controlando el navegador: ${e.message}\nConsidera usar "observe" para entender mejor la página o "close" si la web te está bloqueando severamente.`;
    }
}
