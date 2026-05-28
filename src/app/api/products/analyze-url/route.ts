import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as cheerio from 'cheerio'

const schema = z.object({
  url: z.string().url('올바른 URL을 입력해주세요.'),
})

// ─── 성분 텍스트 → 토큰 파싱 ────────────────────────────────────────
const STOPWORDS = new Set([
  'and', 'or', 'with', 'the', 'of', 'in', 'for', 'from', 'by', 'as',
  'other', 'each', 'per', 'contains', 'including', 'plus', 'made',
  '이상', '이하', '미만', '포함', '해당', '기타', '성분', '함량',
])

function parseIngredientTokens(text: string): string[] {
  const tokens: string[] = []
  for (const line of text.split(/[\n\r]+/)) {
    for (const part of line.split(/[,;·•\/|:]+/)) {
      const cleaned = part
        .replace(/\b\d+\s*(?:mg|g|mcg|µg|%|iu|IU|ml|mL|RE|NE|mcg RAE)\b/gi, '')
        .replace(/[()[\]{}*#@!?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      const lower = cleaned.toLowerCase()
      if (
        cleaned.length >= 4 &&
        cleaned.length <= 80 &&
        !STOPWORDS.has(lower) &&
        !/^\d+$/.test(cleaned)
      ) {
        tokens.push(cleaned)
      }
    }
  }
  return [...new Set(tokens)]
}

// ─── 사이트별 파서 ──────────────────────────────────────────────────

function parseIherb($: cheerio.CheerioAPI) {
  const name =
    $('h1.product-title, h1[itemprop="name"], h1').first().text().trim()

  // 성분 섹션 탐색
  let ingredientsText = ''

  // Supplement Facts 텍스트 블록 찾기
  $('*').each((_, el) => {
    const text = $(el).text()
    if (/supplement facts|ingredients?/i.test(text) && text.length < 5000) {
      if (text.length > ingredientsText.length) {
        ingredientsText = text
      }
    }
  })

  return { name, ingredientsText }
}

function parseAmazon($: cheerio.CheerioAPI) {
  const name =
    $('#productTitle, h1#title').first().text().trim()

  let ingredientsText = ''

  // Amazon 성분 섹션
  const selectors = [
    '#important-information',
    '#feature-bullets',
    '#productDescription',
    '[data-feature-name="ingredients"]',
    '.a-expander-content',
  ]

  for (const sel of selectors) {
    const text = $(sel).text().trim()
    if (text && /ingredients?|supplement facts/i.test(text)) {
      ingredientsText += ' ' + text
    }
  }

  if (!ingredientsText) {
    ingredientsText = $('#productDescription, #feature-bullets').text()
  }

  return { name, ingredientsText }
}

function parseGeneral($: cheerio.CheerioAPI, url: string) {
  // 페이지 제목
  const name =
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    new URL(url).hostname

  // 전체 텍스트에서 성분 섹션 찾기
  const bodyText = $('body').text().replace(/\s+/g, ' ')
  const match = bodyText.match(
    /(?:supplement facts|ingredients?|성분표?|원재료|함유성분)[:\s](.{0,3000})/i,
  )
  const ingredientsText = match ? match[1] : bodyText.slice(0, 3000)

  return { name, ingredientsText }
}

// ─── JSON-LD 파싱 (구조화 데이터 우선) ──────────────────────────────
function parseJsonLd($: cheerio.CheerioAPI): string {
  let ingredients = ''
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? '{}')
      const target = Array.isArray(json) ? json[0] : json
      const text = [
        target?.nutrition?.servingSize,
        target?.description,
        target?.ingredients,
      ]
        .filter(Boolean)
        .join(', ')
      if (text.length > ingredients.length) ingredients = text
    } catch {
      // ignore
    }
  })
  return ingredients
}

// ─── 메인 핸들러 ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0].message },
      { status: 400 },
    )
  }

  const { url } = parsed.data
  const parsedUrl = new URL(url)
  const hostname = parsedUrl.hostname

  // SSRF 방어: 내부망 / 루프백 주소 차단
  const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|0\.0\.0\.0)/
  if (BLOCKED_HOSTS.test(hostname)) {
    return NextResponse.json({ ok: false, error: '접근할 수 없는 주소입니다.' }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ ok: false, error: '올바른 URL이 아닙니다.' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      // Cloudflare 등 봇 차단
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        return NextResponse.json(
          {
            ok: false,
            error: `${hostname} 사이트가 자동 접근을 차단하고 있습니다. 제품 상세 페이지에서 성분표를 복사해 입력란에 붙여넣어보세요.`,
          },
          { status: 200 }, // 클라이언트에서 정상 처리되도록 200 반환
        )
      }
      return NextResponse.json(
        { ok: false, error: `페이지를 불러올 수 없습니다. (${res.status})` },
        { status: 200 },
      )
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    // JSON-LD 먼저 시도
    const jsonLdText = parseJsonLd($)

    // 사이트별 파서
    let productName = ''
    let ingredientsText = ''

    if (hostname.includes('iherb.com')) {
      const result = parseIherb($)
      productName = result.name
      ingredientsText = result.ingredientsText
    } else if (hostname.includes('amazon.')) {
      const result = parseAmazon($)
      productName = result.name
      ingredientsText = result.ingredientsText
    } else {
      const result = parseGeneral($, url)
      productName = result.name
      ingredientsText = result.ingredientsText
    }

    // JSON-LD가 있으면 합산
    const fullText = [jsonLdText, ingredientsText].filter(Boolean).join('\n')
    const tokens = parseIngredientTokens(fullText)

    return NextResponse.json({
      ok: true,
      productName: productName || '제품명 미확인',
      tokens,
      rawText: fullText.slice(0, 500), // 디버그용 미리보기
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('[POST /api/products/analyze-url] 오류:', message)

    if (message.includes('timeout') || message.includes('abort')) {
      return NextResponse.json(
        { ok: false, error: '페이지 응답이 너무 느립니다. 해당 사이트가 접근을 차단했을 수 있습니다. 제품 상세 페이지에서 성분표를 복사해 입력란에 붙여넣어보세요.' },
        { status: 200 },
      )
    }
    return NextResponse.json(
      { ok: false, error: '페이지 분석 중 오류가 발생했습니다.' },
      { status: 200 },
    )
  }
}
