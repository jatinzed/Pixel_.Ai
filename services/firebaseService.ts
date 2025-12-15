// @ts-ignore
import { initializeApp } from "firebase/app";
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

// Global variables to store Firebase instances
let app: any = null;
let db: any = null;
let roomsCollection: any = null;

// Default hardcoded configuration
// This is used if the environment variable VITE_FIREBASE_API is not found.
const defaultFirebaseConfig = {
  apiKey: "AIzaSyCYNBu8LhVT_W2GDzFiUeM4eohShG0GmiM",
  authDomain: "project-63a14c3a-ccaa-458e-a85.firebaseapp.com",
  databaseURL: "https://project-63a14c3a-ccaa-458e-a85-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-63a14c3a-ccaa-458e-a85",
  storageBucket: "project-63a14c3a-ccaa-458e-a85.firebasestorage.app",
  messagingSenderId: "475658142909",
  appId: "1:475658142909:web:401806854d41ff6822e3d4",
  measurementId: "G-P3SC985194"
};

// Initialize Firebase safely.
// We prioritize the environment variable, but fall back to the hardcoded config.
try {
    const env = (import.meta as any)?.env;
    let firebaseConfig = defaultFirebaseConfig;

    if (env && env.VITE_FIREBASE_API) {
        try {
            const parsedConfig = JSON.parse(env.VITE_FIREBASE_API);
            if (parsedConfig) {
                firebaseConfig = parsedConfig;
                console.log("Using Firebase config from environment variable.");
            }
        } catch (e) {
            console.warn("VITE_FIREBASE_API provided but invalid JSON. Falling back to hardcoded config.");
        }
    } else {
        console.log("VITE_FIREBASE_API not found. Using hardcoded Firebase config.");
    }

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    roomsCollection = collection(db, "rooms");
    console.log("Firebase initialized successfully.");

} catch (error) {
    console.error("Failed to initialize Firebase.", error);
}

// Helper to check if Firebase is ready
const ensureInitialized = () => {
    if (!db || !roomsCollection) {
        throw new Error("Firebase is not initialized. Please check your configuration.");
    }
};

export const createRoom = async (userId: string): Promise<string> => {
    ensureInitialized();
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
    ensureInitialized();
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
    // Return a dummy unsubscribe function if Firebase isn't ready
    // This prevents App.tsx from crashing when it tries to call unsubscribe()
    if (!db || !roomsCollection) {
        console.warn("Firebase not initialized; skipping room listener.");
        return () => {}; 
    }

    const q = query(roomsCollection, where('memberIds', 'array-contains', userId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rooms: Room[] = [];
        querySnapshot.forEach((doc) => {
            rooms.push(doc.data() as Room);
        });
        callback(rooms);
    }, (error) => {
        console.error("Error listening to rooms:", error);
    });

    return unsubscribe;
};

export const sendRoomMessage = async (roomId: string, messageData: Omit<RoomMessage, 'id' | 'timestamp' | 'reactions'>): Promise<void> => {
    ensureInitialized();
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
    ensureInitialized();
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