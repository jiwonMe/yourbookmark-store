import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"

// CSV 행의 타입 정의 (기존과 동일)
interface CSVRow {
  "순번": string
  "ISBN": string
  "제목": string
  "저자": string
  "출판사": string
  "정가": string
  "재고": string
}

// Book 타입 정의 (기존과 동일)
interface Book {
  id: string
  isbn: string
  title: string
  author: string
  publisher: string
  price: string
  stock: string
}

// 랜덤 추천 응답 타입
interface RandomRecommendationResponse {
  recommendations: Book[]
  total: number
  lastUpdated: string
}

// 랜덤 책 추천 API
// 재고가 있는 책들 중에서 지정된 개수만큼 랜덤하게 선택하여 반환
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const count = Math.min(parseInt(searchParams.get('count') || '5'), 20) // 최대 20권, 기본 5권
  const includeOutOfStock = searchParams.get('includeOutOfStock') === 'true' // 품절 도서 포함 여부

  console.log('Random API called with params:', { count, includeOutOfStock })

  const sheetId = "1XGe0tR99pjc2ZkZqvJpTAGN5cOPUinEpv-pBqaa7I7U"
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`

  try {
    const fetchStartTime = new Date()
    
    const response = await fetch(csvUrl, {
      // 랜덤 추천은 자주 바뀔 수 있도록 캐시 시간을 짧게 설정 (30분)
      next: { 
        revalidate: 1800,
        tags: ['books-random'] 
      },
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=900'
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch Google Sheets:', response.status, response.statusText)
      return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 })
    }

    const csvText = await response.text()
    console.log('CSV data length:', csvText.length)

    // CSV 데이터를 파싱
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVRow[]

    console.log('Parsed records count:', records.length)

    // 사용하기 쉬운 형식으로 매핑하고 빈 행을 필터링
    let books: Book[] = records
      .map((row: CSVRow) => ({
        id: row["순번"]?.trim() || '',
        isbn: row["ISBN"]?.trim() || '',
        title: row["제목"]?.trim() || '',
        author: row["저자"]?.trim() || '',
        publisher: row["출판사"]?.trim() || '',
        price: row["정가"]?.trim() || '',
        stock: row["재고"]?.trim() || '',
      }))
      .filter((book: Book) => book.id && book.isbn && book.title)

    console.log('Filtered books count:', books.length)

    // 재고 필터링 (옵션)
    if (!includeOutOfStock) {
      books = books.filter(book => {
        const stock = parseInt(book.stock.replace(/[^\d]/g, '')) || 0
        return stock > 0
      })
      console.log('In-stock books count:', books.length)
    }

    // 충분한 책이 없는 경우 대응
    if (books.length === 0) {
      return NextResponse.json({
        recommendations: [],
        total: 0,
        lastUpdated: fetchStartTime.toISOString()
      })
    }

    // 실제 반환할 개수 조정
    const actualCount = Math.min(count, books.length)

    // Fisher-Yates 셔플 알고리즘을 사용한 랜덤 선택
    const shuffled = [...books]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const recommendations = shuffled.slice(0, actualCount)
    
    console.log(`Selected ${recommendations.length} random books`)

    const responseData: RandomRecommendationResponse = {
      recommendations,
      total: books.length, // 전체 선택 가능한 책 수
      lastUpdated: fetchStartTime.toISOString()
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=900',
        'CDN-Cache-Control': 'public, s-maxage=1800',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=1800'
      }
    })
  } catch (error: unknown) {
    console.error('Random API Error:', error)
    const message = error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ 
      error: message,
      details: error instanceof Error ? error.stack : undefined 
    }, { status: 500 })
  }
} 