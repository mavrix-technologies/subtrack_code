# M.Sc. (CA & IT) — Semester III
## Subject: P23A4IP1 – Industrial Project - I
### Project Title: SubTrack AI — Intelligent Subscription & Expense Management System

---

## TITLE PAGE
* **Project Title:** SubTrack AI (Intelligent Subscription & Expense Management System)
* **Submitted By:**
  * Group No: 15
  * Patel Satvik Yogeshkumar (22082221152)
  * Patel Umang Nileshkumar (22082221154)
* **Course:** M.Sc. (CA & IT) – Semester III
* **Subject:** P23A4IP1 – Industrial Project - I
* **Guided By:** Mrs. Pravina Patel
* **Submitted To:**
  * Department of Computer Science, Ganpat University (GUNI), Ganpat Vidyanagar - 384012
  * Academic Year 2026-2027
  * Date: July 2026

---

## CERTIFICATE
### TO WHOM SO EVER IT MAY CONCERN

This is to certify that the following students of M.Sc. (CA & IT) Semester-III have completed their project work titled “SubTrack AI” satisfactorily and fulfill the requirements of M.Sc. (CA&IT) Semester-III, Department of Computer Science, Ganpat University in the academic year 2026-2027.

| Sr. No. | Student Name | Enrollment No. |
| :--- | :--- | :--- |
| **1.** | Patel Satvik Yogeshkumar | 22082221152 |
| **2.** | Patel Umang Nileshkumar | 22082221154 |

**Signatures:**
* **Internal Guide:** Mrs. Pravina Patel
* **Project Coordinator:** Prof. Asha Patel
* **Program Coordinator:** Dr. Ketan Patel
* **Principal:** Dr. Nirbhay Chaubey

---

## ACKNOWLEDGEMENT
This project, “SubTrack AI”, is the tangible result of practical work undertaken at the Department of Computer Science, Ganpat University. It is a delightful task to acknowledge the positive efforts that have been transformed into tangible outcomes. We extend our deep gratitude to Mrs. Pravina Patel, whose guidance played a crucial role in the completion of this project.

We are thankful to Mrs. Pravina Patel for entrusting us with this project and offering her best wishes. Special appreciation goes to our guide, Mrs. Pravina Patel, for steadfastly supporting us throughout the journey. Without her unwavering support and guidance, this work would not have been possible.

Our sincere thanks are also extended to all the staff members of IT Souls DCS, Ganpat University for providing valuable information and assistance that proved essential in the development of this project.

In conclusion, we express our heartfelt gratitude to all those whose ideas have contributed to the preparation of this project.

*Yours sincerely,*
* Patel Satvik
* Patel Umang

---

## PREFACE
The journey of creating SubTrack AI (Intelligent Subscription & Expense Management System) has been a remarkable confluence of academic rigor, practical application, and a commitment to addressing real-world challenges. This project represents the synthesis of theoretical foundations with hands-on experience, reflecting the dynamic intersection of knowledge and innovation.

Every significant achievement is the result of collective efforts, and this project is no exception. It stands as a testament to the collaboration, mentorship, and support that have been instrumental in bringing this vision to life. At the heart of this endeavor lies the invaluable guidance of Mrs. Pravina Patel, whose mentorship has been a guiding light throughout this journey. Her expertise and encouragement have not only enriched the technical dimensions of the project but have also instilled in us a deep sense of perseverance and dedication.

We extend our heartfelt gratitude to all individuals who have contributed to the realization of this project, either directly or indirectly. Their insights, support, and encouragement have played a vital role in overcoming challenges and achieving milestones.

This work is a reflection of the academic spirit at DCS, Ganpat University, where learning and innovation go hand in hand. As we present SubTrack AI, we invite you to explore the intricacies of this project and join us in celebrating the collective effort that has made it possible.

*Team SubTrack AI*

---

