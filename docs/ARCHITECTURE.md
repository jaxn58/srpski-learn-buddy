# Architecture Overview

This document provides a high-level overview of the technical architecture of the Srpski AI Tutor application.

## 1. Core Principles

- **Type-Safety End-to-End**: From the database to the frontend, all data is strongly typed to prevent common errors.
- **Monorepo-like Structure**: Frontend and backend code reside in the same repository for easier management.
- **Serverless-Ready**: While currently running on a single server, the architecture is designed to be easily deployed to serverless platforms like Vercel.

## 2. Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React, Vite, TypeScript | Modern, fast, and type-safe frontend development. |
| **Styling** | TailwindCSS | Utility-first CSS framework for rapid UI development. |
| **Backend** | Express, tRPC, tsx | Lightweight and fast backend with a type-safe API layer. |
| **Database** | TiDB Cloud (MySQL) | Scalable, distributed SQL database. |
| **ORM** | Drizzle ORM | Type-safe SQL query builder for TypeScript. |
| **AI** | Google Gemini | AI-powered chat and learning features. |
| **Authentication** | Custom Dev-Login | Simple, secure login for development and testing. |

## 3. Directory Structure

```
/home/ubuntu/Srpski-AI-Tutor
├── client/         # Frontend code (React, Vite)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── _core/      # Core frontend logic (hooks, API client)
│   │   └── main.tsx    # Frontend entry point
├── server/         # Backend code (Express, tRPC)
│   ├── _core/      # Core backend logic (auth, db, llm)
│   └── routers.ts  # tRPC routers
├── shared/         # Code shared between frontend and backend
├── drizzle/        # Drizzle ORM schema and migrations
├── public/         # Static assets
├── .env            # Environment variables
├── package.json    # Project dependencies and scripts
└── vite.config.ts  # Vite configuration
```

## 4. Data Flow

1. **User Interaction**: User interacts with the React frontend.
2. **API Request**: Frontend makes a type-safe API call to the backend using tRPC.
3. **Backend Processing**: Express server receives the request and passes it to the tRPC router.
4. **Database Query**: tRPC router uses Drizzle ORM to query the TiDB database.
5. **AI Interaction**: For AI features, the backend calls the Google Gemini API.
6. **API Response**: Backend returns a type-safe response to the frontend.
7. **UI Update**: Frontend updates the UI with the new data.

## 5. Authentication

- **Custom Dev-Login**: A simple, secure login system for development and testing.
- **Session Management**: Uses JWTs stored in secure, HTTP-only cookies.
- **Future-Proof**: Designed to be easily replaced with a production-ready solution like Clerk.

## 6. Key Features Deep-Dive

### AI Learn Buddy

- **Backend**: Uses the Google Gemini API for chat completions.
- **Frontend**: A simple, chat-like interface for interacting with the AI.
- **Prompt Engineering**: The backend uses a carefully crafted prompt to ensure the AI acts as a helpful Serbian tutor.

### Vocabulary Quiz

- **Spaced Repetition**: The `vocabulary` table tracks `reviewCount` and `lastReviewedAt` to implement a basic spaced repetition system.
- **Resume Functionality**: The `quizProgress` table stores the user's current position in a quiz, allowing them to resume later.
- **Dual Storage**: Quiz progress is stored in both `localStorage` (for speed) and the database (for persistence).
