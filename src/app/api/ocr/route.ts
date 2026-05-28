import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const STOPWORDS = new Set([
  'and', 'or', 'with', 'the', 'of', 'in', 'for', 'from', 'by', 'as', 'at',
  'to', 'a', 'an', 'is', 'are', 'not', 'no', 'per', 'other', 'each',
  '이상', '이하', '미만', '포함', '해당', '기타', '성분', '함량', '원료',
  '제품', '사용', '주의', '섭취', '보관', '방법', '하루', '1일', '1회',
])

function parseIngredientTokens(text: string): string[] {
  const tokens: string[] = []
  for (const line of text.split(/[\n\r]+/)) {
    for (const part of line.split(/[,;·•\/|:]+/)) {
      const cleaned = part
        .replace(/\b\d+\s*(?:mg|g|mcg|µg|%|iu|IU|ml|mL|RE|NE)\b/gi, '')
        .replace(/[()[\]{}*#@!?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      const lower = cleaned.toLowerCase()
      if (
        cleaned.length >= 4 &&
        cleaned.length <= 60 &&
        !STOPWORDS.has(lower) &&
        !/^\d+$/.test(cleaned) &&
        !/^[\W_]+$/.test(cleaned)
      ) {
        tokens.push(cleaned)
      }
    }
  }
  return [...new Set(tokens)]
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'Google Cloud Vision API 키가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: '요청 파싱에 실패했습니다.' }, { status: 400 })
  }

  const file = formData.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: '이미지를 업로드해주세요.' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ ok: false, error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            imageContext: { languageHints: ['ko', 'en'] },
          }],
        }),
      },
    )

    if (!visionRes.ok) {
      const err = await visionRes.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Vision API 오류: ${visionRes.status}`)
    }

    const visionData = await visionRes.json()
    const text: string = visionData.responses?.[0]?.textAnnotations?.[0]?.description ?? ''

    if (!text) {
      return NextResponse.json({ ok: true, text: '', tokens: [] })
    }

    const tokens = parseIngredientTokens(text)
    return NextResponse.json({ ok: true, text, tokens })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/ocr] Vision API 오류:', msg)
    return NextResponse.json(
      { ok: false, error: `OCR 처리 오류: ${msg}` },
      { status: 500 },
    )
  }
}