## CONTENTS
| Sr. No | Particulars | Page No |
| :--- | :--- | :--- |
| **1** | Project Profile | 1 |
| **2** | Existing System | 2 |
| **3** | Need for New System | 3 |
| **4** | Functional Module Specification | 4 |
| **5** | System Requirements | 6 |
| **6** | System Flowchart | 8 |
| **7** | E-R Diagram | 10 |
| **8** | Data Flow Diagram | 11 |
| **9** | Data Dictionary | 13 |
| **10** | Input Design | 18 |
| **11** | Output Design | 22 |
| **12** | Testing | 26 |
| **13** | Future Enhancement | 30 |
| **14** | Bibliography | 31 |

---

## 1. PROJECT PROFILE
* **Project Title:** SubTrack AI
* **Platform of Application:** Cross-Platform Mobile & Web Application (Android, iOS, Web)
* **Front End Tool:** React Native, Expo SDK 54, React Native Paper, Zustand
* **Back End Tool:** Node.js, Firebase Auth, Cloud Firestore, Vercel Serverless Functions
* **Other Tool:** Visual Studio Code, GitHub, Postman, EAS CLI
* **Time Duration:** 180 Days
* **Internal Project Guide:** Mrs. Pravina Patel
* **Developed By:** Patel Satvik (22082221152), Patel Umang (22082221154)
* **Submitted To:** Department of Computer Science (DCS), Ganpat University

---

## 2. EXISTING SYSTEM
Currently, subscription and recurring cost tracking are handled through legacy, fragmented methods. Most users rely on manual spreadsheets, calendar reminders, or wait for SMS/email alerts from banks. The primary service in existing applications focuses solely on general expense recording without specializing in subscription dynamics.

### Limitations of the Existing System:
1. **Manual Overhead:** Users must manually enter every subscription billing date, price, and category.
2. **Retroactive Notifications:** Bank alerts are sent only *after* money has been deducted, leading to accidental renewals.
3. **Lacks Natural Language Input:** No existing application provides conversational parsing (Hinglish/Hindi/English) or document/receipt scanning to automate entries.
4. **No Integrated Billing / Invoicing:** Freelancers and professional users cannot quickly split subscription costs with friends or compile professional invoices for business tax claims in the same app.

---

## 3. NEED FOR NEW SYSTEM
SubTrack AI is designed to address subscription fatigue and manual tracking errors through automated intelligence. It acts as a proactive management portal that coordinates data between the user, their receipts, and upcoming billing schedules.

### Key Benefits of the New System:
1. **AI-Powered Input:** Natural language processing parses multi-lingual commands (Hinglish, Hindi, Gujarati, English) like *"Netflix ka 199 ka plan kal renew hoga"* and automatically configures subscriptions.
2. **Multimodal Receipt OCR:** Users upload invoice/receipt photos directly, and the AI extracts billing dates, plan names, prices, and categories.
3. **Local Push Alerts:** Local scheduler triggers notification alerts at configurable intervals (1, 3, or 5 days before renewal) without relying on permanent internet connections.
4. **Joint Billing & Splits:** Built-in splitting algorithms allow co-living mates to divide software and utility costs smoothly.
5. **Invoice PDF Compiler:** Instant compilation of expenses into clean, professional PDF invoices ready to share or print.

---

## 4. FUNCTIONAL MODULE SPECIFICATION
The SubTrack AI system consists of three main modules: User, AI Assistant, and Admin.

### 4.1 User of the System
1. **Subscriber (Primary User):**
   * **Authentication:** Logs in securely using Google, Apple, or Anonymous Auth.
   * **Dashboard:** Views analytics, total monthly spending, and countdowns of upcoming renewals.
   * **CRUD Subscriptions:** Adds, edits, or deletes subscriptions manually.
   * **Split Expenses:** Creates expense logs, tags friends, and selects splitting models.
   * **Invoices:** Input billing data, upload logos, and download business-ready PDF invoices.
2. **Shared Members (Friends):**
   * Receives split breakdowns and status updates.
3. **AI Chatbot:**
   * Interacts with primary users to translate text/voice/images into structured entries.

