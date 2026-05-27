# AI Assistant Backend For Vercel

The backend is implemented as Vercel Functions in:

```txt
api/reminders/parse.ts
api/reminders/parse-document.ts
```

The Expo app never calls Gemini with a raw API key. For local development set:

```txt
EXPO_PUBLIC_AI_ASSISTANT_API_URL=http://localhost:3000/api
```

For production set it to your Vercel deployment:

```txt
EXPO_PUBLIC_AI_ASSISTANT_API_URL=https://your-project.vercel.app/api
```

`vercel.json` also rewrites `/reminders/*` to `/api/reminders/*`, so both URL styles work.

## Required Vercel Env Vars

```txt
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=gemini-2.5-flash
ALLOWED_ORIGINS=https://your-app-domain.com,http://localhost:8082
```

Never use `EXPO_PUBLIC_` for `GEMINI_API_KEY`.

## POST `/api/reminders/parse`

Request:

```json
{
  "text": "kal meeting hai 12 baje",
  "source": "text",
  "localeHints": ["en", "hi", "gu", "hinglish"]
}
```

Response:

```json
{
  "reminder": {
    "title": "Meeting",
    "type": "meeting",
    "category": "work",
    "datetime": "2026-05-28T12:00:00.000Z",
    "location": null,
    "notes": "kal meeting hai 12 baje",
    "repeat": "none",
    "source": "text",
    "confidence": 0.94,
    "smartReminders": [{ "label": "Before meeting", "minutesBefore": 30 }]
  }
}
```

## POST `/api/reminders/parse-document`

Request adds image data:

```json
{
  "text": "Extract reminder details from this uploaded image.",
  "source": "image",
  "imageBase64": "...",
  "mimeType": "image/jpeg",
  "localeHints": ["en", "hi", "gu", "hinglish"]
}
```

This route passes the image directly to Gemini as inline data. If you add ML Kit OCR later, pass OCR text in `text` and keep the same response shape.

The backend prompt uses this rule set:

```txt
Extract structured reminder/event data.
Return valid JSON only.
Detect dates and times accurately.
Understand Hindi, English, Gujarati, and Hinglish.
Detect event category.
Extract locations and amounts.
If missing fields use null.
Include confidence score.
```

## Deploy

1. Rotate any Gemini key that was pasted into chat or committed anywhere.
2. Create a Vercel project from this repo.
3. Add `GEMINI_API_KEY`, `GEMINI_MODEL`, and `ALLOWED_ORIGINS` in Vercel Project Settings.
4. Add `EXPO_PUBLIC_AI_ASSISTANT_API_URL=https://your-project.vercel.app/api` to the app build environment.
5. Deploy, then test:

```bash
curl https://your-project.vercel.app/api/reminders/parse \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"kal meeting hai 12 baje\",\"source\":\"text\"}"
```
