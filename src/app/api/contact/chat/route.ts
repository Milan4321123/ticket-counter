import { NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/aiQuota';
import { aiTurn, cleanFields, isReady, requestMessage, scriptedTurn, type ChatTurn } from '@/lib/creatorChat';
import { createContactRequest } from '@/lib/contact';
import { sendContactRequestAck, sendContactRequestToTeam } from '@/lib/email';
import { geminiEnabled } from '@/lib/gemini';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * One turn of "Talk to the creator" (components/CreatorChat): the reply and
 * the request filled so far. Nothing is stored here — sending the finished
 * request goes through /api/contact like the form.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`creator-chat:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'One moment — that is a lot of messages at once.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { messages?: unknown; fields?: unknown; send?: unknown } | null;
  const messages: ChatTurn[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(
      (m): m is ChatTurn =>
        !!m && typeof m === 'object' && ((m as ChatTurn).from === 'me' || (m as ChatTurn).from === 'bot') && typeof (m as ChatTurn).text === 'string'
    )
    .slice(-30)
    .map((m) => ({ from: m.from, text: m.text.slice(0, 1200) }));
  const fields = cleanFields(body?.fields);
  const owner = process.env.PLATFORM_OWNER_NAME?.trim() || 'Milan';

  // Send: the finished request becomes a contact request — the same record
  // and the same two emails the form makes — with what the chat noted.
  // No consent tick: answering a request the visitor sent is Art. 6(1)(b)/(f)
  // GDPR, and the card says so next to the button (components/CreatorChat).
  if (body?.send === true) {
    if (!isReady(fields)) return NextResponse.json({ error: 'Your name, email and what you would like are still missing.' }, { status: 400 });
    if (!rateLimit(`contact:${ip}`, 3, 60_000) || !rateLimit('contact:all', 40, 60 * 60_000)) {
      return NextResponse.json({ error: 'Too many messages from here — please wait a minute and try again.' }, { status: 429 });
    }
    const request = createContactRequest({
      name: fields.name,
      email: fields.email,
      organization: fields.organization,
      message: requestMessage(fields),
      kind: fields.kind,
      phone: fields.phone,
      eventKind: fields.eventName,
      eventWhen: fields.eventWhen,
      eventWhere: fields.eventWhere,
      expectedPeople: fields.expectedPeople,
    });
    void sendContactRequestToTeam(request).catch((e) => console.error(`Contact request ${request.id} team email failed:`, e));
    void sendContactRequestAck(request).catch((e) => console.error(`Contact request ${request.id} ack failed:`, e));
    return NextResponse.json({ ok: true });
  }

  // The AI only where it may read a visitor's words (lib/gemini `personal`):
  // otherwise the scripted questions, without spending the daily caps.
  let turn: { reply: string; fields: typeof fields } | null = null;
  if (geminiEnabled({ personal: true }) && takeAiQuota([{ key: `creator-chat:ip:${ip}`, perDay: 40 }, { key: 'creator-chat:all', perDay: 1500 }])) {
    turn = await aiTurn(messages, fields, owner);
  }
  // Busy, over the cap, or no AI on this server: the scripted questions.
  if (!turn) turn = scriptedTurn(messages, fields);
  return NextResponse.json({ reply: turn.reply, fields: turn.fields, ready: isReady(turn.fields) });
}
