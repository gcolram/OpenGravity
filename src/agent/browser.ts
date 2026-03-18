import { Stagehand } from '@browserbasehq/stagehand';
import { config } from '../config.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

// Mapa para mantener una sesión de navegador por cada usuario
const activeSessions = new Map<number, Stagehand>();

/**
 * Busca el ejecutable de Chromium instalado por Playwright en Linux.
 * Stagehand V3 usa chrome-launcher, que no conoce las rutas de Playwright.
 */
function findPlaywrightChromiumPath(): string | undefined {
    // Ruta estándar de Playwright en Linux/Mac
    const playwrightBase = path.join(os.homedir(), '.cache', 'ms-playwright');

    try {
        // Busca el ejecutable 'chrome' dentro de los directorios de Playwright
        const result = execSync(
            `find "${playwrightBase}" -name "chrome" -maxdepth 6 -type f 2>/dev/null | head -1`,
            { encoding: 'utf8', timeout: 5000 }
        ).trim();
        if (result && existsSync(result)) {
            console.log(`[Browser] Chromium encontrado en: ${result}`);
            return result;
        }
    } catch {
        // No pasa nada, seguimos sin ruta explícita
    }

    // Fallback: intenta rutas conocidas de Chrome/Chromium del sistema
    const systemPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
    ];
    for (const p of systemPaths) {
        if (existsSync(p)) {
            console.log(`[Browser] Usando Chrome del sistema: ${p}`);
            return p;
        }
    }

    console.warn('[Browser] ⚠️  No se encontró Chromium. Asegúrate de ejecutar: npx playwright install chromium');
    return undefined;
}

/**
 * Obtiene o crea una sesión persistente de navegador para el usuario.
 */
export async function getBrowserSession(userId: number): Promise<Stagehand> {
    if (activeSessions.has(userId)) {
        console.log(`[Browser] Reutilizando sesión web para el usuario ${userId}`);
        return activeSessions.get(userId)!;
    }

    console.log(`[Browser] Inicializando nuevo Headless Browser para el usuario ${userId}...`);

    if (!config.OPENAI_API_KEY) {
        throw new Error('El Agente Web requiere OPENAI_API_KEY en el .env para usar Stagehand.');
    }

    // Detectar automáticamente si estamos en servidor (headless) o desarrollo local (con ventana)
    const isHeadless = process.env.NODE_ENV === 'production' || (!process.env.DISPLAY && process.platform === 'linux');
    console.log(`[Browser] Modo: ${isHeadless ? '🖥️  Headless (Servidor/VPS)' : '🪟 Con ventana (Desarrollo Local)'}`);

    // En Linux, buscar el Chromium de Playwright explícitamente
    const executablePath = process.platform === 'linux' ? findPlaywrightChromiumPath() : undefined;

    // Stagehand V3 API correcta
    const stagehand = new Stagehand({
        env: 'LOCAL',
        model: {
            modelName: 'openai/gpt-4o',   // Formato correcto para V3
            apiKey: config.OPENAI_API_KEY,
        },
        localBrowserLaunchOptions: {
            headless: isHeadless,
            ...(executablePath ? { executablePath } : {}),  // Solo si lo encontramos
        },
        verbose: 0,
        disablePino: true,
    } as any);

    await stagehand.init();
    activeSessions.set(userId, stagehand);

    console.log(`[Browser] ✅ Sesión creada exitosamente para ${userId}`);
    return stagehand;
}

/**
 * Cierra la sesión de navegador del usuario y libera la memoria.
 */
export async function closeBrowserSession(userId: number): Promise<void> {
    if (activeSessions.has(userId)) {
        console.log(`[Browser] Cerrando sesión y liberando RAM para el usuario ${userId}...`);
        const stagehand = activeSessions.get(userId)!;
        await stagehand.close();
        activeSessions.delete(userId);
    }
}
