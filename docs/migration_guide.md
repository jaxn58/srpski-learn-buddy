
'''
# Migration Guide: Serbian AI Tutor to a Modern Serverless Stack

**Author:** Manus AI
**Date:** December 01, 2025

## 1. Introduction

This document provides a comprehensive, step-by-step guide for migrating the **Srpski AI Tutor** application from its current setup (custom authentication, TiDB database, self-hosted) to a modern, scalable, and fully-managed serverless stack. The new stack will leverage **Clerk** for authentication, **Convex** as the real-time database and backend, **Paddle** for payment processing, and **Vercel** for hosting.

### 1.1. Benefits of the New Stack

The proposed architecture offers significant advantages over the existing implementation:

| Component | Benefit | Description |
| :--- | :--- | :--- |
| **Clerk** | **Robust Authentication** | Provides a complete, pre-built authentication solution with features like OAuth, multi-factor authentication (MFA), session management, and a user management dashboard. This eliminates the need to maintain custom, and often less secure, authentication logic. |
| **Convex** | **Real-time Database & Backend** | A serverless platform that combines a real-time database with server-side functions. It simplifies data management with TypeScript-native schemas, automatic real-time updates in the frontend, and eliminates the need for a separate backend server. |
| **Paddle** | **Merchant of Record** | Handles all aspects of payment processing, including global sales tax, VAT, and fraud detection. This simplifies compliance and allows you to focus on the product rather than financial administration. |
| **Vercel** | **Effortless Hosting** | A platform optimized for modern frontend frameworks like React. It offers seamless Git integration, automatic deployments, a global CDN, and serverless functions, ensuring high performance and scalability. |

By the end of this guide, the application will be more secure, scalable, easier to maintain, and provide a superior user experience.

---

## 2. Phase 1: Account & Project Setup

This initial phase involves creating accounts for each of the new services and setting up the basic project configurations. It is crucial to store all API keys and environment variables securely.

### 2.1. Clerk: Authentication Setup

Clerk will handle all user authentication. The first step is to create a new Clerk application.

1.  **Create a Clerk Account:** If you do not have one, sign up for a free account at [clerk.com](https://clerk.com).

2.  **Create a New Application:**
    *   From your Clerk dashboard, click on **"Add application"**.
    *   Give your application a name, for example, "Srpski AI Tutor".
    *   Select the authentication methods you want to offer. It is recommended to start with **Email & Password** and **Google** for broad accessibility.
    *   Follow the on-screen instructions to complete the setup.

3.  **Obtain API Keys:**
    *   Once the application is created, navigate to the **"API Keys"** section in the Clerk dashboard.
    *   You will need the **Publishable Key** (for the frontend) and the **Secret Key** (for the backend/Convex). 
    *   Copy these keys and save them in a secure location. We will add them to our environment variables later.

    > **Security Note:** The Secret Key provides full access to your Clerk application's backend API. It must never be exposed in frontend code or committed to version control.

'''
'''
### 2.2. Convex: Database & Backend Setup

Convex will replace the TiDB database and the Express backend server. It provides a unified platform for your data and server-side logic.

1.  **Install the Convex CLI:** Open your terminal and install the Convex command-line interface (CLI) globally.

    ```bash
    npm install -g convex
    ```

2.  **Initialize Convex in Your Project:**
    *   Navigate to your project's root directory (`/home/ubuntu/Srpski-AI-Tutor`).
    *   Run the initialization command:

        ```bash
        npx convex init
        ```

    *   This command will create a new `convex` directory in your project. This is where your database schema and backend functions (mutations and queries) will live.
    *   Follow the CLI prompts to log in to your Convex account (or create a new one) and create a new project.

3.  **Obtain Project URL:**
    *   After initialization, the Convex CLI will output your project's **Deployment URL**. It will look something like `https://<your-project-name>.convex.cloud`.
    *   This URL is used by the Convex client in your frontend to connect to your backend. Copy this URL and save it.

### 2.3. Paddle: Payment Setup

Paddle will manage subscriptions and payments. Setting it up involves configuring your products and payment methods.

1.  **Create a Paddle Account:** Sign up for a Paddle account at [paddle.com](https://www.paddle.com/). You may need to go through an approval process.

2.  **Configure Your Product Catalog:**
    *   In your Paddle dashboard, navigate to **"Catalog"** -> **"Products"** and create a new product for your subscription (e.g., "Srpski AI Tutor Pro").
    *   Add a price for this product, specifying the currency and billing interval (e.g., monthly).

3.  **Obtain API Keys and Webhook Secret:**
    *   Go to **"Developer Tools"** -> **"Authentication"** to get your API keys.
    *   You will also need to set up a webhook to receive notifications about subscription events (e.g., `subscription.created`, `subscription.updated`). Under **"Developer Tools"** -> **"Events"** -> **"Notifications"**, you can configure the destination URL for your webhooks. We will create this webhook endpoint in Convex later.
    *   Make sure to copy your **Webhook Secret** to verify incoming webhook requests.

### 2.4. Vercel: Hosting Setup

Vercel will be used to host the frontend of the application and connect to all the backend services.

1.  **Create a Vercel Account:** Sign up at [vercel.com](https://vercel.com/) using your GitHub, GitLab, or Bitbucket account.

2.  **Import Your Project:**
    *   From the Vercel dashboard, click **"Add New..."** -> **"Project"**.
    *   Select the Git repository for the **Srpski AI Tutor** application.
    *   Vercel will automatically detect that it is a Vite project and configure the build settings correctly.

3.  **Configure Environment Variables:**
    *   In the project settings on Vercel, navigate to the **"Environment Variables"** section.
    *   This is where you will securely store all the API keys and URLs you have collected. Add the following variables:

| Variable Name | Description | Value |
| :--- | :--- | :--- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Frontend Key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk Backend Key | `sk_test_...` |
| `VITE_CONVEX_URL` | Convex Deployment URL | `https://...` |
| `PADDLE_API_KEY` | Paddle API Key | `...` |
| `PADDLE_WEBHOOK_SECRET` | Paddle Webhook Secret | `...` |
| `GEMINI_API_KEY` | Gemini API Key | `AIza...` |

    *   The `VITE_` prefix for the Clerk and Convex keys makes them available in the frontend (browser) environment. The other keys are only accessible in the backend environment (Vercel Serverless Functions or Convex functions).

---
''''

