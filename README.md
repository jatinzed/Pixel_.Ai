
Pixel AI is an intelligent, real-time chat and voice assistant built with React and TypeScript.
It lets users chat with an AI, collaborate in shared chat rooms, and even talk through live voice sessions — all inside a clean, responsive interface.


---

🚀 Features

💬 Smart Chat Interface

Stream real-time AI responses using the Gemini API.

Supports Markdown, math syntax, and formatted text.

Smooth message streaming for a natural chat flow.


👥 Collaborative Chat Rooms

Create or join private rooms using short 5-character codes.

Messages sync in real-time through Firebase.

Each participant has their own avatar, with clear visual distinction between you, the AI, and others.


🗒️ Built-in Notepad

Take quick notes without leaving the app.

Automatically saved in your browser using local storage.


🎙️ Live Voice Sessions

Start live, interactive voice conversations with Pixel AI.

Real-time waveform animation using HTML5 Canvas.

Custom permission modal with step-by-step microphone setup instructions.


💾 Local Persistence

Your notes and chat history are stored locally and auto-restored.

Each user has a unique ID saved in local storage for personalized experience.


🎨 Clean, Modern Design

Responsive interface built with Tailwind CSS.

Smooth transitions, rounded elements, and minimal visual clutter.



---

🧩 Tech Stack

Frontend: React, TypeScript, Vite
Styling: Tailwind CSS
AI Integration: Gemini API (via geminiService.ts)
Realtime Database: Firebase Firestore
Markdown Rendering: React Markdown, Remark GFM, Rehype KaTeX
Persistence: LocalStorage
Audio Visualization: HTML5 Canvas API


---

🏗️ Project Structure

src/
├── components/       UI components (Chat, Sidebar, Notepad, etc.)
├── services/         AI streaming, Firebase, and live session logic
├── types.ts          Shared TypeScript types
├── App.tsx           Main component and state manager
├── index.tsx         Entry point
└── constants.ts      App constants and configuration


---

🧑‍💻 Getting Started

1. Install dependencies

npm install


2. Set up environment

Create a file named .env.local in the root directory and add:

VITE_API_KEY=your_gemini_api_key_here


3. Run the app

npm run dev

Then open your browser and go to:
http://localhost:5173




---

🖼️ Visual Identity

Pixel AI logo / avatar:
https://iili.io/K4QGIa9.png

Live session icon:
https://iili.io/K4tpjWP.png

Current user avatar:
https://iili.io/K4ZYyKX.png

Other user avatar:
https://iili.io/K6NVP8x.png

Notepad icon:
https://iili.io/K4tuzkQ.png



---

🧠 Ideal Use Cases

A personal AI assistant for productivity and idea generation.

Shared collaborative chat spaces for teams or study groups.

Experimenting with voice-enabled AI interactions.



---

🪪 License

This project is licensed under the MIT License.


---

Made with ❤️ by the Pixel AI team
