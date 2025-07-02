"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Search, Loader2, BookOpen, AlertCircle, SortAsc, SortDesc, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, RefreshCw, Filter, Shuffle, Star } from "lucide-react"

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

// 페이지네이션 정보 타입
interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// API 응답 타입
interface ApiResponse {
  books: Book[]
  pagination: PaginationInfo
  lastUpdated: string
}

// 랜덤 추천 응답 타입
interface RandomRecommendationResponse {
  recommendations: Book[]
  total: number
  lastUpdated: string
}

type SortField = 'title' | 'author' | 'publisher' | 'price' | 'stock'
type SortDirection = 'asc' | 'desc'

export default function BookInventoryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'outOfStock'>('inStock')
  const [selectedPublisher, setSelectedPublisher] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('title')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [allPublishers, setAllPublishers] = useState<string[]>([])
  const [publishersLoaded, setPublishersLoaded] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  
  // 랜덤 추천 상태들
  const [recommendations, setRecommendations] = useState<Book[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null)
  
  // 복사 완료 상태
  const [copiedBookId, setCopiedBookId] = useState<string | null>(null)
  
  // 주문 폼 dialogue 상태
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  // input ref for focus management
  const searchInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<boolean>(false)

  // 검색어 디바운싱 효과
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms 딜레이

    return () => clearTimeout(timer)
  }, [searchTerm])

  // 상대적 시간 표시 함수 - 메모이제이션
  const getRelativeTime = useCallback((dateString: string) => {
    if (!dateString) return ""
    
    const now = new Date()
    const date = new Date(dateString)
    const diff = now.getTime() - date.getTime()
    
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (seconds < 60) return "방금 전"
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])



  // 출판사 목록 로드 - 의존성 최적화
  const loadPublishers = useCallback(async () => {
    if (publishersLoaded) return
    
    try {
      const publishersResponse = await fetch('/api/books?limit=1000')
      if (publishersResponse.ok) {
        const publishersData: ApiResponse = await publishersResponse.json()
        const publishers = new Set(publishersData.books.map(book => book.publisher))
        setAllPublishers(Array.from(publishers).sort())
        setPublishersLoaded(true)
      }
    } catch (error) {
      console.error('Failed to load publishers:', error)
    }
  }, [publishersLoaded])

  // fetchBooks 함수 - 의존성 최적화
  const fetchBooks = useCallback(async (page: number = 1) => {
    try {
      // 포커스 상태 저장
      const wasInputFocused = document.activeElement === searchInputRef.current
      previousFocusRef.current = wasInputFocused

      setLoading(true)
      setError(null)
      
      // 페이지네이션된 데이터 가져오기
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20", // 하드코딩하여 pagination.limit 의존성 제거
      })

      // 검색어가 있으면 추가
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim())
      }

      // 재고 필터가 있으면 추가
      if (stockFilter !== 'all') {
        params.append('stockFilter', stockFilter)
      }

      // 출판사 필터가 있으면 추가
      if (selectedPublisher !== 'all') {
        params.append('publisher', selectedPublisher)
      }

      console.log('Fetching with params:', params.toString()) // 디버깅용

      const response = await fetch(`/api/books?${params}`)
      if (!response.ok) {
        throw new Error("데이터를 불러오는 데 실패했습니다.")
      }
      const data: ApiResponse = await response.json()
      setBooks(data.books)
      setPagination(data.pagination)
      setLastUpdated(data.lastUpdated)

      // 출판사 목록이 아직 로드되지 않았다면 로드
      if (!publishersLoaded) {
        loadPublishers()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      setError(message)
    } finally {
      setLoading(false)
      
      // API 로드 완료 후 포커스 복원
      setTimeout(() => {
        if (previousFocusRef.current && searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 0)
    }
  }, [debouncedSearchTerm, stockFilter, selectedPublisher, publishersLoaded, loadPublishers])

  // 초기 로드
  useEffect(() => {
    fetchBooks(1)
  }, [fetchBooks])

  // 랜덤 추천 초기 로드
  useEffect(() => {
    fetchRecommendations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ESC 키로 dialogue 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showOrderDialog) {
        setShowOrderDialog(false)
        setSelectedBook(null)
      }
    }

    if (showOrderDialog) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showOrderDialog])

  // 검색어나 필터가 변경되면 첫 페이지로 이동하여 새로 검색 - 분리된 useEffect
  useEffect(() => {
    if (debouncedSearchTerm !== '' || stockFilter !== 'all' || selectedPublisher !== 'all') {
      fetchBooks(1)
    }
  }, [debouncedSearchTerm, stockFilter, selectedPublisher, fetchBooks])

  // 랜덤 추천 가져오기 함수
  const fetchRecommendations = useCallback(async () => {
    try {
      setRecommendationsLoading(true)
      setRecommendationsError(null)
      
      const response = await fetch('/api/books/random?count=5')
      if (!response.ok) {
        throw new Error("추천 도서를 불러오는 데 실패했습니다.")
      }
      
      const data: RandomRecommendationResponse = await response.json()
      setRecommendations(data.recommendations)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      setRecommendationsError(message)
    } finally {
      setRecommendationsLoading(false)
    }
  }, [])

  // 책 정보를 참고문헌 형식으로 복사하는 함수
  const copyBookReference = useCallback(async (book: Book) => {
    try {
      // 참고문헌 형식: 저자, 『제목』, 출판사.
      const reference = `${book.author}, 『${book.title}』, ${book.publisher}.`
      
      await navigator.clipboard.writeText(reference)
      
      // 복사 완료 피드백
      setCopiedBookId(book.id)
      setTimeout(() => setCopiedBookId(null), 2000) // 2초 후 피드백 제거
      
      // 주문 폼 dialogue 표시
      setSelectedBook(book)
      setShowOrderDialog(true)
      
      console.log('참고문헌이 복사되었습니다:', reference)
    } catch (error) {
      console.error('복사에 실패했습니다:', error)
      // 폴백: 수동 복사를 위한 알림
      alert(`다음 내용을 수동으로 복사해주세요:\n\n${book.author}, 『${book.title}』, ${book.publisher}.`)
    }
  }, [])

  // 주문 폼으로 이동하는 함수
  const handleOrderFormRedirect = useCallback(() => {
    const orderFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSerAgcgudo6VA41uCIUQTefdMxda6p-Bf2SEoII7NUsNp27Ww/viewform'
    window.open(orderFormUrl, '_blank', 'noopener,noreferrer')
    setShowOrderDialog(false)
    setSelectedBook(null)
  }, [])

  // 주문 폼 dialogue 닫기
  const handleCloseOrderDialog = useCallback(() => {
    setShowOrderDialog(false)
    setSelectedBook(null)
  }, [])

  // 수동 새로고침 함수
  const handleManualRefresh = useCallback(async () => {
    setPublishersLoaded(false) // 출판사 목록도 다시 로드
    await fetchBooks(pagination.page)
  }, [fetchBooks, pagination.page])

  // 페이지 변경
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchBooks(newPage)
    }
  }, [fetchBooks, pagination.totalPages])

  // 검색어 변경 (즉시 상태 업데이트, 디바운싱은 useEffect에서 처리)
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
  }, [])

  const handleStockFilterChange = useCallback((value: typeof stockFilter) => {
    setStockFilter(value)
    setShowMobileFilters(false) // 모바일에서 필터 선택 후 닫기
  }, [])

  const handlePublisherChange = useCallback((value: string) => {
    setSelectedPublisher(value)
    setShowMobileFilters(false) // 모바일에서 필터 선택 후 닫기
  }, [])

  // 클라이언트 사이드 정렬 (현재 페이지의 데이터만)
  const sortedBooks = useMemo(() => {
    const sorted = [...books].sort((a, b) => {
      let aValue: string | number = a[sortField]
      let bValue: string | number = b[sortField]

      if (sortField === 'price' || sortField === 'stock') {
        aValue = parseInt(aValue.toString().replace(/,/g, '')) || 0
        bValue = parseInt(bValue.toString().replace(/,/g, '')) || 0
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
    return sorted
  }, [books, sortField, sortDirection])

  const formatPrice = useCallback((price: string) => {
    const num = parseInt(price.replace(/,/g, ''), 10)
    if (isNaN(num)) return price
    return `${num.toLocaleString("ko-KR")}원`
  }, [])

  const getStockStatus = useCallback((stock: string) => {
    const stockNum = parseInt(stock) || 0
    return stockNum > 0 ? { status: 'in-stock', text: stock, color: 'text-slate-700 font-medium' } : { status: 'out-of-stock', text: '품절', color: 'text-slate-500 font-medium' }
  }, [])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  const renderSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
  }, [sortField, sortDirection])

  const renderPagination = useCallback(() => {
    if (pagination.totalPages <= 1) return null

    const pages = []
    const maxVisiblePages = 3 // 모바일에서 더 적게 표시
    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
        <div className="text-sm text-slate-600 text-center sm:text-left">
          {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            className="p-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            onClick={() => handlePageChange(1)}
            disabled={!pagination.hasPrev}
            aria-label="첫 페이지"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          
          <button
            className="p-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex space-x-1">
            {pages.map(page => (
              <button
                key={page}
                className={`min-w-[44px] h-[44px] rounded-md text-sm font-medium touch-manipulation ${
                  page === pagination.page
                    ? 'bg-slate-800 text-white'
                    : 'border border-slate-300 bg-white hover:bg-slate-50'
                }`}
                onClick={() => handlePageChange(page)}
                aria-label={`페이지 ${page}`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="p-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          
          <button
            className="p-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={!pagination.hasNext}
            aria-label="마지막 페이지"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }, [pagination, handlePageChange])

  // 모바일용 카드 뷰
  const renderMobileCard = useCallback((book: Book) => {
    const stockStatus = getStockStatus(book.stock)
    const isCopied = copiedBookId === book.id
    
    return (
      <Card 
        key={book.id} 
        className={`p-4 space-y-3 transition-all cursor-pointer border-slate-200 ${
          isCopied 
            ? 'bg-slate-100 shadow-lg border-slate-400' 
            : 'hover:shadow-md hover:bg-slate-50'
        }`}
        onClick={() => copyBookReference(book)}
        title="클릭하여 참고문헌 형식으로 복사"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-2 text-slate-800">{book.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{book.author}</p>
          </div>
          <div className="text-right ml-3 flex-shrink-0">
            <p className="font-bold text-lg text-slate-800">{formatPrice(book.price)}</p>
            <span className={`text-sm font-semibold ${stockStatus.color}`}>
              {stockStatus.text}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-500">출판사:</span>
            <p className="font-medium truncate text-slate-700">{book.publisher}</p>
          </div>
          <div>
            <span className="text-slate-500">ISBN:</span>
            <p className="font-mono text-xs break-all text-slate-600">{book.isbn}</p>
          </div>
        </div>
        
        {isCopied && (
          <div className="flex items-center justify-center pt-2 text-xs text-slate-600">
            <span>✓ 참고문헌이 복사되었습니다</span>
          </div>
        )}
      </Card>
    )
  }, [formatPrice, getStockStatus, copiedBookId, copyBookReference])

  // 테이블 콘텐츠만 분리
  const renderTableContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <p className="ml-4 text-slate-600">재고를 불러오는 중...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex justify-center items-center h-64">
          <AlertCircle className="h-8 w-8 text-slate-600 mr-2" />
          <p className="text-slate-600 text-center">{error}</p>
        </div>
      )
    }

    // 모바일에서는 카드 뷰, 데스크톱에서는 테이블 뷰
    return (
      <>
        {/* 모바일 카드 뷰 */}
        <div className="block lg:hidden">
          {sortedBooks.length > 0 ? (
            <div className="space-y-3">
              {sortedBooks.map((book) => renderMobileCard(book))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Search className="h-8 w-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-600">
                {debouncedSearchTerm || stockFilter !== 'all' || selectedPublisher !== 'all' 
                  ? "검색 조건에 맞는 도서가 없습니다." 
                  : "재고 정보가 없습니다."}
              </p>
            </Card>
          )}
        </div>

        {/* 데스크톱 테이블 뷰 */}
        <div className="hidden lg:block border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-[30%] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center space-x-1">
                    <span>제목</span>
                    {renderSortIcon('title')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('author')}
                >
                  <div className="flex items-center space-x-1">
                    <span>저자</span>
                    {renderSortIcon('author')}
                  </div>
                </TableHead>
                <TableHead>ISBN</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('publisher')}
                >
                  <div className="flex items-center space-x-1">
                    <span>출판사</span>
                    {renderSortIcon('publisher')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>정가</span>
                    {renderSortIcon('price')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>재고</span>
                    {renderSortIcon('stock')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBooks.length > 0 ? (
                sortedBooks.map((book) => {
                  const stockStatus = getStockStatus(book.stock)
                  const isCopied = copiedBookId === book.id
                  
                  return (
                    <TableRow 
                      key={book.id} 
                      className={`cursor-pointer transition-all ${
                        isCopied 
                          ? 'bg-slate-100 hover:bg-slate-100' 
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => copyBookReference(book)}
                      title="클릭하여 참고문헌 형식으로 복사"
                    >
                      <TableCell>
                        <div className="font-medium leading-tight flex items-center">
                          {book.title}
                          {isCopied && (
                            <span className="ml-2 text-xs text-slate-600">✓ 복사됨</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{book.author}</TableCell>
                      <TableCell className="font-mono text-sm">{book.isbn}</TableCell>
                      <TableCell>{book.publisher}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPrice(book.price)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    <div className="flex flex-col items-center space-y-2">
                      <Search className="h-8 w-8 text-slate-500" />
                      <p className="text-slate-600">
                        {debouncedSearchTerm || stockFilter !== 'all' || selectedPublisher !== 'all' 
                          ? "검색 조건에 맞는 도서가 없습니다." 
                          : "재고 정보가 없습니다."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 페이지네이션 */}
        {!loading && !error && renderPagination()}
      </>
    )
  }

  return (
    <div className="bg-gradient-to-br from-white to-slate-100 min-h-screen w-full p-3 sm:p-4 lg:p-8">
      <Card className="max-w-7xl mx-auto shadow-xl border-slate-200 pt-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-600 text-white rounded-t-lg p-4 sm:p-6 border-b-2 border-slate-700">
          <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center space-x-2">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8" />
            <span>당신의 책갈피</span>
          </CardTitle>
          <CardDescription className="text-slate-300 text-sm sm:text-base">
            온라인 도서 재고 관리 시스템 - Vercel에서 1시간마다 자동 업데이트
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 bg-white">
          <div className="space-y-4 sm:space-y-6">
            {/* 마지막 업데이트 시각 표시 - 간단하게 */}
            {lastUpdated && (
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>마지막 업데이트: {getRelativeTime(lastUpdated)}</span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="flex items-center space-x-1 px-2 py-1 text-xs hover:text-slate-800 transition-colors disabled:opacity-50 touch-manipulation"
                  title="새로고침"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">새로고침</span>
                </button>
              </div>
            )}

            {/* 랜덤 추천 섹션 */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-800">오늘의 추천 도서</h2>
                </div>
                <button
                  onClick={fetchRecommendations}
                  disabled={recommendationsLoading}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors touch-manipulation"
                >
                  <Shuffle className={`h-4 w-4 ${recommendationsLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">새로운 추천</span>
                </button>
              </div>

              {recommendationsLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                  <p className="ml-3 text-slate-600">추천 도서를 불러오는 중...</p>
                </div>
              ) : recommendationsError ? (
                <div className="flex justify-center items-center h-32">
                  <AlertCircle className="h-6 w-6 text-slate-600 mr-2" />
                  <p className="text-slate-600 text-center">{recommendationsError}</p>
                </div>
              ) : (
                <div className="relative overflow-hidden">
                  {/* 슬라이딩 배너 컨테이너 */}
                  <div className="flex animate-scroll-left">
                    {/* 첫 번째 세트 */}
                    {recommendations.map((book) => {
                      const stockStatus = getStockStatus(book.stock)
                      const isCopied = copiedBookId === book.id
                      
                      return (
                        <Card 
                          key={`first-${book.id}`} 
                          className={`flex-shrink-0 w-64 p-3 mr-4 transition-all cursor-pointer border-slate-200 bg-gradient-to-br from-white to-slate-50 ${
                            isCopied 
                              ? 'shadow-lg border-slate-400' 
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => copyBookReference(book)}
                          title="클릭하여 참고문헌 형식으로 복사"
                        >
                          <div className="flex space-x-3">
                            <div className="w-16 h-20 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
                              <BookOpen className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <h3 className="font-medium text-sm leading-tight line-clamp-2 text-slate-800">
                                {book.title}
                              </h3>
                              <p className="text-xs text-slate-600 truncate">{book.author}</p>
                              <p className="text-xs text-slate-500 truncate">{book.publisher}</p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-sm font-semibold text-slate-800">
                                  {formatPrice(book.price)}
                                </span>
                                <span className={`text-xs font-medium ${stockStatus.color}`}>
                                  {stockStatus.text}
                                </span>
                              </div>
                              {isCopied && (
                                <div className="text-xs text-slate-600 pt-1">
                                  ✓ 복사됨
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                    {/* 두 번째 세트 (무한 스크롤을 위한 복제) */}
                    {recommendations.map((book) => {
                      const stockStatus = getStockStatus(book.stock)
                      const isCopied = copiedBookId === book.id
                      
                      return (
                        <Card 
                          key={`second-${book.id}`} 
                          className={`flex-shrink-0 w-64 p-3 mr-4 transition-all cursor-pointer border-slate-200 bg-gradient-to-br from-white to-slate-50 ${
                            isCopied 
                              ? 'shadow-lg border-slate-400' 
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => copyBookReference(book)}
                          title="클릭하여 참고문헌 형식으로 복사"
                        >
                          <div className="flex space-x-3">
                            <div className="w-16 h-20 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
                              <BookOpen className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <h3 className="font-medium text-sm leading-tight line-clamp-2 text-slate-800">
                                {book.title}
                              </h3>
                              <p className="text-xs text-slate-600 truncate">{book.author}</p>
                              <p className="text-xs text-slate-500 truncate">{book.publisher}</p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-sm font-semibold text-slate-800">
                                  {formatPrice(book.price)}
                                </span>
                                <span className={`text-xs font-medium ${stockStatus.color}`}>
                                  {stockStatus.text}
                                </span>
                              </div>
                              {isCopied && (
                                <div className="text-xs text-slate-600 pt-1">
                                  ✓ 복사됨
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 검색 및 필터 - 항상 렌더링 */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                {/* 검색창 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    type="search"
                    placeholder="제목, 저자, ISBN, 출판사로 검색..."
                    className="pl-10 h-12 text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500" // 모바일에서 더 큰 높이와 텍스트
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    disabled={loading && searchTerm === ""} // 초기 로딩시만 비활성화
                  />
                  {searchTerm !== debouncedSearchTerm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
                
                {/* 모바일 필터 토글 버튼 */}
                <div className="flex items-center justify-between lg:hidden">
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm bg-white border border-slate-300 rounded-md hover:bg-slate-50 touch-manipulation min-h-[44px]"
                  >
                    <Filter className="h-4 w-4" />
                    <span>필터</span>
                    {(stockFilter !== 'all' || selectedPublisher !== 'all') && (
                      <span className="bg-slate-600 text-white text-xs px-2 py-1 rounded-full">
                        {[stockFilter !== 'all', selectedPublisher !== 'all'].filter(Boolean).length}
                      </span>
                    )}
                  </button>
                </div>

                {/* 데스크톱 필터 또는 모바일 열린 필터 */}
                <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
                  <div className="flex flex-col lg:flex-row gap-3 lg:gap-2">
                    <select
                      className="px-3 py-3 lg:py-2 border border-slate-300 bg-white rounded-md text-base lg:text-sm touch-manipulation min-h-[44px] focus:border-slate-500 focus:ring-slate-500"
                      value={stockFilter}
                      onChange={(e) => handleStockFilterChange(e.target.value as typeof stockFilter)}
                      disabled={loading && searchTerm === ""} // 초기 로딩시만 비활성화
                    >
                      <option value="all">전체 재고</option>
                      <option value="inStock">재고 있음</option>
                      <option value="outOfStock">품절</option>
                    </select>
                    
                    <select
                      className="px-3 py-3 lg:py-2 border border-slate-300 bg-white rounded-md text-base lg:text-sm touch-manipulation min-h-[44px] focus:border-slate-500 focus:ring-slate-500"
                      value={selectedPublisher}
                      onChange={(e) => handlePublisherChange(e.target.value)}
                      disabled={loading && searchTerm === ""} // 초기 로딩시만 비활성화
                    >
                      <option value="all">전체 출판사</option>
                      {allPublishers.map(publisher => (
                        <option key={publisher} value={publisher}>{publisher}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-600">
                <div className="space-y-1">
                  <div>
                    페이지 {pagination.page} / {pagination.totalPages} (총 {pagination.total}개 도서)
                  </div>
                  <div className="text-xs text-slate-500">
                    💡 도서 카드를 클릭하면 참고문헌 형식으로 복사됩니다
                  </div>
                </div>
                {(debouncedSearchTerm || stockFilter !== 'all' || selectedPublisher !== 'all') && (
                  <div className="text-slate-700 text-xs sm:text-sm font-medium">
                    현재 필터: {debouncedSearchTerm && `"${debouncedSearchTerm}"`} 
                    {stockFilter !== 'all' && ` | ${stockFilter === 'inStock' ? '재고있음' : '품절'}`}
                    {selectedPublisher !== 'all' && ` | ${selectedPublisher}`}
                  </div>
                )}
              </div>
            </div>

            {/* 도서 테이블 - 분리된 컴포넌트 */}
            {renderTableContent()}
          </div>
        </CardContent>
      </Card>

      {/* 주문 폼 이동 확인 Dialogue */}
      {showOrderDialog && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800">
                주문하시겠습니까?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-md">
                <h3 className="font-medium text-sm text-slate-800 line-clamp-2">
                  {selectedBook.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{selectedBook.author}</p>
                <p className="text-xs text-slate-500">{selectedBook.publisher}</p>
                <p className="text-sm font-semibold text-slate-800 mt-2">
                  {formatPrice(selectedBook.price)}
                </p>
              </div>
              
              <div className="text-sm text-slate-600 space-y-2">
                <p>✅ 참고문헌이 복사되었습니다.</p>
                <p>이 도서를 주문하시겠습니까?</p>
                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border-l-4 border-slate-300">
                  💡 <strong>주문을 위한 구글 폼으로 연결됩니다.</strong><br/>
                  폼에서 복사된 참고문헌 내용을 붙여넣으면 됩니다.
                </div>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleOrderFormRedirect}
                  className="flex-1 bg-slate-800 text-white py-3 px-4 rounded-md font-medium hover:bg-slate-700 transition-colors"
                >
                  네, 주문하기
                </button>
                <button
                  onClick={handleCloseOrderDialog}
                  className="flex-1 bg-slate-200 text-slate-800 py-3 px-4 rounded-md font-medium hover:bg-slate-300 transition-colors"
                >
                  아니오
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