'''
## 3. Phase 2: Database Migration (TiDB to Convex)

This is the most critical phase. We will move all the data from the old TiDB database into our new Convex project. This involves defining the schema in Convex and then writing a script to read the CSV files and import the data.

### 3.1. Defining the Convex Schema

Convex uses a `schema.ts` file inside the `convex` directory to define the database tables and their fields. We need to translate our existing SQL schema into this format.

1.  **Open `convex/schema.ts`:** This file was created when you initialized Convex.
2.  **Define the Tables:** Based on the CSV files and the existing database structure, we will define each table. Convex uses a `defineTable` function and specifies fields with validators (e.g., `v.string()`, `v.number()`, `v.boolean()`, `v.optional()`).

Here is an example of how the `users` and `quizProgress` tables would be defined in `convex/schema.ts`:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // The 'users' table, mirroring the old structure
  users: defineTable({
    name: v.string(),
    email: v.string(),
    loginMethod: v.string(),
    role: v.string(),
    lastSignedIn: v.optional(v.string()), // Using string for ISO 8601 dates
    isActive: v.boolean(),
    totalXP: v.number(),
    level: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.optional(v.string()),
    isBetaTester: v.boolean(),
    clerkId: v.string(), // New field to link to Clerk user
  }).index("by_clerk_id", ["clerkId"]),

  // The 'quizProgress' table
  quizProgress: defineTable({
    userId: v.id("users"), // Link to the users table
    unitNumber: v.number(),
    currentIndex: v.number(),
    totalAttempts: v.number(),
    lastScore: v.number(),
    incorrectWordIds: v.string(), // Storing as JSON string
    lastAttemptAt: v.optional(v.string()),
  }).index("by_user_unit", ["userId", "unitNumber"]),

  // ... Define all other tables here (userProgress, vocabulary, etc.)
});
```

> **Note:** We have added a `clerkId` field to the `users` table. This is crucial for linking our database records to the users managed by Clerk. We also define indexes (`by_clerk_id`, `by_user_unit`) to make querying faster.

### 3.2. Creating the Data Migration Script

Now, we will create a script to read the data from the CSV files you provided and insert it into our Convex database. This script will be run locally.

1.  **Create the Script File:** In your project root, create a new file named `migrateToConvex.mjs`.

2.  **Add the Script Logic:** The script will connect to your Convex project, read each CSV, and use a Convex mutation to insert the data. We will need to install a CSV parsing library.

    ```bash
    npm install csv-parser
    ```

    Here is a template for the `migrateToConvex.mjs` script:

```javascript
// migrateToConvex.mjs
import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

// IMPORTANT: Run `npx convex run scheduler:importOldData` from your terminal
// This script is a template and the actual logic will be inside a Convex function

console.log("This script serves as a template.");
console.log("The actual migration logic should be placed inside a Convex action.");
console.log("Please see convex/migrations.ts for the implementation.");

```

3.  **Create the Convex Action for Migration:** It is best practice to run data migrations from within Convex itself to avoid exposing your admin key. We will create an "action" in Convex.

    *   Create a new file: `convex/migrations.ts`
    *   Add the following code. This action will read the data and insert it. For this to work, you would need to upload the CSVs to a location accessible by the Convex function or pass the data directly.

```typescript
// convex/migrations.ts
import { action } from "./_generated/server";
import { v } from "convex/values";

// NOTE: This is a simplified example. In a real scenario, you would fetch the CSV data
// from a secure URL or another source.

export const importUsers = action({
  args: { csvData: v.string() },
  handler: async (ctx, { csvData }) => {
    // Parse CSV data here (you would need a library or a simple parser)
    const rows = csvData.split("\n").slice(1); // Simple split, assumes no commas in values

    for (const row of rows) {
      const [id, name, email, /* ...other fields */] = row.split(",");
      
      // Check if user already exists by email
      const existingUser = await ctx.runQuery(api.users.getUserByEmail, { email });

      if (!existingUser) {
        await ctx.runMutation(api.users.createUser, {
          name,
          email,
          // ... map other fields
        });
      }
    }
    console.log(`Imported ${rows.length} users.`);
  },
});
```

### 3.3. Running the Migration

Once the schema and migration action are defined, you can run the migration.

1.  **Push the Schema to Convex:**

    ```bash
    npx convex push
    ```

2.  **Run the Migration Action:** You would invoke the action, passing the CSV data. This can be done from a simple script or directly from the Convex dashboard.

    ```bash
    # Example of running the action from the command line
    npx convex run migrations:importUsers --args '{\"csvData\": \"id,name,email...\"}'
    ```

This process needs to be repeated for each table, ensuring that tables with dependencies (like `quizProgress` which depends on `users`) are imported after their dependencies.

---
'''

