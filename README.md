Pixel AI is an intelligent, real-time chat and voice assistant built with React and TypeScript.
It lets users chat with an AI, collaborate in shared chat rooms, and even talk through live voice sessions — all inside a clean, responsive interface.


---

🚀 Features

💬 Smart Chat Interface

Stream real-time AI responses using the Gemini API.

Supports Markdown, math syntax, and formatted text.

Smooth message streaming for a natural chat flow.


👥 Collaborative Chat Rooms

Create or join private rooms using short, shareable codes.

Messages and reactions sync in real-time across all devices using Firebase Firestore.

Each participant has their own avatar, with clear visual distinction between you, the AI, and others.


🗒️ Built-in Notepad

Take quick notes without leaving the app.

Automatically saved in your browser using local storage.


🎙️ Live Voice Sessions

Start live, interactive voice conversations with Pixel AI.

Real-time waveform animation using HTML5 Canvas.

Custom permission modal with step-by-step microphone setup instructions.


💾 Local Persistence

Your notes and private chat history are stored locally and auto-restored.

Each user has a unique ID saved in local storage for a personalized experience.


🎨 Clean, Modern Design

Responsive interface built with Tailwind CSS.

Smooth transitions, rounded elements, and minimal visual clutter.



---

🧩 Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **AI Integration:** Google Gemini API
- **Realtime Database:** Google Firebase Firestore
- **Markdown Rendering:** Marked, DOMPurify, MathJax
- **Persistence:** LocalStorage (for non-room data)
- **Audio Visualization:** HTML5 Canvas API


---

🏗️ Project Structure

src/
├── components/       UI components (Chat, Sidebar, Notepad, etc.)
├── services/         Gemini AI, Firebase, and live session logic
├── types.ts          Shared TypeScript types
├── App.tsx           Main component and state manager
└── index.tsx         Entry point


---

🧑‍💻 Getting Started

**1. Install Dependencies**
```bash
npm install
```

**2. Set up Gemini API Key**

Create a file named `.env.local` in the root directory and add your Gemini API key:
```
VITE_API_KEY=your_gemini_api_key_here
```

**3. Set up Firebase for Real-Time Chat Rooms**

To enable real-time chat rooms, you need to create a free Firebase project.

- **Step 1: Create a Firebase Project**
    1. Go to the [Firebase Console](https://console.firebase.google.com/).
    2. Click "Add project" and follow the on-screen instructions.

- **Step 2: Create a Firestore Database**
    1. In your new project's console, go to the "Build" section and click "Firestore Database".
    2. Click "Create database".
    3. Start in **test mode** for now. This allows open read/write access. For production, you will need to set up [security rules](https://firebase.google.com/docs/firestore/security/get-started).
    4. Choose a location for your database.

- **Step 3: Get Firebase Config for a Web App**
    1. Go to your "Project Overview".
    2. Click the web icon (`</>`) to add a new web app to your project.
    3. Give your app a nickname and click "Register app".
    4. Firebase will provide you with a configuration object that looks like this:
       ```javascript
       const firebaseConfig = {
         apiKey: "...",
         authDomain: "...",
         projectId: "...",
         storageBucket: "...",
         messagingSenderId: "...",
         appId: "..."
       };
       ```

- **Step 4: Add Config to Environment Variables**
    1. Copy the `firebaseConfig` object.
    2. In your `.env.local` file, add a new variable `VITE_FIREBASE_CONFIG`.
    3. Paste the config object as a single-line JSON string:
       ```
       VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
       ```
    *Note: The application contains a hardcoded fallback configuration for quick testing, but it will prioritize and use the one you provide in your environment variables.*

**4. Run the App**
```bash
npm run dev
```
Then open your browser and go to: `http://localhost:5173`


---

🖼️ Visual Identity

- **Pixel AI logo / avatar:** `https://iili.io/K4QGIa9.png`
- **Live session icon:** `https://iili.io/K4tpjWP.png`
- **Current user avatar:** `https://iili.io/K4ZYyKX.png`
- **Other user avatar:** `https://iili.io/K6NVP8x.png`
- **Notepad icon:** `https://iili.io/K4tuzkQ.png`


---

🧠 Ideal Use Cases

- A personal AI assistant for productivity and idea generation.
- Shared collaborative chat spaces for teams or study groups.
- Experimenting with voice-enabled AI interactions.


---

🪪 License

This project is licensed under the MIT License.


---

Made with ❤️ by the Pixel AI team
