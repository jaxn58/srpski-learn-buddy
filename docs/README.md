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
- Convex Account (for database and real-time features)
- Gemini API Key
- Clerk Account (for authentication)

### **1. Clone the Repository**

```bash
git clone https://github.com/jaxn58/srpski-learn-buddy.git
cd srpski-learn-buddy
git switch main_en
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

**Wichtig für Production-Deployment**: Wenn du auf Vercel deployst, solltest du Clerk Production Keys verwenden. Siehe [CLERK_PRODUCTION_MIGRATION.md](./CLERK_PRODUCTION_MIGRATION.md) für Details.

### **4. Configure Environment Variables**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your actual values. Required variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
   - `CLERK_SECRET_KEY` - From Clerk dashboard
   - `CLERK_JWT_ISSUER_DOMAIN` - From Clerk dashboard (e.g., `https://your-app.clerk.accounts.dev`)
   - `VITE_CONVEX_URL` - From Convex dashboard (e.g., `https://your-deployment.convex.cloud`)
   - `CONVEX_DEPLOYMENT` - Your Convex deployment ID (e.g., `dev:your-deployment`)
   - `GEMINI_API_KEY` - For AI Learn Buddy feature

   See `.env.example` for all available configuration options.

**Note:** The `.env` file is gitignored and will not be committed. Use `.env.example` as a template.

#### Paddle (optional, for Checkout/Billing)

Add the following variables to enable Paddle Sandbox payments:

- `VITE_PADDLE_CLIENT_TOKEN` – Client token for the Paddle JS SDK.
- `VITE_PADDLE_PRODUCT_INTENSIVE`, `VITE_PADDLE_PRODUCT_BALANCED`, `VITE_PADDLE_PRODUCT_STANDARD`, `VITE_PADDLE_PRODUCT_RELAXED` – Price IDs created in Paddle (one per plan).
- `PADDLE_API_KEY` – Server-side API key (used for future management tasks).
- `PADDLE_WEBHOOK_SECRET` – Secret used to verify incoming webhooks.
- `PADDLE_PRODUCT_INTENSIVE`, `PADDLE_PRODUCT_BALANCED`, `PADDLE_PRODUCT_STANDARD`, `PADDLE_PRODUCT_RELAXED` – Same price IDs for backend validation.

Configure your Paddle Dashboard webhook to point to `https://<your-domain>/api/paddle/webhook` (during local development you can tunnel to `http://localhost:3000/api/paddle/webhook` via `ngrok`).

### **5. Set Up Convex**

1. Create a Convex account at [convex.dev](https://convex.dev)
2. Initialize your Convex deployment:
   ```bash
   npx convex dev
   ```
3. Follow the prompts to link your project to Convex
4. The schema will be automatically deployed

### **6. Start the Development Environment**

Run the Convex dev process in one terminal and Vite in another:

```bash
# Terminal 1: Convex (functions + database)
npx convex dev

# Terminal 2: Frontend
pnpm dev
```

The UI runs at `http://localhost:5173` and talks directly to Convex (no local Express/tRPC server required anymore).

## 🤖 Fake Student Bot

Need to advance a test account without clicking through every exercise? Use the fake student automation:

1. Set `BOT_AUTOMATION_KEY` in both `.env.local` and your Convex deployment environment so that the automation mutation can validate requests.
2. Run the bot with your target user, unit, and desired mode:

```bash
pnpm bot:student --email=hello@jacksenn.me --unit=2 --mode=completed
# or max out mastery
pnpm bot:student --email=hello@jacksenn.me --unit=1 --mode=mastered --questions=12
```

`--mode` accepts `completed` or `mastered`. The optional `--questions` flag (default `8`) controls how many simulated exercise questions are written as mastered for that unit.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TypeScript, TailwindCSS
- **Backend / Data**: Convex (queries, mutations, storage, cron)
- **Scripts**: `tsx`-based tooling (content cleanup, automation)
- **AI**: Google Gemini
- **Authentication**: Clerk (pre-built UI components)

## 📚 Architecture

- **Single Data Layer**: All persistence + server logic live in Convex
- **Vite for Development**: Serves the frontend and hot-reloads Convex client calls
- **Convex Functions**: Replace the former Express/tRPC stack; use `convex/` directory for queries/mutations
- **Clerk Auth**: Handles user authentication with pre-built sign-in/sign-up pages

## 🔐 Authentication Flow

1. Users sign in via Clerk's pre-built `<SignIn />` component at `/sign-in`
2. New users are registered via `<SignUp />` at `/sign-up`
3. Upon first authentication, users are automatically synced to the local database
4. Protected routes use the `<SignedIn />` / `<SignedOut />` components
5. User data (roles, beta tester status, etc.) is stored in Convex

## 🧪 Content QA Utilities

Use the Convex-powered export/comparison scripts to check course content against legacy material:

```bash
# Export all units (or a subset with --units=6,20)
pnpm export:units

# Compare exported units with the legacy PDF (supports the same --unit flag)
pnpm compare:book
```

The scripts write their results to `exports/unit-contents-export.json` and `exports/comparison-report.(json|md)` and can be reused whenever content changes.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