## 4. Phase 3: Backend Refactoring (Express/tRPC to Convex)

With the data migrated, the next step is to move the backend logic from the existing tRPC endpoints into Convex queries and mutations. Convex functions are TypeScript files in the `convex` directory.

### 4.1. Understanding Convex Functions

Convex has three types of backend functions:

-   **Queries (`query`)**: Read-only functions to fetch data. They are fast and automatically cached.
-   **Mutations (`mutation`)**: Functions that write or modify data (create, update, delete).
-   **Actions (`action`)**: For running side effects, like calling third-party APIs (e.g., Gemini, Paddle). Actions can read and write data by calling queries and mutations.

### 4.2. Refactoring tRPC Endpoints

We need to go through each of the existing tRPC procedures in `server/routers.ts` and recreate them as Convex functions.

**Example: Refactoring `chat.sendMessage`**

The current tRPC endpoint for sending a chat message involves multiple steps: saving the user's message, calling the Gemini API, and then saving the AI's response. This is a perfect use case for a Convex **action**.

1.  **Create a `convex/chat.ts` file.**

2.  **Define the `sendMessage` action:**

```typescript
// convex/chat.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const sendMessage = action({
  args: { sessionId: v.id("chatSessions"), message: v.string() },
  handler: async (ctx, { sessionId, message }) => {
    // 1. Get user identity from Clerk
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User is not authenticated.");
    }

    // 2. Save the user's message to the database
    await ctx.runMutation(api.chat.internalSaveMessage, {
      sessionId,
      userId: identity.subject, // Clerk user ID
      role: "user",
      content: message,
    });

    // 3. Call the Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(message);
    const aiResponse = await result.response.text();

    // 4. Save the AI's response to the database
    await ctx.runMutation(api.chat.internalSaveMessage, {
      sessionId,
      userId: identity.subject,
      role: "assistant",
      content: aiResponse,
    });

    return aiResponse;
  },
});

// Internal mutation to save messages, not exposed to the client directly
export const internalSaveMessage = internalMutation({
  /* ... implementation ... */
});
```

