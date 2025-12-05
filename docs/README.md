# Srpski AI Tutor

**Serbian for Beginners. With your AI Learn Buddy.**

A structured course with 27 units and 737+ vocabulary words – featuring interactive exercises, vocabulary training, and AI-powered learning support.

## ✨ Features

- **Structured Learning Path**: 27 units covering all major beginner topics
- **AI Learn Buddy**: Your personal AI tutor for questions, grammar, and conversation
- **Vocabulary Trainer**: Master 737+ words with interactive flashcards and spaced repetition
- **Gamification & Rewards**: Earn XP, unlock badges, and maintain streaks
- **Progress Tracking**: See your achievements and stay motivated
- **Admin Dashboard**: Manage users, content, and beta testers

## 🚀 Getting Started

### **Prerequisites**

- Node.js (v22.x)
- pnpm (v10.x)
- TiDB Cloud Account (or MySQL database)
- Gemini API Key
- Clerk Account (for authentication)

### **1. Clone the Repository**

```bash
gh repo clone jaxn58/srpski-tutor-rescue
cd srpski-tutor-rescue
```

### **2. Install Dependencies**

```bash
pnpm install
```

### **3. Set Up Clerk Authentication**

1. Go to [clerk.com](https://clerk.com) and create a new application
2. In the Clerk dashboard, configure your application:
   - Enable Email/Password authentication
   - (Optional) Enable social logins (Google, GitHub, etc.)
3. Copy your API keys from the Clerk dashboard

### **4. Configure Environment Variables**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your actual values. Required variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
   - `CLERK_SECRET_KEY` - From Clerk dashboard
   - `VITE_CONVEX_URL` - From Convex dashboard (e.g., `https://your-deployment.convex.cloud`)
   - `DATABASE_URL` - Your MySQL/TiDB connection string
   - `GEMINI_API_KEY` - For AI Learn Buddy feature

   See `.env.example` for all available configuration options.

**Note:** The `.env` file is gitignored and will not be committed. Use `.env.example` as a template.

### **5. Run Database Migrations**

This will create all necessary tables in your database.

```bash
pnpm db:push
```

### **6. Import Old Data (Optional)**

If you have the old CSV data, you can import it using the provided migration script:

```bash
node migrate_old_data.cjs
```

### **7. Start the Development Server**

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TypeScript, TailwindCSS
- **Backend**: Express, tRPC, tsx
- **Database**: TiDB Cloud (MySQL), Drizzle ORM
- **AI**: Google Gemini
- **Authentication**: Clerk (pre-built UI components)

## 📚 Architecture

- **Monorepo-like Structure**: Frontend and backend code are in the same repository
- **Vite for Development**: Serves the frontend and proxies API requests to the backend
- **tRPC for API**: Type-safe API layer between frontend and backend
- **Drizzle ORM**: Type-safe SQL query builder
- **Clerk Auth**: Handles user authentication with pre-built sign-in/sign-up pages

## 🔐 Authentication Flow

1. Users sign in via Clerk's pre-built `<SignIn />` component at `/sign-in`
2. New users are registered via `<SignUp />` at `/sign-up`
3. Upon first authentication, users are automatically synced to the local database
4. Protected routes use the `<SignedIn />` / `<SignedOut />` components
5. User data (roles, beta tester status, etc.) is stored in the local database

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