### 4.2 Modules of the System
1. **Authentication Module:** Secure, single-tap authentication including account merging (Anonymous to Social).
2. **Subscription Tracker Module:** Interactive card lists, category filters, custom styling colors, and renewal reminders.
3. **AI Assistant Module:** Integrates Gemini API via serverless backend to process Hinglish voice/text or uploaded receipt snapshots.
4. **Split & Billing Module:** Calculates splits, logs transaction history, and handles receipt attachments.
5. **Invoice Branding Module:** Custom business parameters (taglines, logos, signatures) compiled into downloadable PDF invoices.

---

## 5. SYSTEM REQUIREMENT

### 5.1 Minimum Software Requirements
| Requirement Component | Details |
| :--- | :--- |
| **Operating System** | Windows 10/11, macOS, Android (8.0+), iOS (13.0+) |
| **Frontend Technology** | React Native (0.81.5), Expo SDK (54), React Native Paper (5.15.1) |
| **State Management** | Zustand (5.0.13) |
| **Database Backend** | Google Cloud Firestore (NoSQL) |
| **Serverless / AI API** | Vercel Functions (Node.js runtime), Google Gemini 2.5 Flash API |

### 5.2 Minimum Hardware Requirements
| Hardware | Server Side Requirement | Client Side Requirement |
| :--- | :--- | :--- |
| **Processor** | Vercel Serverless Core vCPU (Shared) | Dual-core 2.0 GHz or higher mobile SoC |
| **RAM** | N/A (Managed Serverless) | 2 GB minimum (4 GB recommended) |
| **Storage** | N/A (Managed Firestore) | 50 MB free installation space |
| **Display / Resolution** | N/A | 720x1280 pixels minimum |
| **Network** | Broadband internet connection | 4G/5G mobile connection or Wi-Fi |

---

## 6. SYSTEM FLOWCHART
The system flowchart describes the operational flow of SubTrack AI. It maps the user onboarding process, main subscription tracking operations, and the AI Assistant sub-flow that processes text and image parsing.

### Core System Flow Steps:
* **Step 1:** User Launches App -> Checks role configuration (is admin, is subscriber).
* **Step 2:** If admin: logs in to access Admin dashboard options (manage banners, templates, monitor performance).
* **Step 3:** If subscriber: logs in to access Subscriber options (manage subscriptions, AI parser, split expenses, generate PDF invoices).
* **Step 4:** From any menu, the user can log out, which signs them out and terminates active operations.

### Tree-Based Flowchart Representation:
- 🏁 **Start Application**
  - ├── 👤 **is admin**
    - ├── 🟢 **YES** ──► **Login**
      - └── 📁 **Admin Operations:**
        - ├── 📊 Dashboard
        - ├── 📢 Manage Banners
        - ├── 📝 Manage Templates
        - ├── 📈 Monitor Performance
        - └── 🔑 Change Password
    - └── 🔴 **NO**
      - └── 👤 **is subscriber**
        - ├── 🟢 **YES** ──► **Login**
          - └── 📁 **Subscriber Operations:**
            - ├── 📊 Dashboard
            - ├── 📝 Manage Subscriptions
            - ├── 🤖 AI Chatbot Parser
            - ├── 👥 Split Expense
            - └── 📄 Generate PDF Invoice
        - └── 🔴 **NO** ──► 🏁 **Stop**
  - └── 🚪 **LogOut** (from any operation menu) ──► 🏁 **Stop**




---

## 7. E-R DIAGRAM
The Entity-Relationship (E-R) diagram represents the logical schema of SubTrack AI database. Since the backend is built on Firebase Cloud Firestore, the relationships model user-scoped subcollections that ensure high isolation and simple security rules:

### Entities and Attributes:
1. **USER (Primary Entity)**
   * Attributes: `uid` (PK), `name`, `email`, `photoURL`, `createdAt`, `updatedAt`
2. **SUBSCRIPTION (Weak Entity, User-Scoped)**
   * Attributes: `subscriptionId` (PK), `name`, `price`, `billingCycle`, `nextBillingDate`, `category`, `icon`, `color`, `currency`, `remindersEnabled`, `reminderDays`, `userId` (FK)
