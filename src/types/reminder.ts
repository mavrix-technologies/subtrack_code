export type ReminderCategory =
  | 'travel'
  | 'subscription'
  | 'utility'
  | 'work'
  | 'health'
  | 'education'
  | 'family'
  | 'personal'
  | 'finance';

export type ReminderType =
  | 'flight'
  | 'meeting'
  | 'medicine'
  | 'bill'
  | 'subscription'
  | 'task'
  | 'exam'
  | 'travel'
  | 'event';

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReminderSource = 'text' | 'image' | 'pdf' | 'voice' | 'manual' | 'fallback';

export type ReminderLead = {
  label: string;
  minutesBefore: number;
};

export type ReminderDraft = {
  title: string;
  type: ReminderType;
  category: ReminderCategory;
  datetime: string | null;
  location: string | null;
  notes: string | null;
  repeat: ReminderRepeat;
  source: ReminderSource;
  confidence: number;
  smartReminders: ReminderLead[];
};

export type Reminder = ReminderDraft & {
  id: string;
  userId: string;
  status: 'active' | 'done' | 'dismissed';
  notificationIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};
