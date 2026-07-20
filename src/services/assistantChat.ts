import { ReminderDraft } from '@/types/reminder';
import { getVertexModel } from './vertexAi';
import { GenerativeModel } from 'firebase/ai';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type AssistantChatResult = {
  intent: 'answer' | 'reminder';
  reply: string;
  reminder: ReminderDraft | null;
};

type ChatInput = {
  message: string;
  history?: AssistantChatMessage[];
};

const AI_ASSISTANT_API_URL = process.env.EXPO_PUBLIC_AI_ASSISTANT_API_URL;

function localFallback(message: string, errorDetail?: string): AssistantChatResult {
  const lower = message.toLowerCase();

  // If there's a quota or rate limit error
  if (errorDetail && (
    errorDetail.includes('429') ||
    errorDetail.toLowerCase().includes('quota') ||
    errorDetail.toLowerCase().includes('exhausted') ||
    errorDetail.toLowerCase().includes('limit')
  )) {
    return {
      intent: 'answer',
      reminder: null,
      reply: 'The AI assistant is temporarily busy. Please try again in a moment.',
    };
  }

  if (errorDetail && errorDetail.includes('generativelanguage.googleapis.com')) {
    return {
      intent: 'answer',
      reminder: null,
      reply: 'The AI assistant is not available right now. Please try again later.',
    };
  }

  const looksLikeReminder = /remind|remember|alarm|meeting|bill|medicine|renew|kal|tomorrow|due|schedule|yaad/i.test(lower);
  if (looksLikeReminder) {
    return {
      intent: 'reminder',
      reply: 'I can create that reminder. Please review the details before saving.',
      reminder: null,
    };
  }

  return {
    intent: 'answer',
    reminder: null,
    reply: 'I can answer questions and create reminders. Ask me something, or say something like “remind me tomorrow at 9”.',
  };
}

/**
 * Parses and maps the generative model response into our application format.
 */
function parseAssistantResponse(text: string): AssistantChatResult {
  let cleanJsonText = text.trim();
  if (cleanJsonText.startsWith('```')) {
    cleanJsonText = cleanJsonText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const parsed = JSON.parse(cleanJsonText);

  const intent = parsed.intent === 'reminder' ? 'reminder' : 'answer';
  let reminder: ReminderDraft | null = null;
  if (intent === 'reminder' && parsed.reminder && typeof parsed.reminder === 'object') {
    const r = parsed.reminder;
    reminder = {
      title: typeof r.title === 'string' && r.title ? r.title : 'Reminder',
      type: typeof r.type === 'string' ? r.type : 'task',
      category: typeof r.category === 'string' ? r.category : 'personal',
      datetime: typeof r.datetime === 'string' ? r.datetime : null,
      location: typeof r.location === 'string' ? r.location : null,
      notes: typeof r.notes === 'string' ? r.notes : null,
      repeat: typeof r.repeat === 'string' ? r.repeat : 'none',
      source: 'text',
      alertMode: typeof r.alertMode === 'string' ? r.alertMode : 'sound',
      confidence: typeof r.confidence === 'number' ? r.confidence : 0.85,
      smartReminders: Array.isArray(r.smartReminders) ? r.smartReminders : [{ label: 'At time', minutesBefore: 0 }],
    };
  }

  return {
    intent,
    reply: typeof parsed.reply === 'string' ? parsed.reply : 'I can help with that.',
    reminder,
  };
}

/**
 * Connects to Vertex AI for Firebase (Production implementation)
 */
async function clientSideVertexCall(
  model: GenerativeModel,
  message: string,
  history: AssistantChatMessage[]
): Promise<AssistantChatResult> {
  const now = new Date().toISOString();
  const systemInstruction = `
You are Mavrix, a concise personal assistant inside a subscription/reminder app.

Current datetime: ${now}

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

  const formattedHistory = (history || [])
    .slice(-8)
    .map((item) => ({
      role: item.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: item.text }],
    }));

  const chat = model.startChat({
    history: formattedHistory,
    systemInstruction: systemInstruction,
    generationConfig: {
      temperature: 0.35,
      responseMimeType: 'application/json',
    },
  });

  const result = await chat.sendMessage(message);
  const text = result.response.text();
  if (!text) {
    throw new Error('Vertex AI did not return a text response.');
  }

  return parseAssistantResponse(text);
}

async function clientSideGeminiCall(
  message: string,
  history: AssistantChatMessage[],
  customKey: string
): Promise<AssistantChatResult> {
  const geminiKey = customKey.trim();
  if (!geminiKey) {
    throw new Error('No Gemini API key provided.');
  }

  const now = new Date().toISOString();
  const systemInstruction = `
You are Mavrix, a concise personal assistant inside a subscription/reminder app.

Current datetime: ${now}

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

  const formattedHistory = (history || [])
    .slice(-8)
    .map(item => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text }]
    }));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      // ignore non-JSON errors
    }
    throw new Error(parsedError?.error?.message || errorText);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API did not return a text response.');
  }

  return parseAssistantResponse(text);
}

/**
 * Main chat router supporting Firebase Vertex AI -> backend API -> local fallback.
 */
export async function sendAssistantChat(input: ChatInput, customKey?: string): Promise<AssistantChatResult> {
  let errorMsg = '';

  if (customKey?.trim()) {
    try {
      console.log('[Assistant Chat] Requesting Gemini with optional user API key...');
      return await clientSideGeminiCall(input.message, input.history || [], customKey);
    } catch (clientError: any) {
      console.warn('[Assistant Chat] Optional Gemini API key failed, trying app AI:', clientError);
      errorMsg = clientError?.message || String(clientError);
    }
  }

  try {
    const model = getVertexModel();
    if (model) {
      console.log('[Assistant Chat] Requesting Gemini via Vertex AI for Firebase...');
      const result = await clientSideVertexCall(model, input.message, input.history || []);
      return result;
    }
  } catch (vertexError: any) {
    console.warn('[Assistant Chat] Vertex AI failed, trying backend API:', vertexError);
    errorMsg = vertexError?.message || String(vertexError);
  }

  if (AI_ASSISTANT_API_URL) {
    try {
      console.log('[Assistant Chat] Requesting Vercel backend API...');
      const response = await fetch(`${AI_ASSISTANT_API_URL.replace(/\/$/, '')}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.message,
          history: (input.history || []).slice(-8),
          localeHints: ['en', 'hi', 'gu', 'hinglish'],
        }),
      });

      if (response.ok) {
        const json = await response.json();
        return {
          intent: json.intent === 'reminder' ? 'reminder' : 'answer',
          reply: typeof json.reply === 'string' && json.reply.trim()
            ? json.reply.trim()
            : 'I can help with that.',
          reminder: json.reminder && typeof json.reminder === 'object' ? json.reminder as ReminderDraft : null,
        };
      }
    } catch (backendError: any) {
      console.warn('[Assistant Chat] Backend fallback failed:', backendError);
      errorMsg = backendError?.message || String(backendError);
    }
  }

  return localFallback(input.message, errorMsg);
}
