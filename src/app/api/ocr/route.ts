import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

export const maxDuration = 60

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// 영양제 라벨에서 성분명이 아닐 가능성이 높은 불용어
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
        cleaned.length >= 4 &&          // 최소 4자 이상
        cleaned.length <= 60 &&
        !STOPWORDS.has(lower) &&
        !/^\d+$/.test(cleaned) &&        // 숫자만인 경우 제외
        !/^[\W_]+$/.test(cleaned)        // 특수문자만인 경우 제외
      ) {
        tokens.push(cleaned)
      }
    }
  }

  return [...new Set(tokens)]
}

export async function POST(request: NextRequest) {
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

  const tmpPath = join(tmpdir(), `ocr-${randomUUID()}.png`)

  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer())

    // WebP·HEIC 등 어떤 포맷이든 PNG로 변환 (Leptonica 호환)
    const pngBuffer = await sharp(rawBuffer).png().toBuffer()
    await writeFile(tmpPath, pngBuffer)

    const { recognize } = await import('tesseract.js')
    const { data: { text } } = await recognize(tmpPath, 'kor+eng')

    const tokens = parseIngredientTokens(text)

    return NextResponse.json({ ok: true, text, tokens })
  } catch (error) {
    console.error('[POST /api/ocr] OCR 처리 오류:', error)
    return NextResponse.json(
      { ok: false, error: 'OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}
