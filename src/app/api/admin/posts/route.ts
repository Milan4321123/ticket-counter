import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { BodyTooLargeError, readJsonLimited } from '@/lib/http';
import {
  createPlatformPost,
  deletePlatformPost,
  setPlatformContact,
} from '@/lib/platformPosts';
import type { ApiErrorResponse } from '@/lib/types';

const MAX_BODY = 1000;

/**
 * The platform owner's announcements and the identity on the contact card.
 *
 * Admin-only, and that is the whole security model: these appear on the front
 * page of the site to every visitor, so the ability to write one is the ability
 * to put words in the platform's mouth.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: 'Please sign in to the admin area first.' } satisfies ApiErrorResponse,
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await readJsonLimited(req, 32 * 1024)) as Record<string, unknown>;
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        return NextResponse.json({ error: 'That request was too large.' } satisfies ApiErrorResponse, { status: 413 });
      }
      return NextResponse.json({ error: 'Nothing to save.' } satisfies ApiErrorResponse, { status: 400 });
    }

    if (body.action === 'delete') {
      if (typeof body.id !== 'string' || !body.id) {
        return NextResponse.json({ error: 'Which post?' } satisfies ApiErrorResponse, { status: 400 });
      }
      deletePlatformPost(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'contact') {
      setPlatformContact({
        name: typeof body.name === 'string' ? body.name : undefined,
        role: typeof body.role === 'string' ? body.role : undefined,
        photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (text.length < 3) {
      return NextResponse.json({ error: 'Write something first.' } satisfies ApiErrorResponse, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json(
        { error: `Keep it under ${MAX_BODY} characters.` } satisfies ApiErrorResponse,
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, post: createPlatformPost(text) });
  } catch (e) {
    console.error('POST /api/admin/posts failed:', e);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
