export const getCurrentTimeTool = {
    type: 'function',
    function: {
        name: 'get_current_time',
        description: 'Obtiene la hora actual del sistema. Útil para saber qué hora es o para calcular cuánto tiempo ha pasado.',
        parameters: {
            type: 'object',
            properties: {
                timezone: {
                    type: 'string',
                    description: 'Zona horaria opcional (ej: "Europe/Madrid", "UTC"). Si no se envía, usa la hora local del servidor.'
                }
            },
            additionalProperties: false
        }
    }
};

export async function executeGetCurrentTime(args: { timezone?: string }): Promise<string> {
    try {
        const date = new Date();
        if (args.timezone) {
            return date.toLocaleString('es-ES', { timeZone: args.timezone });
        }
        return date.toLocaleString('es-ES');
    } catch (e: any) {
        return `Error al obtener la hora: ${e.message}`;
    }
}
