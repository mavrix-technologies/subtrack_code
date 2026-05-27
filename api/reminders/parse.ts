import { applyCors, handleOptions, readJsonBody, sendError, ApiRequest, ApiResponse } from '../_lib/http';
import { parseReminderWithGemini, ReminderParseRequest } from '../_lib/geminiReminder';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
    return;
  }

  try {
    const body = readJsonBody<ReminderParseRequest>(req);
    if (!body.text || typeof body.text !== 'string') {
      sendError(res, 400, '`text` is required.', 'INVALID_INPUT');
      return;
    }

    const reminder = await parseReminderWithGemini({
      text: body.text,
      source: body.source || 'text',
      localeHints: body.localeHints,
    });

    res.status(200).json({ reminder });
  } catch (error) {
    console.error('Reminder parse failed:', error);
    sendError(
      res,
      error instanceof SyntaxError ? 502 : 500,
      error instanceof Error ? error.message : 'Reminder parsing failed.',
      'AI_PARSE_FAILED'
    );
  }
}