3. **EXPENSE (Weak Entity, User-Scoped)**
   * Attributes: `expenseId` (PK), `name`, `amount`, `date`, `category`, `isSplit`, `splitType`, `participants`, `userId` (FK)
4. **INVOICE (Weak Entity, User-Scoped)**
   * Attributes: `invoiceId` (PK), `invoiceNumber`, `clientName`, `subtotal`, `taxAmount`, `total`, `balanceDue`, `status`, `userId` (FK)
5. **REMINDER (Weak Entity, User-Scoped)**
   * Attributes: `reminderId` (PK), `title`, `type`, `category`, `datetime`, `repeat`, `userId` (FK)
6. **ASSISTANT_SESSION (Weak Entity, User-Scoped)**
   * Attributes: `sessionId` (PK), `title`, `messages`, `updatedAt`, `userId` (FK)

### Relationships:
* **1 User** owns **0..N Subscriptions** (1-to-Many)
* **1 User** logs **0..N Expenses** (1-to-Many)
* **1 User** generates **0..N Invoices** (1-to-Many)
* **1 User** schedules **0..N Reminders** (1-to-Many)
* **1 User** initiates **0..N Assistant Sessions** (1-to-Many)

---

## 8. DATA FLOW DIAGRAM

### 8.1 Data Flow Diagram (Level 0 - Context Diagram)
The Level 0 DFD captures the boundaries of SubTrack AI, displaying inputs and outputs between the main system and external actors:
* **User:** Inputs credentials, prompt texts, receipt images, and manual subscription parameters. Receives push notifications, visual spend charts, and exported PDF invoices.
* **Gemini API:** Receives raw prompt text or base64 receipt images. Outputs structured JSON matching billing parameters.
* **Firebase Auth:** Receives login requests. Outputs verified user tokens.
* **Firestore Database:** Receives CRUD data updates. Outputs saved records.

### 8.2 First Level DFD (User & AI Pipeline)
The Level 1 DFD shows internal functional processes:
* **Process 1.0 (Authenticate User):** Handles Google, Apple, and Anonymous sign-in tokens.
* **Process 2.0 (Manage Subscriptions):** Coordinates reading, saving, and deleting subscription lists.
* **Process 3.0 (AI Prompt Parser):** Forwards text/receipt images to Vercel API and triggers Gemini parsing.
* **Process 4.0 (Manage Split Expenses):** Processes bill splits and records transaction amounts.
* **Process 5.0 (Compile Invoices):** Converts custom templates and parameters into printable PDF invoices.
* **Process 6.0 (Schedule Notifications):** Monitors date changes and invokes local mobile alerts.

---

## 9. DATA DICTIONARY

### 9.1 Table: USERS
* Primary Key: `uid`
* Foreign Key: `-`
* Description: Stores authenticated user profile details

| Column Name | Data Type | Size | Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| **uid** | Varchar | 50 | Primary Key | Unique identifier from Firebase Auth |
| **name** | Varchar | 100 | Not Null | Full name of the user |
| **email** | Varchar | 100 | Unique | Registered email address |
| **photoURL** | Text | - | Null | URL of user avatar image |
| **createdAt** | Timestamp | - | Not Null | Creation date of the user record |
| **updatedAt** | Timestamp | - | Not Null | Last update timestamp |

### 9.2 Table: SUBSCRIPTIONS
* Primary Key: `subscriptionId`
* Foreign Key: `userId`
* Description: Stores individual user subscription details

| Column Name | Data Type | Size | Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| **subscriptionId** | Varchar | 50 | Primary Key | Auto-generated UUID |
| **userId** | Varchar | 50 | Foreign Key | Reference to the owning user's uid |
| **name** | Varchar | 100 | Not Null | Name of subscription service (e.g. Netflix) |
| **price** | Double | - | Not Null | Billing cost |
| **billingCycle** | Varchar | 20 | Not Null | monthly or yearly cycle |
| **nextBillingDate** | Varchar | 30 | Not Null | ISO date string of next renewal |
| **category** | Varchar | 30 | Not Null | Entertainment, Utilities, SaaS, etc. |
| **currency** | Varchar | 10 | Not Null | INR, USD, etc. (Default: INR) |
| **status** | Varchar | 20 | Not Null | active or paused status |
| **remindersEnabled** | Boolean | - | Not Null | True if alerts should trigger |
| **reminderDays** | Int | - | Not Null | Number of lead days for reminder alerts |

