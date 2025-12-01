# Gamification + Footer Update


## Rescue

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

### **1. Clone the Repository**

```bash
gh repo clone jaxn58/srpski-tutor-rescue
cd srpski-tutor-rescue
```

### **2. Install Dependencies**

```bash
pnpm install
```

### **3. Configure Environment Variables**

Create a `.env` file in the root of the project and add the following variables:

```env
# Database (TiDB Cloud or MySQL)
DATABASE_URL="mysql://user:password@host:port/database?sslaccept=strict"

# Gemini API Key
GEMINI_API_KEY="your_gemini_api_key"

# Custom Dev Login (for testing)
DEV_LOGIN_SECRET="your_secret_for_dev_login"

# Optional: AWS S3 for file uploads
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION=""
AWS_S3_BUCKET=""
```

### **4. Run Database Migrations**

This will create all necessary tables in your database.

```bash
pnpm db:push
```

### **5. Import Old Data (Optional)**

If you have the old CSV data, you can import it using the provided migration script:

```bash
node migrate_old_data.cjs
```

### **6. Start the Development Server**

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TypeScript, TailwindCSS
- **Backend**: Express, tRPC, tsx
- **Database**: TiDB Cloud (MySQL), Drizzle ORM
- **AI**: Google Gemini
- **Authentication**: Custom Dev-Login (for testing)

## 📚 Architecture

- **Monorepo-like Structure**: Frontend and backend code are in the same repository
- **Vite for Development**: Serves the frontend and proxies API requests to the backend
- **tRPC for API**: Type-safe API layer between frontend and backend
- **Drizzle ORM**: Type-safe SQL query builder

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
