import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { SEO_CATEGORIES, SEO_CITIES } from '@/lib/seo';

export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await request.json().catch(() => ({}));

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: [path] });
  }

  // Revalidate all category/city pages
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