This pattern would be repeated for all other backend logic, including:
-   Fetching user progress (`userProgress.get` -> Convex query).
-   Saving quiz answers (`vocabulary.saveQuizAnswer` -> Convex mutation).
-   Completing a quiz (`vocabulary.completeQuiz` -> Convex mutation).

### 4.3. Handling Authentication

Convex has built-in integration with Clerk. By configuring the Convex dashboard with your Clerk issuer URL and JWT endpoint, Convex can automatically authenticate users in every request. The `ctx.auth` object provides the user's identity.

---

## 5. Phase 4: Frontend Integration (Clerk & Convex)

With the backend logic migrated, we now update the frontend to use Clerk for authentication and Convex for data fetching.

### 5.1. Integrating Clerk in the Frontend

Clerk provides React components that make it easy to add sign-in, sign-up, and user profile management to the application.

1.  **Install Clerk React SDK:**

    ```bash
    npm install @clerk/clerk-react
    ```

2.  **Wrap the App in `ClerkProvider`:** In your main entry file (`client/src/main.tsx`), wrap the entire application with the `ClerkProvider`.

```tsx
// client/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

3.  **Add Sign-in and Sign-up Routes:** Use Clerk's components to create pages for authentication. You can use the `<SignIn />` and `<SignUp />` components to quickly build these pages.

4.  **Protect Routes:** Use the `<SignedIn>` and `<SignedOut>` components to control what users see based on their authentication state. For example, the dashboard should only be visible to signed-in users.

```tsx
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

