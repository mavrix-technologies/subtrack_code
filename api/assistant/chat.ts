import { ReminderDraft } from '../../src/types/reminder';
import { applyCors, ApiRequest, ApiResponse, handleOptions, readJsonBody, sendError } from '../_lib/http';

type ChatRequest = {
  message?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  localeHints?: string[];
};

type ChatResponse = {
  reply: string;
  intent: 'answer' | 'reminder';
  reminder: ReminderDraft | null;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
};

const CATEGORIES = ['travel', 'subscription', 'utility', 'work', 'health', 'education', 'family', 'personal', 'finance'] as const;
const TYPES = ['flight', 'meeting', 'medicine', 'bill', 'subscription', 'task', 'exam', 'travel', 'event'] as const;
const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;

function cleanJsonText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  return firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
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
  return typeof value === 'number' && !Number.isNaN(value) ? Math.max(0, Math.min(1, value)) : 0.75;
}

function coerceSmartReminders(value: unknown) {
  if (!Array.isArray(value)) return [{ label: 'At time', minutesBefore: 0 }];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      return {
        label: coerceString(raw.label, 'Reminder'),
        minutesBefore: typeof raw.minutesBefore === 'number' ? Math.max(0, Math.round(raw.minutesBefore)) : 0,
      };
    })
    .filter((item): item is { label: string; minutesBefore: number } => !!item)
    .slice(0, 5);
}

function normalizeReminder(raw: unknown): ReminderDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  return {
    title: coerceString(value.title, 'Reminder'),
    type: coerceEnum(value.type, TYPES, 'task'),
    category: coerceEnum(value.category, CATEGORIES, 'personal'),
    datetime: coerceNullableString(value.datetime ?? value.dateTime),
    location: coerceNullableString(value.location),
    notes: coerceNullableString(value.notes),
    repeat: coerceEnum(value.repeat, REPEATS, 'none'),
    source: 'text',
    alertMode: coerceEnum(value.alertMode, ['sound', 'alarm'] as const, 'sound'),
    confidence: coerceConfidence(value.confidence),
    smartReminders: coerceSmartReminders(value.smartReminders),
  };
}

function fallbackAnswer(message: string): ChatResponse {
  return {
    intent: 'answer',
    reminder: null,
    reply: `I can help with reminders, bills, subscriptions, travel plans, and quick questions. You said: ${message}`,
  };
}

function buildPrompt(input: Required<Pick<ChatRequest, 'message'>> & ChatRequest) {
  const now = new Date().toISOString();
  const history = (input.history || [])
    .slice(-8)
    .map((item) => `${item.role}: ${item.text}`)
    .join('\n');

  return `
You are Mavrix, a concise personal assistant inside a subscription/reminder app.

Current datetime: ${now}
Locale hints: ${(input.localeHints || ['en', 'hi', 'gu', 'hinglish']).join(', ')}

Decide the user's intent:
- "reminder" when the user asks to remind, schedule, remember, create task/event/alarm, due date, bill, medicine, meeting, travel, subscription renewal.
- "answer" for normal questions, explanations, app help, planning, summaries, or casual chat.

Rules:
- Return valid JSON only.
- Keep reply short, helpful, and natural.
- For "answer", set reminder to null.
- For "reminder", include a reminder draft and ask the user to review/save it.
- Understand Hindi, Gujarati, English, and Hinglish.
- Use ISO 8601 datetime values.
- If date/time is missing, use null and explain what is missing in reply.

Recent chat:
${history || '(none)'}

User message:
${input.message}

Return exactly this JSON shape:
{
  "intent": "answer|reminder",
  "reply": "assistant message",
  "reminder": null or {
    "title": "string",
    "type": "flight|meeting|medicine|bill|subscription|task|exam|travel|event",
    "category": "travel|subscription|utility|work|health|education|family|personal|finance",
    "datetime": "ISO string or null",
    "location": "string or null",
    "notes": "string or null",
    "repeat": "none|daily|weekly|monthly|yearly",
    "alertMode": "sound|alarm",
    "confidence": 0.95,
    "smartReminders": [{ "label": "string", "minutesBefore": 30 }]
  }
}
`.trim();
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    return;
  }

  let requestMessage = '';

  try {
    const body = readJsonBody<ChatRequest>(req);
    requestMessage = typeof body.message === 'string' ? body.message : '';
    if (!body.message || typeof body.message !== 'string') {
      sendError(res, 400, '`message` is required.', 'INVALID_INPUT');
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt({ ...body, message: body.message }) }] }],
          generationConfig: {
            temperature: 0.35,
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
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned an empty response.');

    const parsed = JSON.parse(cleanJsonText(text)) as Record<string, unknown>;
    const intent = parsed.intent === 'reminder' ? 'reminder' : 'answer';
    const reminder = intent === 'reminder' ? normalizeReminder(parsed.reminder) : null;

    res.status(200).json({
      intent,
      reminder,
      reply: coerceString(parsed.reply, intent === 'reminder' ? 'I created a reminder draft for you to review.' : 'I can help with that.'),
    } satisfies ChatResponse);
  } catch (error) {
    console.error('Assistant chat failed:', error);
    if (error instanceof SyntaxError) {
      res.status(200).json(fallbackAnswer(requestMessage));
      return;
    }

    sendError(
      res,
      500,
      error instanceof Error ? error.message : 'Assistant chat failed.',
      'AI_CHAT_FAILED'
    );
  }
}
