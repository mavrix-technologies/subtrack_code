import { ReminderDraft, ReminderLead, ReminderSource } from '@/types/reminder';

type ParseInput = {
  text: string;
  source?: ReminderSource;
  imageBase64?: string;
  mimeType?: string;
  now?: Date;
};

const AI_ASSISTANT_API_URL = process.env.EXPO_PUBLIC_AI_ASSISTANT_API_URL;

const defaultLeads: ReminderLead[] = [{ label: 'At time', minutesBefore: 0 }];

function toIsoDateTime(date: Date, hours = 9, minutes = 0) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}

function nextDateForToken(text: string, now: Date) {
  const lower = text.toLowerCase();
  const date = new Date(now);

  if (/\b(tomorrow|kal)\b/.test(lower)) {
    date.setDate(date.getDate() + 1);
    return date;
  }

  const monthMatch = lower.match(/\b(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/);
  if (monthMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = monthNames.findIndex((name) => monthMatch[2].startsWith(name));
    date.setMonth(month, Number(monthMatch[1]));
    if (date < now) date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  return date;
}

function extractTime(text: string) {
  const lower = text.toLowerCase();
  const match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?\b/);
  if (!match) return { hours: 9, minutes: 0 };

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const suffix = match[3];

  if (suffix === 'pm' && hours < 12) hours += 12;
  if (suffix === 'am' && hours === 12) hours = 0;
  if (suffix === 'baje' && hours < 8) hours += 12;

  return { hours: Math.min(hours, 23), minutes: Math.min(minutes, 59) };
}

function classify(text: string): Pick<ReminderDraft, 'title' | 'type' | 'category' | 'smartReminders'> {
  const lower = text.toLowerCase();

  if (/flight|boarding|airport|pnr/.test(lower)) {
    return {
      title: 'Flight reminder',
      type: 'flight',
      category: 'travel',
      smartReminders: [
        { label: 'Check in', minutesBefore: 24 * 60 },
        { label: 'Leave for airport', minutesBefore: 3 * 60 },
        { label: 'Boarding soon', minutesBefore: 60 },
      ],
    };
  }

  if (/medicine|tablet|doctor|dose|dawai/.test(lower)) {
    return { title: 'Medicine reminder', type: 'medicine', category: 'health', smartReminders: defaultLeads };
  }

  if (/netflix|spotify|prime|renew|subscription/.test(lower)) {
    return { title: 'Subscription renewal', type: 'subscription', category: 'subscription', smartReminders: [{ label: 'Before renewal', minutesBefore: 24 * 60 }] };
  }

  if (/bill|electricity|rent|payment|bharna|invoice/.test(lower)) {
    return { title: 'Bill payment', type: 'bill', category: 'utility', smartReminders: [{ label: 'Due soon', minutesBefore: 3 * 24 * 60 }] };
  }

  if (/meeting|call|zoom|meet/.test(lower)) {
    return { title: lower.includes('call') ? 'Call reminder' : 'Meeting', type: 'meeting', category: 'work', smartReminders: [{ label: 'Before meeting', minutesBefore: 30 }] };
  }

  if (/exam|assignment|homework/.test(lower)) {
    return { title: 'Study reminder', type: 'exam', category: 'education', smartReminders: [{ label: 'Prepare', minutesBefore: 24 * 60 }] };
  }

  return { title: 'Reminder', type: 'task', category: 'personal', smartReminders: defaultLeads };
}

function fallbackParse({ text, source = 'fallback', now = new Date() }: ParseInput): ReminderDraft {
  const date = nextDateForToken(text, now);
  const { hours, minutes } = extractTime(text);
  const classified = classify(text);

  return {
    ...classified,
    datetime: toIsoDateTime(date, hours, minutes),
    location: /airport/i.test(text) ? 'Airport' : null,
    notes: text.trim() || null,
    repeat: /daily|roz|every day/i.test(text) ? 'daily' : /monthly|har month/i.test(text) ? 'monthly' : 'none',
    source,
    confidence: text.trim().length > 8 ? 0.72 : 0.45,
  };
}

function normalizeDraft(value: unknown, input: ParseInput): ReminderDraft {
  const fallback = fallbackParse(input);
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Partial<ReminderDraft>;

  return {
    ...fallback,
    ...raw,
    title: raw.title || fallback.title,
    type: raw.type || fallback.type,
    category: raw.category || fallback.category,
    repeat: raw.repeat || 'none',
    source: input.source || raw.source || 'text',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : fallback.confidence,
    smartReminders: Array.isArray(raw.smartReminders) ? raw.smartReminders : fallback.smartReminders,
  };
}

export async function parseReminderWithAi(input: ParseInput): Promise<ReminderDraft> {
  if (!AI_ASSISTANT_API_URL) return fallbackParse(input);

  const endpoint = input.imageBase64 ? '/reminders/parse-document' : '/reminders/parse';
  const response = await fetch(`${AI_ASSISTANT_API_URL.replace(/\/$/, '')}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      source: input.source || 'text',
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      localeHints: ['en', 'hi', 'gu', 'hinglish'],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI parser failed (${response.status})`);
  }

  const json = await response.json();
  return normalizeDraft(json.reminder || json, input);
}
