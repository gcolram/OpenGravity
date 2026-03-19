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

// Helper: obtiene la página actual del contexto del navegador
async function getCurrentPage(stagehand: any) {
    const pages = stagehand.context.pages();
    if (pages.length > 0) return pages[0];
    return await stagehand.context.newPage();
}

export async function executeBrowserAutomation(userId: number, args: { action: string, target: string }): Promise<string> {
    console.log(`[Browser] Acción: ${args.action}, target: ${args.target?.substring(0, 80)}...`);

    if (args.action === 'close') {
        await closeBrowserSession(userId);
        return 'Navegador cerrado con éxito. La memoria RAM ha sido liberada.';
    }

    try {
        const stagehand = await getBrowserSession(userId);

        if (args.action === 'goto') {
            const page = await getCurrentPage(stagehand);
            await page.goto(args.target, { waitUntil: 'load', timeout: 30000 });
            // Esperar un momento extra para que el JS termine de renderizar
            await page.waitForTimeout(2000);
            const pageTitle = await page.title();
            console.log(`[Browser] ✅ Navegado a: "${pageTitle}"`);
            return `Navegación exitosa a ${args.target}. Título de la página: "${pageTitle}". Ahora usa 'extract' con las instrucciones de qué datos leer, o 'observe' para ver los botones disponibles.`;
        }

        else if (args.action === 'act') {
            console.log(`[Browser] Ejecutando act: "${args.target}"`);
            const result = await stagehand.act(args.target);
            console.log(`[Browser] ✅ Act result:`, JSON.stringify(result).substring(0, 200));
            return `Acción ejecutada: "${args.target}". Resultado: ${JSON.stringify(result)}\n\n(Puedes encadenar más acciones o usar 'extract'/'observe' para ver la pantalla).`;
        }

        else if (args.action === 'extract') {
            console.log(`[Browser] Intentando extract con Stagehand: "${args.target}"`);

            // 1. Intentar con Stagehand AI extract
            try {
                const result = await stagehand.extract(args.target);
                console.log(`[Browser] ✅ Extract OK:`, JSON.stringify(result).substring(0, 200));
                return `Resultados de extracción web: ${JSON.stringify(result)}`;
            } catch (extractErr: any) {
                console.warn(`[Browser] ⚠️ Stagehand extract falló: ${extractErr.message}. Usando fallback Playwright...`);

                // 2. FALLBACK: Leer texto plano de la página con Playwright
                const page = await getCurrentPage(stagehand);
                const rawText = await page.evaluate(() => {
                    // Eliminar scripts, styles, headers y footers; quedarnos con el contenido principal
                    const elements = document.querySelectorAll('p, h1, h2, h3, li, td, th');
                    return Array.from(elements)
                        .map(el => el.textContent?.trim())
                        .filter(t => t && t.length > 10)
                        .slice(0, 60) // Máximo 60 párrafos para no saturar el contexto
                        .join('\n');
                });

                console.log(`[Browser] ✅ Fallback Playwright OK, ${rawText.length} chars de texto`);
                return `Contenido de la página actual (texto extraído via Playwright):\n\n${rawText.substring(0, 8000)}\n\n[Nota: extracción en modo texto plano, úsala para responder la pregunta del usuario]`;
            }
        }

        else if (args.action === 'observe') {
            let instruction = args.target;
            if (!instruction || instruction.length < 2) instruction = 'find all interactive elements (links, inputs, buttons)';
            console.log(`[Browser] Observando: "${instruction}"`);

            try {
                const result = await stagehand.observe(instruction);
                console.log(`[Browser] ✅ Observe OK: ${result?.length} elementos`);
                return `Elementos disponibles en pantalla: ${JSON.stringify(result)}`;
            } catch (observeErr: any) {
                console.warn(`[Browser] ⚠️ Observe falló: ${observeErr.message}. Usando fallback Playwright links...`);
                // Fallback: listar los links y botones con Playwright puro
                const page = await getCurrentPage(stagehand);
                const links = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href], button, input[type=submit]'))
                        .slice(0, 30)
                        .map(el => ({
                            tag: el.tagName,
                            text: el.textContent?.trim().substring(0, 60),
                            href: (el as HTMLAnchorElement).href || ''
                        }));
                });
                return `Elementos interactivos en la página: ${JSON.stringify(links)}`;
            }
        }

        return 'Acción web desconocida u orden malformada.';
    } catch (e: any) {
        console.error(`[Browser] ❌ Error crítico en acción ${args.action}:`, e.message);
        console.error(e.stack?.split('\n').slice(0, 4).join('\n'));
        return `Error controlando el navegador: ${e.message}\nConsidera usar "close" para reiniciar el navegador y luego intentarlo de nuevo.`;
    }
}