function DashboardPage() {
  return (
    <>
      <SignedIn>
        {/* Render dashboard content here */}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
```

### 5.2. Integrating Convex in the Frontend

Next, we replace `trpc` with the Convex client for all data operations.

1.  **Install Convex React SDK:**

    ```bash
    npm install convex
    ```

2.  **Wrap the App in `ConvexProvider`:** In `client/src/main.tsx`, wrap the `ClerkProvider` with the `ConvexProvider` and configure it to use Clerk for authentication.

```tsx
// client/src/main.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/clerk-react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>
);
```

3.  **Replace tRPC Hooks with Convex Hooks:** Now, refactor all components that use `trpc` hooks (`useQuery`, `useMutation`) to use the corresponding Convex hooks (`useQuery`, `useMutation`, `useAction`).

**Example: Refactoring the Chat Component**

```tsx
// Before (tRPC)
const { data: messages } = trpc.chat.getMessages.useQuery({ sessionId });
const sendMessageMutation = trpc.chat.sendMessage.useMutation();

// After (Convex)
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

const messages = useQuery(api.chat.getMessages, { sessionId });
const sendMessage = useAction(api.chat.sendMessage);

const handleSend = () => {
  sendMessage({ sessionId, message: "Hello!" });
};
```

The key benefit here is that `useQuery` provides **real-time updates**. When new data is written to the database (e.g., a new chat message), the component will automatically re-render with the latest data without any need for manual refetching or polling.

---

## 6. Phase 5: Payment Integration (Paddle)

With the core application logic migrated, the final step is to integrate Paddle for handling subscriptions.

### 6.1. Paddle Checkout

Paddle.js provides a simple way to initiate a checkout process from the frontend.

1.  **Install Paddle.js:**

    ```bash
    npm install @paddle/paddle-js
    ```

2.  **Initialize Paddle:** In your frontend, initialize Paddle with your client-side token.

3.  **Trigger Checkout:** Create a button that, when clicked, opens the Paddle checkout overlay with the ID of the product you configured.

```tsx
import { initializePaddle, Paddle } from "@paddle/paddle-js";

// Initialize outside of your component
let paddle: Paddle | undefined;
initializePaddle({ token: "YOUR_CLIENT_SIDE_TOKEN" }).then(
  (paddleInstance) => (paddle = paddleInstance)
);

function SubscribeButton() {
  const handleSubscribe = () => {
    paddle?.Checkout.open({
      items: [{ priceId: "YOUR_PRICE_ID", quantity: 1 }],
    });
  };

  return <button onClick={handleSubscribe}>Subscribe Now</button>;
}
```

### 6.2. Handling Webhooks in Convex

To grant users access to premium features after they subscribe, we need to listen for webhooks from Paddle.

1.  **Create an HTTP Endpoint in Convex:** Convex allows you to create public HTTP endpoints. Create a file `convex/http.ts`.

2.  **Define the Webhook Handler:** This handler will verify the webhook signature and update the user's subscription status in the database.

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/paddle-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("paddle-signature")!;
    const rawBody = await request.text();

    // Verify webhook signature (implementation depends on Paddle library)
    // ...

    const event = JSON.parse(rawBody);

    if (event.event_type === "subscription.created") {
      const userId = event.data.custom_data.user_id;
      await ctx.runMutation(api.users.updateSubscription, {
        userId,
        status: "active",
      });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
```

---

## 7. Phase 6: Testing & Deployment

### 7.1. Local Development and Testing

-   Run the frontend and Convex backend locally using `npx convex dev`.
-   Thoroughly test all features: authentication, chat, quizzes, and the subscription flow (using Paddle's test mode).

### 7.2. Deployment to Vercel

-   Push your code to the `main` branch of your GitHub repository.
-   Vercel will automatically trigger a new deployment.
-   Ensure all environment variables are correctly set in the Vercel project settings.
-   Once the deployment is complete, your application will be live on a Vercel URL.

---

## 8. Phase 7: Further Development with Windsurf

Now that the application is on a modern, robust stack, future development is significantly streamlined. **Windsurf**, as an AI coding assistant integrated into your IDE, can accelerate this process.

### 8.1. What is Windsurf?

Windsurf is an AI tool that understands your codebase. It is not a framework that gets integrated into the application's architecture but rather a development tool that assists you in writing, refactoring, and debugging code. It works directly within your IDE (e.g., JetBrains IDEs, VS Code).

### 8.2. How to Use Windsurf for Future Development

After setting up Windsurf in your IDE, you can use it for tasks such as:

-   **Adding New Features:** Ask Windsurf to create a new feature based on a high-level description. For example: "Create a new page that shows user statistics, including total XP and completed units."
-   **Refactoring Code:** Improve existing code by asking Windsurf to refactor it. For example: "Refactor this React component to use Tailwind CSS for styling instead of inline styles."
-   **Writing Convex Functions:** Accelerate backend development. For example: "Write a Convex query to fetch the top 10 users with the highest total XP."
-   **Debugging:** When you encounter a bug, you can ask Windsurf to analyze the code and suggest a fix.

By leveraging Windsurf, you can significantly reduce development time and focus more on the creative aspects of building new features for the **Srpski AI Tutor**.

---

## 9. Conclusion

This migration, while involving several steps, will result in a far more powerful, scalable, and maintainable application. The combination of Clerk, Convex, Paddle, and Vercel provides a best-in-class foundation for the future of the **Srpski AI Tutor**. The addition of Windsurf to your development workflow will further enhance your ability to iterate and improve the product quickly.
