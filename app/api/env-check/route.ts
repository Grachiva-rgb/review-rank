// TEMPORARY DIAGNOSTIC — DELETE AFTER USE
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  const keys = Object.keys(process.env).filter(k =>
    k.includes('ADMIN') || k.includes('SECRET') || k.includes('CRON') || k.includes('TRIPADVISOR')
  );
  return NextResponse.json({ keys, totalEnvVars: Object.keys(process.env).length });
}
