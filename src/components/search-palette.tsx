'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { Search, X, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { useSearchIndex, search, type SearchResult } from '@/lib/search'
import { HighlightText } from '@/components/highlight-text'
import { useSize } from '@/hooks/use-size'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import dayjs from 'dayjs'

const RECENT_SEARCH_KEY = 'dsh-recent-searches'
const MAX_RECENT = 5
const PALETTE_LIMIT = 8

/** 命令面板 Props */
interface SearchPaletteProps {
	open: boolean
	onClose: () => void
}

/** 从 localStorage 读取最近搜索 */
function getRecentSearches(): string[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(RECENT_SEARCH_KEY)
		return raw ? JSON.parse(raw) : []
	} catch {
		return []
	}
}

/** 保存最近搜索到 localStorage */
function saveRecentSearch(query: string) {
	if (typeof window === 'undefined' || !query.trim()) return
	try {
		const recent = getRecentSearches()
		const filtered = recent.filter(r => r !== query.trim())
		filtered.unshift(query.trim())
		const next = filtered.slice(0, MAX_RECENT)
		localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next))
	} catch {
		// ignore
	}
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
	const router = useRouter()
	const { maxSM } = useSize()
	const { items, loading } = useSearchIndex()

	const [query, setQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [recentSearches, setRecentSearches] = useState<string[]>([])
	const inputRef = useRef<HTMLInputElement>(null)
	const resultsRef = useRef<HTMLDivElement>(null)

	// 防抖
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 150)
		return () => clearTimeout(timer)
	}, [query])

	// 打开时聚焦输入框，加载最近搜索
	useEffect(() => {
		if (open) {
			setQuery('')
			setDebouncedQuery('')
			setSelectedIndex(0)
			setRecentSearches(getRecentSearches())
			// 延迟聚焦，等动画完成
			setTimeout(() => inputRef.current?.focus(), 100)
		}
	}, [open])

	// 搜索结果
	const results = useMemo<SearchResult[]>(() => {
		if (!debouncedQuery.trim() || loading || items.length === 0) return []
		return search(items, debouncedQuery, PALETTE_LIMIT)
	}, [items, debouncedQuery, loading])

	// 重置选中索引
	useEffect(() => {
		setSelectedIndex(0)
	}, [results.length])

	// 键盘导航
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault()
				setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				setSelectedIndex(prev => Math.max(prev - 1, 0))
			} else if (e.key === 'Enter') {
				e.preventDefault()
				const selected = results[selectedIndex]
				if (selected) {
					saveRecentSearch(debouncedQuery)
					onClose()
					router.push('/blog/' + selected.slug)
				}
			} else if (e.key === 'Escape') {
				e.preventDefault()
				onClose()
			}
		},
		[results, selectedIndex, debouncedQuery, onClose, router]
	)

	// 滚动选中项到可视区域
	useEffect(() => {
		if (!resultsRef.current) return
		const selected = resultsRef.current.children[selectedIndex] as HTMLElement
		if (selected) {
			selected.scrollIntoView({ block: 'nearest' })
		}
	}, [selectedIndex])

	// 全局快捷键 Cmd/Ctrl+K
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				// 由父组件控制 open 状态，这里触发自定义事件
				window.dispatchEvent(new CustomEvent('dsh-toggle-search-palette'))
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [])

	// 点击最近搜索
	const handleRecentClick = useCallback((term: string) => {
		setQuery(term)
		setDebouncedQuery(term)
		inputRef.current?.focus()
	}, [])

	// 清除最近搜索
	const handleClearRecent = useCallback(() => {
		localStorage.removeItem(RECENT_SEARCH_KEY)
		setRecentSearches([])
	}, [])

	if (typeof window === 'undefined') return null

	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						'fixed inset-0 z-[100] flex items-start justify-center backdrop-blur-xl',
						maxSM ? 'items-end p-0' : 'items-start pt-[10vh] p-4'
					)}
					style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
					onClick={onClose}>
					<motion.div
						initial={maxSM ? { y: 40, opacity: 0 } : { y: -20, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={maxSM ? { y: 40, opacity: 0 } : { y: -20, opacity: 0, scale: 0.98 }}
						transition={{ type: 'spring', stiffness: 400, damping: 30 }}
						className={cn(
							'bg-card relative flex w-full flex-col overflow-hidden border shadow-2xl',
							maxSM ? 'max-h-[80vh] rounded-t-2xl' : 'max-w-[640px] rounded-2xl'
						)}
						onClick={e => e.stopPropagation()}>
						{/* 搜索输入区 */}
						<div className='flex items-center gap-3 border-b px-4 py-3'>
							<Search className='text-secondary size-5 shrink-0' />
							<input
								ref={inputRef}
								type='text'
								value={query}
								onChange={e => setQuery(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder='搜索文章标题、标签、内容...'
								className='text-primary placeholder:text-secondary min-w-0 flex-1 bg-transparent text-sm outline-none'
							/>
							{query && (
								<button
									type='button'
									aria-label='清除'
									onClick={() => {
										setQuery('')
										inputRef.current?.focus()
									}}
									className='text-secondary hover:text-primary shrink-0 rounded-full p-1 hover:bg-black/5'>
									<X className='size-4' />
								</button>
							)}
							<button
								type='button'
								aria-label='关闭'
								onClick={onClose}
								className='text-secondary hover:text-primary shrink-0 rounded-full p-1 hover:bg-black/5'>
								<X className='size-4' />
							</button>
						</div>

						{/* 结果区 */}
						<div ref={resultsRef} className='scrollbar-none max-h-[50vh] overflow-y-auto'>
							{/* 加载中 */}
							{loading && (
								<div className='text-secondary py-8 text-center text-sm'>加载索引中...</div>
							)}

							{/* 无搜索词时显示最近搜索 */}
							{!loading && !debouncedQuery.trim() && recentSearches.length > 0 && (
								<div className='p-2'>
									<div className='text-secondary flex items-center justify-between px-2 py-1.5 text-xs'>
										<span>最近搜索</span>
										<button
											type='button'
											onClick={handleClearRecent}
											className='hover:text-primary transition-colors'>
											清除
										</button>
									</div>
									{recentSearches.map(term => (
										<button
											key={term}
											type='button'
											onClick={() => handleRecentClick(term)}
											className='hover:bg-brand/10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
											<Search className='text-secondary size-3.5 shrink-0' />
											<span className='text-primary truncate'>{term}</span>
										</button>
									))}
								</div>
							)}

							{/* 无搜索词且无最近搜索时显示提示 */}
							{!loading && !debouncedQuery.trim() && recentSearches.length === 0 && (
								<div className='text-secondary py-8 text-center text-sm'>
									输入关键词搜索文章
									<br />
									<span className='text-xs'>支持标题、标签、正文全文搜索</span>
								</div>
							)}

							{/* 搜索结果 */}
							{!loading && debouncedQuery.trim() && results.length > 0 && (
								<div className='p-2'>
									{results.map((result, index) => (
										<Link
											key={result.slug}
											href={'/blog/' + result.slug}
											onClick={() => {
												saveRecentSearch(debouncedQuery)
												onClose()
											}}
											data-index={index}
											className={cn(
												'group block min-h-11 rounded-lg px-3 py-2.5 transition-colors',
												index === selectedIndex ? 'bg-brand/10' : 'hover:bg-brand/5'
											)}>
											<div className='flex items-center gap-2'>
												<div className='min-w-0 flex-1'>
													<div className='text-primary flex items-center gap-2 text-sm font-medium'>
														<HighlightText text={result.title} query={debouncedQuery} />
														{result.matchType === 'title' && (
															<span className='bg-brand/15 text-brand rounded-full px-1.5 py-0.5 text-[10px] font-normal'>
																标题命中
															</span>
														)}
													</div>
													{/* 移动端不显示 snippet，保持列表紧凑 */}
													{!maxSM && result.snippet && (
														<div className='text-secondary mt-0.5 line-clamp-1 text-xs'>
															<HighlightText text={result.snippet} query={debouncedQuery} />
														</div>
													)}
													<div className='text-secondary mt-1 flex items-center gap-2 text-xs'>
														<span>{dayjs(result.date).format('YYYY-MM-DD')}</span>
														{result.tags.slice(0, 3).map(tag => (
															<span key={tag}>#<HighlightText text={tag} query={debouncedQuery} /></span>
														))}
													</div>
												</div>
												{index === selectedIndex && (
													<CornerDownLeft className='text-brand size-4 shrink-0 opacity-0 group-hover:opacity-100' />
												)}
											</div>
										</Link>
									))}
								</div>
							)}

							{/* 无结果 */}
							{!loading && debouncedQuery.trim() && results.length === 0 && (
								<div className='py-8 text-center'>
									<div className='text-secondary text-sm'>没有找到相关文章</div>
									{items.length > 0 && (
										<Link
											href={'/search?q=' + encodeURIComponent(debouncedQuery)}
											onClick={onClose}
											className='text-brand mt-2 inline-block text-xs hover:underline'>
											在搜索页查看更多 →
										</Link>
									)}
								</div>
							)}
						</div>

						{/* 底部快捷键提示（仅桌面端） */}
						{!maxSM && (
							<div className='text-secondary flex items-center justify-end gap-4 border-t px-4 py-2 text-xs'>
								<span className='flex items-center gap-1'>
									<ArrowUp className='size-3' />
									<ArrowDown className='size-3' />
									选择
								</span>
								<span className='flex items-center gap-1'>
									<CornerDownLeft className='size-3' />
									打开
								</span>
								<span className='flex items-center gap-1'>
									<kbd className='rounded border px-1'>Esc</kbd>
									关闭
								</span>
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body
	)
}
