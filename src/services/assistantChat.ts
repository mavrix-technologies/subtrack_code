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
      reply: `Gemini API quota limit exceeded (Too Many Requests).\n\nTo prevent this, link a Google Cloud Billing account in Google AI Studio (https://aistudio.google.com/) to upgrade your API key to the Pay-as-you-go tier.`,
    };
  }

  // If there's a 403 error specifically pointing to Gemini API disabled, show guidance to the developer
  if (errorDetail && errorDetail.includes('generativelanguage.googleapis.com')) {
    return {
      intent: 'answer',
      reminder: null,
      reply: `Gemini API is disabled or key is not set. To enable 100% Gemini replies:\n\n1. Visit the Google Cloud Console link below to enable the Gemini API for your project:\nhttps://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=178143403316\n\n2. Or add a valid key to your .env file:\nEXPO_PUBLIC_GEMINI_API_KEY=your_key_here`,
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

/**
 * Fallback direct client-side Gemini Developer API call
 */
async function clientSideGeminiCall(message: string, history: AssistantChatMessage[], customKey?: string): Promise<AssistantChatResult> {
  const geminiKey = customKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!geminiKey) {
    throw new Error('No Gemini API Key found in env variables.');
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
      // ignore
    }
    const messageStr = parsedError?.error?.message || errorText;
    throw new Error(messageStr);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API did not return a text response.');
  }

  return parseAssistantResponse(text);
}

/**
 * Main chat router supporting Vertex AI -> Developer Gemini API -> Vercel Backend Server -> Local Fallback
 */
export async function sendAssistantChat(input: ChatInput, customKey?: string): Promise<AssistantChatResult> {
  let errorMsg = '';

  // 1. If a custom user API key is provided, try direct Gemini call with that key
  if (customKey) {
    try {
      console.log("[Assistant Chat] Requesting direct client-side Gemini with user's API key...");
      const result = await clientSideGeminiCall(input.message, input.history || [], customKey);
      return result;
    } catch (clientError: any) {
      console.warn("[Assistant Chat] User custom Gemini API key call failed:", clientError);
      errorMsg = clientError?.message || String(clientError);
      return localFallback(input.message, `Custom API Key Error: ${errorMsg}`);
    }
  }

  // 2. Try Vertex AI for Firebase (Production Implementation - Secure and Scalable)
  try {
    const model = getVertexModel();
    if (model) {
      console.log('[Assistant Chat] Requesting Gemini via Vertex AI for Firebase...');
      const result = await clientSideVertexCall(model, input.message, input.history || []);
      return result;
    }
  } catch (vertexError: any) {
    console.warn('[Assistant Chat] Vertex AI failed, falling back to direct Gemini API key:', vertexError);
    errorMsg = vertexError?.message || String(vertexError);
  }

  // 2. Try direct client-side Gemini API call with Developer API key
  try {
    console.log('[Assistant Chat] Requesting direct client-side Gemini API...');
    const result = await clientSideGeminiCall(input.message, input.history || []);
    return result;
  } catch (clientError: any) {
    console.warn('[Assistant Chat] Client-side Gemini failed, trying backend API:', clientError);
    errorMsg = clientError?.message || String(clientError);
  }

  // 3. Try the Vercel backend API as a tertiary fallback
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

  // 4. Fallback to local rule-based parsing with developer guidance
  return localFallback(input.message, errorMsg);
}
