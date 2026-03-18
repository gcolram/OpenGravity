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

    // Stagehand requiere OpenAI (gpt-4o) u Anthropic. Por defecto usa gpt-4o.
    if (!config.OPENAI_API_KEY) {
        throw new Error("El Agente Web requiere OPENAI_API_KEY (DALL-E 3 key) en el .env para usar Stagehand vision y DOM mapping.");
    }

    const stagehand = new Stagehand({
        env: 'LOCAL',
        modelName: 'gpt-4o', // Modelo optimizado para leer pantallas de navegador
        modelClientOptions: { apiKey: config.OPENAI_API_KEY },
    });

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
