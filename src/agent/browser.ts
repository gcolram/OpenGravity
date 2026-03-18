import { Stagehand } from '@browserbasehq/stagehand';
import { config } from '../config.js';

// Mapa para mantener una sesión de navegador por cada usuario
const activeSessions = new Map<number, Stagehand>();

/**
 * Obtiene o crea una sesión persistente de navegador para el usuario.
 */
export async function getBrowserSession(userId: number): Promise<Stagehand> {
    if (activeSessions.has(userId)) {
        console.log(`[Browser] Reutilizando sesión web para el usuario ${userId}`);
        return activeSessions.get(userId)!;
    }

    console.log(`[Browser] Inicializando nuevo Headless Browser para el usuario ${userId}...`);

    // Stagehand V3 requiere 'model' como ModelConfiguration (puede ser string o {modelName, apiKey})
    if (!config.OPENAI_API_KEY) {
        throw new Error('El Agente Web requiere OPENAI_API_KEY en el .env para usar Stagehand.');
    }

    // Detectar automáticamente si tenemos display (local con ventana) o servidor sin pantalla (VPS headless)
    const isHeadless = process.env.NODE_ENV === 'production' || (!process.env.DISPLAY && process.platform === 'linux');
    console.log(`[Browser] Modo: ${isHeadless ? '🖥️  Headless (Servidor/VPS)' : '🪟 Con ventana (Desarrollo Local)'}`);

    // Usando la API V3 correcta de Stagehand
    const stagehand = new Stagehand({
        env: 'LOCAL',
        model: {
            modelName: 'gpt-4o',
            apiKey: config.OPENAI_API_KEY,
        },
        localBrowserLaunchOptions: {
            headless: isHeadless,
        },
        verbose: 0,
        disablePino: true,
    } as any);

    await stagehand.init();
    activeSessions.set(userId, stagehand);

    console.log(`[Browser] Sesión creada exitosamente para ${userId}`);
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
