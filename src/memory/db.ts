import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { resolve } from 'path';

// Inicializar la aplicación de Firebase con el service-account
const serviceAccountPath = resolve(process.cwd(), config.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json');

try {
    initializeApp({
        credential: cert(serviceAccountPath)
    });
} catch (error: any) {
    console.error(`❌ Error inicializando Firebase Admin SDK. Asegúrate de que el archivo '${serviceAccountPath}' es válido.`);
    throw error;
}

const db = getFirestore();

export interface ChatMessage {
    id?: string;
    user_id: number;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp?: any;
}

/**
 * Añade un nuevo mensaje al historial de conversación en Firestore.
 */
export const addMessage = async (userId: number, role: ChatMessage['role'], content: string): Promise<void> => {
    try {
        const messagesRef = db.collection('users').doc(userId.toString()).collection('messages');

        await messagesRef.add({
            user_id: userId,
            role,
            content,
            timestamp: FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error guardando mensaje en Firestore:", error);
    }
};

/**
 * Obtiene el historial reciente para un usuario desde Firestore.
 */
export const getHistory = async (userId: number, limitCount: number = 30): Promise<ChatMessage[]> => {
    try {
        const messagesRef = db.collection('users').doc(userId.toString()).collection('messages');

        const snapshot = await messagesRef
            .orderBy('timestamp', 'desc')
            .limit(limitCount)
            .get();

        if (snapshot.empty) {
            return [];
        }

        const messages: ChatMessage[] = [];
        snapshot.forEach(doc => {
            const data = doc.data() as ChatMessage;
            messages.push({
                ...data,
                id: doc.id
            });
        });

        return messages.reverse();
    } catch (error) {
        console.error("Error obteniendo el historial de Firestore:", error);
        return [];
    }
};

/**
 * Limpia el historial de un usuario en Firestore.
 */
export const clearHistory = async (userId: number): Promise<void> => {
    try {
        const messagesRef = db.collection('users').doc(userId.toString()).collection('messages');
        const snapshot = await messagesRef.get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Historial borrado para el usuario ${userId}`);
    } catch (error) {
        console.error("Error borrando el historial:", error);
    }
};
