# Firestore Database Structure

SubTrack uses a user-scoped Firestore model. User-owned app data lives under the authenticated user's document so reads, writes, rules, and future exports all have the same ownership boundary.

## Collections

```text
users/{uid}
  name: string
  email: string
  photoURL: string
  createdAt: Timestamp
  updatedAt: Timestamp

users/{uid}/subscriptions/{subscriptionId}
  userId: string
  name: string
  price: number
  billingCycle: "monthly" | "yearly"
  nextBillingDate: ISO date string
  category: string
  icon: string
  color: string
  currency: "INR"
  planName?: string
  notes?: string
  status?: "active" | "paused"
  remindersEnabled?: boolean
  reminderDays?: number
  reminderCustomDate?: ISO date string
  createdAt: Timestamp
  updatedAt: Timestamp

users/{uid}/expenses/{expenseId}
  userId: string
  name: string
  amount: number
  date: ISO date string
  category?: string
  notes?: string
  isSplit?: boolean
  splitType?: "equal" | "custom"
  participants?: array
  createdAt: Timestamp

users/{uid}/invoices/{invoiceId}
  userId: string
  invoiceNumber: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  clientAddress?: string
  items: array
  subtotal: number
  taxRate: number
  taxAmount: number
  discountType: "flat" | "percent"
  discountValue: number
  discountAmount: number
  total: number
  amountPaid: number
  balanceDue: number
  status: "draft" | "unpaid" | "paid" | "overdue" | "cancelled"
  source: "manual" | "expense"
  linkedExpenseId?: string
  notes?: string
  terms?: string
  date: ISO date string
  dueDate?: ISO date string
  payments: array
  createdAt: Timestamp

users/{uid}/preferences/{preferenceId}
  user-owned small settings documents, such as app preferences or invoice branding

users/{uid}/preferences/app
  currencyCode?: string
  theme?: "light" | "dark"
  updatedAt: Timestamp

users/{uid}/preferences/invoiceBrand
  businessName?: string
  tagline?: string
  logoUri?: string
  signatureUri?: string
  signatureLabel?: string
  filePrefix?: string
  updatedAt: Timestamp

users/{uid}/preferences/assistant
  geminiApiKey?: string | null
  updatedAt: Timestamp

users/{uid}/reminders/{reminderId}
  userId: string
  title: string
  type: "flight" | "meeting" | "medicine" | "bill" | "subscription" | "task" | "exam" | "travel" | "event"
  category: "travel" | "subscription" | "utility" | "work" | "health" | "education" | "family" | "personal" | "finance"
  datetime: ISO date-time string | null
  location: string | null
  notes: string | null
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly"
  alertMode?: "sound" | "alarm"
  confidence: number
  smartReminders: array
  status: "active" | "done" | "dismissed"
  notificationIds: array
  createdAt: Timestamp
  updatedAt: Timestamp

users/{uid}/assistantSessions/{sessionId}
  userId: string
  title: string
  messages: array
  updatedAt: number
  createdAt: number
```

## Query Plan

Current realtime listeners use ordered subcollection queries:

- `users/{uid}/subscriptions`: `orderBy(nextBillingDate, asc)`
- `users/{uid}/expenses`: `orderBy(date, desc)`
- `users/{uid}/invoices`: `orderBy(createdAt, desc)`
- `users/{uid}/reminders`: `orderBy(datetime, asc)`
- `users/{uid}/assistantSessions`: `orderBy(updatedAt, desc)`

`firestore.indexes.json` also includes composite indexes for planned filters:

- subscriptions by `status + nextBillingDate`
- subscriptions by `category + nextBillingDate`
- expenses by `category + date`
- expenses by `isSplit + date`
- invoices by `status + createdAt`
- invoices by `source + createdAt`
- invoices by `status + dueDate`

## Rules

Security rules enforce that:

- A user can read and update only `users/{uid}` where `request.auth.uid == uid`.
- App documents under `users/{uid}` must carry `userId == uid`.
- Updates cannot move a document to another owner.
- User preferences are scoped by path ownership.
- Currency, theme, and invoice branding are saved to Firestore preferences with `AsyncStorage` as the local startup cache.

## Deployment

Deploy rules and indexes together:

```bash
firebase deploy --only firestore
```

Existing data in legacy top-level collections should be migrated into the new user subcollections before removing any old production data.
