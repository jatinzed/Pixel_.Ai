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

let firebaseConfig: FirebaseOptions;

try {
    // Vite exposes env variables on import.meta.env
    const env = (import.meta as any)?.env;
    if (env && env.VITE_FIREBASE_API) {
        // The user is expected to provide the full JSON config string in this variable
        firebaseConfig = JSON.parse(env.VITE_FIREBASE_API);
    } else {
        throw new Error("VITE_FIREBASE_API environment variable is missing.");
    }
} catch (error) {
    console.error("Failed to load Firebase configuration. Please check your .env settings.", error);
    throw new Error("Firebase configuration invalid or missing.");
}

const app = initializeApp(firebaseConfig);
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
    }, (error) => {
        console.error("Error listening to rooms:", error);
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