### 9.3 Table: EXPENSES
* Primary Key: `expenseId`
* Foreign Key: `userId`
* Description: Stores expense and split logs

| Column Name | Data Type | Size | Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| **expenseId** | Varchar | 50 | Primary Key | Auto-generated UUID |
| **userId** | Varchar | 50 | Foreign Key | Reference to the owner user's uid |
| **name** | Varchar | 100 | Not Null | Expense description |
| **amount** | Double | - | Not Null | Total expense value |
| **date** | Varchar | 30 | Not Null | ISO date string |
| **category** | Varchar | 30 | Null | Expense category label |
| **isSplit** | Boolean | - | Not Null | True if shared with friends |
| **splitType** | Varchar | 20 | Null | equal or custom split types |
| **participants** | Text | - | Null | List of participant IDs and split amounts |

### 9.4 Table: INVOICES
* Primary Key: `invoiceId`
* Foreign Key: `userId`
* Description: Stores generated PDF billing invoices

| Column Name | Data Type | Size | Constraint | Description |
| :--- | :--- | :--- | :--- | :--- |
| **invoiceId** | Varchar | 50 | Primary Key | Auto-generated UUID |
| **userId** | Varchar | 50 | Foreign Key | Reference to user's uid |
| **invoiceNumber** | Varchar | 30 | Not Null | Unique business invoice counter |
| **clientName** | Varchar | 100 | Not Null | Billed client name |
| **subtotal** | Double | - | Not Null | Total before taxes and discounts |
| **taxRate** | Double | - | Not Null | Applied tax rate percentage |
| **taxAmount** | Double | - | Not Null | Calculated tax amount |
| **total** | Double | - | Not Null | Grand total (Subtotal + Tax - Discount) |
| **status** | Varchar | 20 | Not Null | draft, unpaid, paid, overdue, cancelled |
| **date** | Varchar | 30 | Not Null | Date of invoice generation |

---

## 10. INPUT DESIGN

### LOGIN PAGE
* **Description:** This page facilitates user authentication. It features single-tap sign-in buttons for Google and Apple authentication, as well as an option to log in anonymously. If there are network errors or authentication handshake failures, the page displays a non-intrusive error snackbar or local alert dialog. Anonymous users have access to all modules, and their temporary credentials are cached in AsyncStorage.

### ADD SUBSCRIPTION FORM
* **Description:** A manual entry form that provides fields to add a new subscription. It contains validations: the subscription name cannot be blank, the price must be a valid positive number, and the next billing date must be selected using the DatePicker. Toggle switches enable or disable push reminders, and picker dropdowns specify category and lead reminder days (1, 3, or 5 days before).

### AI ASSISTANT CHAT SCREEN
* **Description:** The main conversation portal for the AI Assistant. It contains a bottom text input box where users can type freeform text (English, Hindi, or Hinglish) and a microphone icon to record audio transcripts. Additionally, it contains an attachment icon that triggers the device's camera or photo library. The form validates that the message is not empty and that uploaded images do not exceed size limit constraints (typically 5 MB).

### ADD EXPENSE / SPLIT FORM
* **Description:** Form used to record individual expenses. It includes fields for Name, Amount, and Date. A toggle switch activates Split Mode. When enabled, list fields appear to add participant names and emails, along with options to select the split model (Split Evenly or Custom Percentages).

---

## 11. OUTPUT DESIGN

### DASHBOARD / HOME PAGE
* **Description:** Displays the user's current subscription financial status. It outputs a total monthly cost summary, a visual pie chart depicting the cost breakdown by category (SaaS, Entertainment, Utilities, etc.), and a chronological card list showing upcoming subscriptions sorted by next billing date. High-contrast indicators warn users if a renewal occurs within the next 48 hours.

