import { ReminderDraft, ReminderSource } from '../../src/types/reminder';

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
};

export type ReminderParseRequest = {
  text?: string;
  source?: ReminderSource;
  imageBase64?: string;
  mimeType?: string;
  localeHints?: string[];
};

const CATEGORIES = ['travel', 'subscription', 'utility', 'work', 'health', 'education', 'family', 'personal', 'finance'] as const;
const TYPES = ['flight', 'meeting', 'medicine', 'bill', 'subscription', 'task', 'exam', 'travel', 'event'] as const;
const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;

const SYSTEM_PROMPT = `
Extract structured reminder/event data.

Rules:
- Return valid JSON only.
- Detect dates and times accurately using ISO 8601 datetimes.
- Understand Hindi, English, Gujarati, and Hinglish.
- Detect event category.
- Extract locations and amounts into notes when useful.
- If missing fields use null.
- Include confidence score from 0 to 1.
- Add smartReminders as [{ "label": string, "minutesBefore": number }].
- Use categories: ${CATEGORIES.join(', ')}.
- Use types: ${TYPES.join(', ')}.
- Use repeat values: ${REPEATS.join(', ')}.
`.trim();

function cleanJsonText(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function coerceString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function coerceNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function coerceConfidence(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function coerceSmartReminders(value: unknown) {
  if (!Array.isArray(value)) return [{ label: 'At time', minutesBefore: 0 }];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const label = coerceString(raw.label, 'Reminder');
      const minutesBefore = typeof raw.minutesBefore === 'number'
        ? Math.max(0, Math.round(raw.minutesBefore))
        : 0;
      return { label, minutesBefore };
    })
    .filter((item): item is { label: string; minutesBefore: number } => !!item)
    .slice(0, 5);
}

function normalizeReminder(raw: unknown, source: ReminderSource): ReminderDraft {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const datetime = coerceNullableString(value.datetime ?? value.dateTime);

  return {
    title: coerceString(value.title, 'Reminder'),
    type: coerceEnum(value.type, TYPES, 'task'),
    category: coerceEnum(value.category, CATEGORIES, 'personal'),
    datetime,
    location: coerceNullableString(value.location),
    notes: coerceNullableString(value.notes),
    repeat: coerceEnum(value.repeat, REPEATS, 'none'),
    source,
    confidence: coerceConfidence(value.confidence),
    smartReminders: coerceSmartReminders(value.smartReminders),
  };
}

function buildPrompt(input: ReminderParseRequest) {
  const now = new Date().toISOString();
  return `
${SYSTEM_PROMPT}

Current datetime: ${now}
Locale hints: ${(input.localeHints || ['en', 'hi', 'gu', 'hinglish']).join(', ')}
Source: ${input.source || 'text'}

User content:
${input.text || ''}

Return exactly this JSON shape:
{
  "title": "string",
  "type": "flight|meeting|medicine|bill|subscription|task|exam|travel|event",
  "category": "travel|subscription|utility|work|health|education|family|personal|finance",
  "datetime": "ISO string or null",
  "location": "string or null",
  "notes": "string or null",
  "repeat": "none|daily|weekly|monthly|yearly",
  "source": "${input.source || 'text'}",
  "confidence": 0.95,
  "smartReminders": [{ "label": "string", "minutesBefore": 30 }]
}
`.trim();
}

export async function parseReminderWithGemini(input: ReminderParseRequest): Promise<ReminderDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const source = input.source || (input.imageBase64 ? 'image' : 'text');
  const parts: GeminiPart[] = [{ text: buildPrompt({ ...input, source }) }];

  if (input.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType || 'image/jpeg',
        data: input.imageBase64,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status}): ${message.slice(0, 300)}`);
  }

  const json = await response.json() as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('Gemini returned an empty response.');

  const parsed = JSON.parse(cleanJsonText(text));
  const reminder = parsed && typeof parsed === 'object' && 'reminder' in parsed
    ? (parsed as { reminder: unknown }).reminder
    : parsed;

  return normalizeReminder(reminder, source);
}
