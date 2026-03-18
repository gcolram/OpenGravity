import { getCurrentTimeTool, executeGetCurrentTime } from './get_current_time.js';
import { generateImageTool, executeGenerateImage } from './generate_image.js';
import { searchWebTool, executeSearchWeb } from './search_web.js';

export const tools = [
    getCurrentTimeTool,
    generateImageTool,
    searchWebTool
];

export async function executeTool(name: string, args: any): Promise<string> {
    switch (name) {
        case 'get_current_time':
            return await executeGetCurrentTime(args);
        case 'generate_image':
            return await executeGenerateImage(args);
        case 'search_web':
            return await executeSearchWeb(args);
        default:
            return `Error: La herramienta '${name}' no existe o no está soportada.`;
    }
}