### AI EXTRACT PREVIEW DIALOG
* **Description:** Following Gemini parsing, the system generates a modal dialog detailing the extracted parameters (Name, Price, Billing Cycle, Next Billing Date). This serves as a validation output where fields are filled, allowing the user to audit the AI's performance. The user click triggers save approval.

### INVOICE PDF EXPORT
* **Description:** Generates a clean, letter-sized PDF document using the Expo Print engine. The output layout follows a professional invoice template containing: Business Name, Logo, Client Details, Table of Items (SaaS lines), subtotal, tax calculations, discounts, notes, and a digital signature image. Users can print or share it via the native OS sharing drawer.

---

## 12. TESTING

### MODULE: Authentication
| No. | Test Condition | Description | Expected Result | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Login with Google Auth | Provide valid Google sign-in credentials | Successful sign-in and sync | Successfully logged in and synced | Pass |
| **2** | Login Anonymously | Click 'Try Anonymously' option | Assign temporary Firebase uid and load dashboard | Temporary profile loaded successfully | Pass |
| **3** | Anonymous Account Merging | Link existing anonymous account to Google credentials | Link profiles and retain subscription history | Account linked successfully | Pass |

### MODULE: Subscription Management
| No. | Test Condition | Description | Expected Result | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Add Subscription with empty name | Leave name blank, provide price and date | Validation error: Name required | Showed 'Name cannot be blank' toast | Pass |
| **2** | Add Subscription with negative price | Provide negative value in price input | Validation error: Price must be positive | Showed 'Invalid price value' alert | Pass |
| **3** | Add Subscription successfully | Provide valid parameters and save | Write record to Firestore and trigger local notification timer | Subscription saved and alert scheduled | Pass |
| **4** | Delete Subscription | Click delete button on specific subscription card | Remove record from Firestore and cancel scheduled local notification | Record removed, notification deleted | Pass |

### MODULE: AI Assistant Parser
| No. | Test Condition | Description | Expected Result | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Parse simple Hinglish text prompt | Input: *"Netflix ka plan 199 ka kal starts होगा"* | Extract: Netflix, Price 199, Date tomorrow, Cycle monthly | Extracted Netflix, 199, tomorrow's date | Pass |
| **2** | Parse incomplete prompt text | Input: *"Netflix subscription"* | Extract Netflix, prompt user for price/date | Extracted Netflix, prompted for price and date | Pass |
| **3** | Parse invoice receipt image | Upload JPG image containing SaaS billing invoice | Perform OCR, send parameters to Vercel API, extract JSON details | Parsed image and populated preview dialog | Pass |

### MODULE: Expenses & Invoices
| No. | Test Condition | Description | Expected Result | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Split expense evenly | Amount 600, split with 2 friends (total 3) | Calculate 200 per participant | Split calculated: 200 each | Pass |
| **2** | Generate PDF Invoice successfully | Provide client name, billing items, and custom logo | Compile PDF and open OS share sheet | PDF generated and opened share sheet | Pass |

---

## 13. FEATURE ENHANCEMENT
In the future, we can add the following features to extend the capabilities of SubTrack AI:
1. **Automated Bank SMS Reader:** Request permission to parse incoming SMS notifications from banks, enabling automatic logging of subscriptions immediately after deduction.
2. **Shared Group Vaults:** Allow family members or co-living roommates to view a shared database of subscriptions, with an in-app ledger tracking split payments.
3. **Predictive Budgeting:** Integrate machine learning algorithms to analyze cost trends and alert users regarding projected price increases or total annual cost forecasts.

---

## 14. BIBLIOGRAPHY
1. React Native Documentation: [www.reactnative.dev](https://www.reactnative.dev)
2. Expo Documentation: [www.expo.dev](https://www.expo.dev)
3. Google Firebase Documentation: [www.firebase.google.com](https://www.firebase.google.com)
4. Google Gemini API Documentation: [ai.google.dev](https://ai.google.dev)
5. StackOverflow Developer Forum: [www.stackoverflow.com](https://www.stackoverflow.com)
6. W3Schools Web Tutorial: [www.w3schools.com](https://www.w3schools.com)
