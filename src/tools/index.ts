import { getCurrentTimeTool, executeGetCurrentTime } from './get_current_time.js';

export const tools = [
    getCurrentTimeTool
];

export async function executeTool(name: string, args: any): Promise<string> {
    switch (name) {
        case 'get_current_time':
            return await executeGetCurrentTime(args);
        default:
            return `Error: La herramienta '${name}' no existe o no está soportada.`;
    }
}
