import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  q: z.string().min(1, '검색어를 입력해주세요.').max(100),
})

export interface ProductSearchItem {
  id: string
  name: string
  brand: string
  imageUrl: string | null
  ingredientsText: string
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? undefined
  const parsed = schema.safeParse({ q })

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0].message },
      { status: 400 },
    )
  }

  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
    url.searchParams.set('search_terms', parsed.data.q)
    url.searchParams.set('action', 'process')
    url.searchParams.set('json', '1')
    url.searchParams.set('page_size', '15')
    url.searchParams.set('fields', 'code,product_name,brands,ingredients_text,image_url')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'JikguGuard/1.0 (food-safety-checker)' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`Open Food Facts API 오류: ${res.status}`)

    const data = await res.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: ProductSearchItem[] = (data.products ?? [])
      .filter((p: any) => p.product_name && p.ingredients_text)
      .map((p: any) => ({
        id: p.code ?? '',
        name: p.product_name ?? '',
        brand: p.brands ?? '',
        imageUrl: p.image_url ?? null,
        ingredientsText: p.ingredients_text ?? '',
      }))

    return NextResponse.json({ ok: true, products, total: products.length })
  } catch (error) {
    console.error('[GET /api/products/search] 오류:', error)
    return NextResponse.json(
      { ok: false, error: '제품 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
