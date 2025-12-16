// @ts-ignore
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
    User
} from "firebase/auth";
import { 
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    addDoc,
    updateDoc,
    arrayUnion,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    runTransaction,
    DocumentReference,
    DocumentData,
    enableIndexedDbPersistence,
    initializeFirestore,
    CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import type { Room, RoomMessage } from '../types';

// Default configuration
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

// Initialize Firebase
let app: any;
let auth: any;
let db: any;

const initFirebase = () => {
    if (app && db && auth) return; // Already initialized
    try {
        app = initializeApp(defaultFirebaseConfig);
        auth = getAuth(app);
        
        // Attempt to initialize with offline persistence
        try {
             db = initializeFirestore(app, {
                cacheSizeBytes: CACHE_SIZE_UNLIMITED
             });
        } catch (e) {
             console.warn("Falling back to default Firestore init", e);
             db = getFirestore(app);
        }

        console.log("Firebase initialized successfully");
    } catch (e) {
        console.error("Firebase initialization failed critical error:", e);
    }
}

// Attempt init immediately
initFirebase();

// 1. Authentication
export const login = (): Promise<User> => {
    return new Promise((resolve, reject) => {
        if (!auth) initFirebase();
        
        if (!auth) {
             console.warn("Auth module missing. Using guest mode.");
             resolve({ uid: `guest_${Math.random().toString(36).substring(2, 10)}`, isAnonymous: true } as any);
             return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user) {
                unsubscribe();
                resolve(user);
            } else {
                signInAnonymously(auth).catch((err) => {
                    unsubscribe();
                    console.warn("Anonymous login failed, using fallback guest ID.", err);
                    resolve({ uid: `guest_${Math.random().toString(36).substring(2, 10)}`, isAnonymous: true } as any);
                });
            }
        });
    });
};

// 2. Room Code Generator
export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 3. Create Room Logic (FAST & OFFLINE READY)
export const createRoom = async (userId: string, customCode?: string): Promise<string> => {
    if (!db) initFirebase();
    
    // Use the code provided by the UI, or generate one
    const roomCode = customCode || generateRoomCode();
    
    // We do NOT check for existence first. We assume collision is rare (36^6 possibilities).
    // This allows "setDoc" to work immediately even if offline.
    const roomRef = doc(db, "rooms", roomCode);
    const messagesRef = collection(db, "rooms", roomCode, "messages");

    try {
        // Fire and forget - await ensures it's queued, but doesn't strictly wait for server ack if offline
        await setDoc(roomRef, {
            id: roomCode,
            name: `Room ${roomCode}`,
            createdAt: serverTimestamp(),
            createdBy: userId,
            memberIds: [userId, 'PixelBot'] 
        });

        await addDoc(messagesRef, {
            text: `Welcome to Room ${roomCode}! Share this code with friends.`,
            senderId: 'PixelBot',
            timestamp: serverTimestamp(),
            reactions: {}
        });
    } catch (e: any) {
        console.error("Error creating room:", e);
        // If it's a permission error, throw it. Otherwise, assume offline queueing worked.
        if (e.code === 'permission-denied') {
             throw new Error("Permission denied. Check Firestore rules.");
        } 
    }

    return roomCode;
};

// 4. Join Room Logic
export const joinRoom = async (roomCode: string, userId: string): Promise<void> => {
    if (!db) initFirebase();
    if (!db) throw new Error("Database connection not established.");

    const cleanCode = roomCode.trim().toUpperCase();
    const roomRef = doc(db, "rooms", cleanCode);
    
    try {
        // We MUST wait for server check here to ensure room exists
        const snapshot = await getDoc(roomRef);

        if (!snapshot.exists()) {
            throw new Error("Room not found. Please ask the creator to check the code.");
        }

        await updateDoc(roomRef, {
            memberIds: arrayUnion(userId)
        });
        
        await addDoc(collection(db, "rooms", cleanCode, "messages"), {
            text: `User joined the room.`,
            senderId: 'PixelBot',
            timestamp: serverTimestamp(),
            reactions: {}
        });
    } catch (e: any) {
        if (e.message && e.message.includes("offline")) {
             throw new Error("You are offline. Cannot find room. Check your internet.");
        }
        throw e;
    }
};

// 5. Send Message Logic
export const sendRoomMessage = async (roomId: string, messageData: { text: string, senderId: string, groundingMetadata?: any }): Promise<void> => {
    if (!db) return;
    try {
        await addDoc(collection(db, "rooms", roomId, "messages"), {
            text: messageData.text,
            senderId: messageData.senderId,
            timestamp: serverTimestamp(),
            groundingMetadata: messageData.groundingMetadata || null,
            reactions: {}
        });
    } catch (e) {
        console.error("Error sending message:", e);
    }
};

// 6. Real-Time Message Listener
export const listenToMessages = (roomId: string, callback: (messages: RoomMessage[]) => void): (() => void) => {
    if (!db) return () => {};

    const q = query(
        collection(db, "rooms", roomId, "messages"),
        orderBy("timestamp", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                senderId: data.senderId,
                text: data.text,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString(),
                reactions: data.reactions || {},
                groundingMetadata: data.groundingMetadata
            } as RoomMessage;
        });
        callback(messages);
    }, (error) => {
        console.error("Error listening to messages:", error);
    });
};

// 7. Listen to User's Rooms
export const listenToUserRooms = (userId: string, callback: (rooms: Room[]) => void): (() => void) => {
    if (!db) return () => {};

    const q = query(collection(db, "rooms"), where('memberIds', 'array-contains', userId));
    
    return onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            messages: []
        } as Room));
        callback(rooms);
    }, (error) => {
        console.error("Error listening to rooms:", error);
    });
};

// 8. Toggle Reaction
export const toggleReaction = async (roomId: string, messageId: string, emoji: string, userId: string): Promise<void> => {
    if (!db) return;
    const msgRef = doc(db, "rooms", roomId, "messages", messageId);

    try {
        await runTransaction(db, async (transaction) => {
            const msgDoc = await transaction.get(msgRef);
            if (!msgDoc.exists()) return;

            const data = msgDoc.data();
            const reactions = data.reactions || {};
            const currentUsers = reactions[emoji] || [];

            if (currentUsers.includes(userId)) {
                reactions[emoji] = currentUsers.filter((id: string) => id !== userId);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
                reactions[emoji] = [...currentUsers, userId];
            }

            transaction.update(msgRef, { reactions });
        });
    } catch (e) {
        console.error("Reaction transaction failed", e);
    }
};