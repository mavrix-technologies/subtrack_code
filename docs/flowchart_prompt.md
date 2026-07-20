# SubTrack AI — Complete Flowchart Generation Prompt

Copy the prompt below to send to ChatGPT / GPT models to generate advanced flowcharts or diagrams.

---

```text
Please construct a highly detailed, production-grade system flowchart for my mobile/web application, SubTrack AI (Intelligent Subscription & Expense Management System). Below are the exact system specifications, roles, login processes, data flows, features, and database integration loops.

### 1. APPLICATION STACK CONTEXT
- Frontend: Expo SDK 54, React Native Paper, Zustand (State Management), Expo Notifications (Local push scheduling), Expo Print (PDF generator).
- Backend: Firebase Authentication, Cloud Firestore (NoSQL database), Vercel Serverless Functions (Node.js runtime hosting API endpoints).
- AI Engine: Google Gemini 2.5 Flash API (hidden behind Vercel functions for security).

---

### 2. ACTORS & USER ROLES
1. GUEST (Anonymous User):
   - Auth Method: Temporary Firebase Anonymous sign-in session.
   - Database Scope: Firestore `users/{uid}/` subcollections.
   - Access Constraints: Can add subscriptions, use the AI Chatbot, and preview PDF invoices. Must be prompted to link their account to Google/Apple to prevent data loss.
2. SUBSCRIBER (Authenticated User):
   - Auth Method: Social Sign-In (Google/Apple Auth).
   - Database Scope: Firestore `users/{uid}/` subcollections with real-time listeners.
   - Access Constraints: Full access to Dashboard, CRUD operations, AI Assistant, Expenses/Split Ledgers, and PDF Invoice Generation.
3. ADMINISTRATOR (System Admin):
   - Auth Method: Secure dedicated admin credentials.
   - Access Constraints: Dashboard showing global platform metrics, remote configuration banners, PDF Invoice template editor, program settings, and administrative logs.

---

### 3. COMPLETE PROCESS FLOW (START TO END)

#### PHASE 1: INITIALIZATION & AUTHENTICATION CHECK (START)
1. Start App -> Read local state using Zustand & check AsyncStorage.
2. Decision Gate: [Is User Logged In?]
   - YES (Auth token exists):
     - Decision Gate: [Is User Admin?]
       - YES ──► Route to Admin Dashboard.
       - NO ──► Establish Firestore Real-Time Sync on `users/{uid}/` collections ──► Route to User Dashboard.
   - NO (No token):
     - Display Login Screen:
       - Option A: Google / Apple Auth ──► Firebase Auth SDK verification ──► Create new or load existing Profile ──► Route to User Dashboard.
       - Option B: Try Anonymously ──► Generate Firebase Anonymous UID ──► Initialize empty local profile ──► Route to User Dashboard.

---

#### PHASE 2: SYSTEM INTERFACE & ROUTING (DASHBOARD)
Once logged in, the app establishes a real-time Firestore database connection (Zustand listener). The User Dashboard acts as the primary command router:
- Displays total recurring monthly expenses.
- Renders a category pie chart (Entertainment, Utilities, SaaS, Finance).
- Displays upcoming renewals sorted by closest billing date.
- Offers three parallel action paths (Path A, Path B, Path C).

---

#### PHASE 3: FEATURE EXECUTION PATHS

##### PATH A: MANUAL SUBSCRIPTION MANAGEMENT
1. Open Subscription List.
2. Select Action:
   - Add/Edit Subscription:
     - User inputs: Service Name, Price, Currency (INR/USD), Billing Cycle (Monthly/Yearly), Next Billing Date, Category.
     - User toggles: [Reminders Enabled?]
       - YES ──► Select Lead Days (1, 3, or 5 days before renewal).
     - Save to Firestore collection `users/{uid}/subscriptions/{subId}`.
     - Database triggers local Zustand state sync.
     - System triggers `expo-notifications` scheduler to set local push notifications based on selected Lead Days.
   - Delete Subscription:
     - User selects Delete on card.
     - Firestore deletes record at `users/{uid}/subscriptions/{subId}`.
     - Local state updates; system cancels scheduled push notification for that ID.

##### PATH B: AI ASSISTANT PIPELINE (INTELLIGENT PARSING)
1. Open Chatbot Console.
2. Select Input Mode:
   - Mode 1: Voice / Text Prompt (e.g., "Netflix 199 per month starting tomorrow"):
     - Client packages string and sends POST request to `/api/reminders/parse`.
   - Mode 2: Bill Receipt / Invoice Snapshot (OCR):
     - Client opens camera/gallery -> encodes image to base64.
     - Client packages payload and sends POST request to `/api/reminders/parse-document`.
3. Vercel Serverless Function processes the request, securely passes credentials, and calls Gemini 2.5 Flash API.
4. Gemini extracts: `name`, `price`, `billingCycle`, `nextBillingDate`, `category`, and returns a structured JSON object.
5. Client app receives JSON and displays the "AI Extract Preview Dialog".
6. Decision Gate: [Does User Confirm Extracted Details?]
   - NO ──► Open manual form pre-filled with extracted data ──► User adjusts fields ──► Save to Firestore.
   - YES ──► Save directly to Firestore ──► Trigger Zustand sync and schedule local notification.

##### PATH C: EXPENSES & SPLIT BILLING
1. Open Expenses Screen.
2. Select Feature:
   - Split Bill:
     - Input expense metadata: Amount, Name, Date, Category.
     - Select friends/participants and define splitting model (Split Evenly or Custom Percentages).
     - Save transaction log to Firestore collection `users/{uid}/expenses/`.
   - Compile PDF Invoice:
     - Input Client Name, line items (SaaS subscriptions to bill), tax rate, discounts.
     - Upload custom company logo and sign-off signature image.
     - System processes data through HTML template using Expo Print engine.
     - Compiles printable PDF document.
     - Opens native OS Share Sheet (native print/sharing dialogue).

---

#### PHASE 4: DISCONNECT & EXIT STATE (STOP)
1. User clicks LogOut button.
2. System performs cleanup:
   - Cancels all active Firestore real-time listeners.
   - Clears Zustand local memory cache.
   - Flushes credentials from AsyncStorage.
3. Redirect user back to initial Login Screen.
4. End session (Stop).
```
