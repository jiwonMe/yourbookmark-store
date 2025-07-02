import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"

// CSV 행의 타입 정의
interface CSVRow {
  "순번": string
  "ISBN": string
  "제목": string
  "저자": string
  "출판사": string
  "정가": string
  "재고": string
}

// Book 타입 정의
interface Book {
  id: string
  isbn: string
  title: string
  author: string
  publisher: string
  price: string
  stock: string
}

// 페이지네이션 응답 타입
interface PaginatedResponse {
  books: Book[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  lastUpdated: string // ISO 8601 형식의 타임스탬프
}

// 사용자가 제공한 API 로직을 App Router의 Route Handler로 변환했습니다.
// 공개된 Google Sheet에서 도서 데이터를 가져옵니다.
// Vercel에서 1시간마다 캐시를 재검증합니다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search')?.trim() || ''
  const stockFilter = searchParams.get('stockFilter') || 'all'
  const publisher = searchParams.get('publisher') || 'all'

  // 디버깅을 위한 로그
  console.log('API called with params:', {
    page,
    limit,
    search,
    stockFilter,
    publisher
  })

  // 유효성 검사
  if (page < 1 || limit < 1 || limit > 1000) {
    return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 })
  }

  const sheetId = "1XGe0tR99pjc2ZkZqvJpTAGN5cOPUinEpv-pBqaa7I7U"
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`

  try {
    // 데이터 가져오기 시작 시간 기록
    const fetchStartTime = new Date()
    
    const response = await fetch(csvUrl, {
      // Vercel에서 1시간마다 데이터를 다시 검증합니다.
      // 이는 Google Sheets의 변경사항을 1시간 간격으로 반영합니다.
      next: { 
        revalidate: 3600,
        tags: ['books-data'] // 캐시 태그로 필요시 수동 재검증 가능
      },
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800'
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch Google Sheets:', response.status, response.statusText)
      return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 })
    }

    const csvText = await response.text()
    console.log('CSV data length:', csvText.length)

    // CSV 데이터를 파싱합니다.
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true, // 공백 제거
    }) as CSVRow[]

    console.log('Parsed records count:', records.length)

    // 사용하기 쉬운 형식으로 매핑하고 빈 행을 필터링합니다.
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

    // 검색 필터 적용
    if (search) {
      const searchTerm = search.toLowerCase()
      console.log('Applying search filter:', searchTerm)
      
      const beforeSearchCount = books.length
      books = books.filter(book => {
        const titleMatch = book.title.toLowerCase().includes(searchTerm)
        const authorMatch = book.author.toLowerCase().includes(searchTerm)
        const isbnMatch = book.isbn.toLowerCase().includes(searchTerm)
        const publisherMatch = book.publisher.toLowerCase().includes(searchTerm)
        
        return titleMatch || authorMatch || isbnMatch || publisherMatch
      })
      
      console.log(`Search filtered: ${beforeSearchCount} -> ${books.length}`)
    }

    // 재고 필터 적용
    if (stockFilter !== 'all') {
      console.log('Applying stock filter:', stockFilter)
      const beforeStockCount = books.length
      
      books = books.filter(book => {
        const stock = parseInt(book.stock.replace(/[^\d]/g, '')) || 0
        return stockFilter === 'inStock' ? stock > 0 : stock === 0
      })
      
      console.log(`Stock filtered: ${beforeStockCount} -> ${books.length}`)
    }

    // 출판사 필터 적용
    if (publisher !== 'all') {
      console.log('Applying publisher filter:', publisher)
      const beforePublisherCount = books.length
      
      books = books.filter(book => book.publisher === publisher)
      
      console.log(`Publisher filtered: ${beforePublisherCount} -> ${books.length}`)
    }

    // 페이지네이션 계산
    const total = books.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedBooks = books.slice(startIndex, endIndex)

    console.log(`Pagination: page ${page}, showing ${startIndex + 1}-${Math.min(endIndex, total)} of ${total}`)

    const paginationInfo = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }

    const response_data: PaginatedResponse = {
      books: paginatedBooks,
      pagination: paginationInfo,
      lastUpdated: fetchStartTime.toISOString() // ISO 8601 형식으로 업데이트 시간 추가
    }

    return NextResponse.json(response_data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
        'CDN-Cache-Control': 'public, s-maxage=3600',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=3600'
      }
    })
  } catch (error: unknown) {
    console.error('API Error:', error)
    const message = error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ 
      error: message,
      details: error instanceof Error ? error.stack : undefined 
    }, { status: 500 })
  }
}
