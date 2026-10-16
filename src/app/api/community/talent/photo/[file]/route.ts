import { readTalentPhoto } from '@/lib/talent';

export const dynamic = 'force-dynamic';

/**
 * A Kalakar profile photo. Public like the profile itself. Every upload gets a
 * new file name, so a served file never changes and can be cached for good.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const photo = readTalentPhoto(file);
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
