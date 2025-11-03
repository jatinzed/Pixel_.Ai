import { initializeApp, FirebaseOptions } from "firebase/app";
import { 
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion,
    collection,
    query,
    where,
    onSnapshot,
    runTransaction,
    DocumentReference,
    DocumentData
} from "firebase/firestore";
import type { Room, RoomMessage } from '../types';

// Hardcoded config as a fallback for testing
const firebaseConfig: FirebaseOptions = {
    apiKey: "AIzaSyC2okxLCbWu8aRVxHzzzf3awh36B25UKPU",
    authDomain: "pixel-ai-10c0e.firebaseapp.com",
    projectId: "pixel-ai-10c0e",
    storageBucket: "pixel-ai-10c0e.firebasestorage.app",
    messagingSenderId: "864827888165",
    appId: "1:864827888165:web:836e121bdbb8e5778425cc",
    measurementId: "G-S8XFC4B27V"
};

// Prioritize environment variable if it exists
let finalConfig = firebaseConfig;
try {
    // Vite uses import.meta.env. Check for its existence to avoid runtime errors
    // in environments where it might be undefined.
    const env = (import.meta as any)?.env;
    if (env && env.VITE_FIREBASE_CONFIG) {
        finalConfig = JSON.parse(env.VITE_FIREBASE_CONFIG);
    }
} catch (error) {
    console.error("Failed to parse VITE_FIREBASE_CONFIG. Using hardcoded fallback.", error);
}

const app = initializeApp(finalConfig);
const db = getFirestore(app);

const roomsCollection = collection(db, "rooms");

export const createRoom = async (userId: string): Promise<string> => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: Room = {
      id: roomCode,
      name: `Room ${roomCode}`,
      memberIds: [userId, 'PixelBot'],
      messages: [{
        id: Date.now().toString(),
        senderId: 'PixelBot',
        text: `Welcome to the room! Your room code is ${roomCode}. Share it with others to invite them.`,
        timestamp: new Date().toISOString(),
        reactions: {}
      }],
    };
    await setDoc(doc(roomsCollection, roomCode), newRoom);
    return roomCode;
};

export const joinRoom = async (roomCode: string, userId: string): Promise<void> => {
    const roomRef = doc(roomsCollection, roomCode);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        const roomData = roomSnap.data() as Room;
        if (!roomData.memberIds.includes(userId)) {
            const joinMessage: RoomMessage = {
                id: Date.now().toString(),
                senderId: 'PixelBot',
                text: `User ${userId.substring(5)} has joined the room.`,
                timestamp: new Date().toISOString(),
                reactions: {},
            };
            await updateDoc(roomRef, {
                memberIds: arrayUnion(userId),
                messages: arrayUnion(joinMessage),
            });
        }
    } else {
        // Room doesn't exist, create it
        const newRoom: Room = {
            id: roomCode,
            name: `Room ${roomCode}`,
            memberIds: [userId, 'PixelBot'],
            messages: [{
                id: Date.now().toString(),
                senderId: 'PixelBot',
                text: 'Welcome! You have created and joined the room.',
                timestamp: new Date().toISOString(),
                reactions: {}
            }],
        };
        await setDoc(roomRef, newRoom);
    }
};

export const listenToUserRooms = (userId: string, callback: (rooms: Room[]) => void): (() => void) => {
    const q = query(roomsCollection, where('memberIds', 'array-contains', userId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rooms: Room[] = [];
        querySnapshot.forEach((doc) => {
            rooms.push(doc.data() as Room);
        });
        callback(rooms);
    });

    return unsubscribe;
};

export const sendRoomMessage = async (roomId: string, messageData: Omit<RoomMessage, 'id' | 'timestamp' | 'reactions'>): Promise<void> => {
    const roomRef = doc(roomsCollection, roomId);
    
    const newMessage: RoomMessage = {
        ...messageData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        reactions: {},
    };

    await updateDoc(roomRef, {
        messages: arrayUnion(newMessage)
    });
};

export const toggleReaction = async (roomId: string, messageId: string, emoji: string, userId: string): Promise<void> => {
    const roomRef = doc(roomsCollection, roomId);

    try {
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef as DocumentReference<DocumentData>);
            if (!roomDoc.exists()) {
                throw "Room does not exist!";
            }

            const roomData = roomDoc.data() as Room;
            const messages = [...roomData.messages];
            const messageIndex = messages.findIndex(m => m.id === messageId);

            if (messageIndex === -1) {
                return; // Message not found
            }

            const message = { ...messages[messageIndex] };
            const reactions = { ...(message.reactions || {}) };
            const reactingUsers = reactions[emoji] || [];

            if (reactingUsers.includes(userId)) {
                // User is removing their reaction
                reactions[emoji] = reactingUsers.filter(id => id !== userId);
                if (reactions[emoji].length === 0) {
                    delete reactions[emoji];
                }
            } else {
                // User is adding a reaction
                reactions[emoji] = [...reactingUsers, userId];
            }
            
            message.reactions = reactions;
            messages[messageIndex] = message;

            transaction.update(roomRef, { messages });
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
    }
};
