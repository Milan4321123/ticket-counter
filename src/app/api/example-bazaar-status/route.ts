import { NextResponse } from 'next/server';
import { autoSeedStatus } from '@/lib/exampleBazaar';

export const dynamic = 'force-dynamic';

/** Data-free status of the automatic example-bazaar seed (lib/exampleBazaar). */
export async function GET() {
  return NextResponse.json(autoSeedStatus(), { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
