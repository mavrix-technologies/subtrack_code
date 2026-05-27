import { applyCors, handleOptions, readJsonBody, sendError, ApiRequest, ApiResponse } from '../_lib/http';
import { parseReminderWithGemini, ReminderParseRequest } from '../_lib/geminiReminder';

const MAX_BASE64_CHARS = 8_000_000;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    return;
  }

  try {
    const body = readJsonBody<ReminderParseRequest>(req);
    if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
      sendError(res, 400, '`imageBase64` is required.', 'INVALID_INPUT');
      return;
    }

    if (body.imageBase64.length > MAX_BASE64_CHARS) {
      sendError(res, 413, 'Image is too large. Compress it before upload.', 'FILE_TOO_LARGE');
      return;
    }

    const reminder = await parseReminderWithGemini({
      text: body.text || 'Extract reminder details from this document.',
      source: body.source || 'image',
      imageBase64: body.imageBase64,
      mimeType: body.mimeType || 'image/jpeg',
      localeHints: body.localeHints,
    });

    res.status(200).json({ reminder });
  } catch (error) {
    console.error('Document reminder parse failed:', error);
    sendError(
      res,
      error instanceof SyntaxError ? 502 : 500,
      error instanceof Error ? error.message : 'Document reminder parsing failed.',
      'AI_PARSE_FAILED'
    );
  }
}
