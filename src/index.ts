import { Bot } from 'grammy';
import { config } from './config.js';
import { processUserMessage } from './agent/index.js';

// Inicializar el bot con el token
const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Middleware de seguridad: Lista Blanca (Whitelist)
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
        console.warn(`[Seguridad] Ingreso denegado: el usuario ${userId} no está en la lista blanca.`);
        // Se puede omitir la respuesta para pasar totalmente desapercibido,
        // pero responder 'Acceso denegado' da feedback inicial si configuras mal tu ID.
        await ctx.reply("Acceso denegado. Este es un agente privado.");
        return;
    }

    // Si el usuario está autorizado, continuar con la ejecución normal
    await next();
});

// Comando /start
bot.command('start', async (ctx) => {
    await ctx.reply("¡Hola! Soy OpenGravity, tu asistente personal local de IA basado en Telegram.\n¿En qué puedo ayudarte hoy?");
});

// Manejador principal de mensajes de texto
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Enviar indicador de 'escribiendo' para mejor experiencia de usuario
    try {
        await ctx.replyWithChatAction('typing');
    } catch (e) {
        // Silenciar error si falla el chat action
    }

    try {
        console.log(`[User:${userId}] ${text}`);

        // Llamar a nuestro motor de IA
        const response = await processUserMessage(userId, text);

        console.log(`[OpenGravity] ${response}`);
        await ctx.reply(response);
    } catch (error: any) {
        console.error("Error Processing Message:", error);
        await ctx.reply(`Ocurrió un error en el sistema: ${error.message || 'Error desconocido'}`);
    }
});

// Manejo elegante de errores del bot
bot.catch((err) => {
    console.error(`Error crítico en el bot:`, err);
});

// Iniciar el bot usando long polling (sin servidor web)
console.log('[🚀] Iniciando OpenGravity...');
bot.start({
    onStart: (botInfo) => {
        console.log(`[🤖] OpenGravity operando exitosamente como @${botInfo.username}`);
        console.log(`[🔒] Control de acceso activado. IDS permitidos: ${config.TELEGRAM_ALLOWED_USER_IDS.join(', ')}`);
        console.log(`[🧠] LLM configurado y listo para recibir mensajes.`);
    }
});
