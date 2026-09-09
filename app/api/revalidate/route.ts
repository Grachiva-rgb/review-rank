import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { SEO_CATEGORIES, SEO_CITIES } from '@/lib/seo';
import { secretMatches } from '@/lib/timingSafe';

/**
 * POST /api/revalidate
 *
 * Auth: Bearer ADMIN_SECRET.
 *
 *   { path: "/plumbers/austin-tx" }  — revalidate one path
 *   { all: true }                    — revalidate every category/city page
 *
 * The bulk form requires an explicit `all: true`. It used to be the behaviour
 * for ANY request without a usable `path`, including an empty or malformed body,
 * which meant a stray curl regenerated 13 categories x 20 cities = 260 pages —
 * every one of them a billed Google Text Search. Making it opt-in removes the
 * accidental-spend footgun; it is still a real cost when invoked deliberately.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!secretMatches(secret, process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    path?: unknown;
    all?: unknown;
  };

  // Type-check before calling revalidatePath: passing a non-string (an array or
  // number from a hand-rolled JSON body) has undefined behaviour there.
  if (typeof body.path === 'string' && body.path.trim()) {
    revalidatePath(body.path);
    return NextResponse.json({ revalidated: [body.path] });
  }

  if (body.all !== true) {
    return NextResponse.json(
      {
        error:
          'Provide { path: "/..." } to revalidate one path, or { all: true } to ' +
          'revalidate all category/city pages (260 pages, each a billed API call).',
      },
      { status: 400 }
    );
  }

  const paths: string[] = [];
  for (const cat of SEO_CATEGORIES) {
    for (const city of SEO_CITIES) {
      const p = `/${cat.slug}/${city.slug}`;
      revalidatePath(p);
      paths.push(p);
    }
  }

  return NextResponse.json({ revalidated: paths.length, paths });
}
