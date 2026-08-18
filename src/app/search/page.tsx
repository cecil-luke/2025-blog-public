'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Search, FileText, Tag as TagIcon } from 'lucide-react'
import dayjs from 'dayjs'
import { useSearchIndex, search, type SearchResult } from '@/lib/search'
import { HighlightText } from '@/components/highlight-text'
import { useSize } from '@/hooks/use-size'
import { cn } from '@/lib/utils'

function SearchPageContent() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const { maxSM } = useSize()
	const { items, loading } = useSearchIndex()

	const [query, setQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)

	// 从 URL ?q= 初始化搜索词
	useEffect(() => {
		const q = searchParams.get('q') || ''
		if (q) {
			setQuery(q)
			setDebouncedQuery(q)
		}
	}, [searchParams])

	// 防抖
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 150)
		return () => clearTimeout(timer)
	}, [query])

	// 搜索词变化时同步到 URL
	useEffect(() => {
		const q = debouncedQuery.trim()
		const url = q ? '/search?q=' + encodeURIComponent(q) : '/search'
		router.replace(url, { scroll: false })
	}, [debouncedQuery, router])

	const results = useMemo<SearchResult[]>(() => {
		if (!debouncedQuery.trim() || loading || items.length === 0) return []
		return search(items, debouncedQuery)
	}, [items, debouncedQuery, loading])

	// 统计匹配类型分布
	const matchTypeStats = useMemo(() => {
		const stats = { title: 0, tag: 0, heading: 0, summary: 0, content: 0 }
		for (const r of results) {
			stats[r.matchType]++
		}
		return stats
	}, [results])

	return (
		<div className='mx-auto w-full max-w-[840px] px-6 pt-24 pb-12 max-sm:pt-24'>
			{/* 搜索框 */}
			<div className='card flex items-center gap-3 rounded-2xl px-5 py-4'>
				<Search className='text-secondary size-5 shrink-0' />
				<input
					ref={inputRef}
					type='text'
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder='搜索文章标题、标签、内容...'
					autoFocus
					className='text-primary placeholder:text-secondary min-w-0 flex-1 bg-transparent text-base outline-none'
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
						✕
					</button>
				)}
			</div>

			{/* 结果统计 */}
			{debouncedQuery.trim() && !loading && (
				<div className='text-secondary mt-4 text-sm'>
					{results.length > 0 ? (
						<span>
							找到 <span className='text-primary font-medium'>{results.length}</span> 篇相关文章
							{matchTypeStats.title > 0 && <span>，其中 {matchTypeStats.title} 篇标题命中</span>}
						</span>
					) : (
						<span>没有找到相关文章</span>
					)}
				</div>
			)}

			{/* 加载中 */}
			{loading && (
				<div className='text-secondary py-12 text-center text-sm'>加载索引中...</div>
			)}

			{/* 空状态提示 */}
			{!loading && !debouncedQuery.trim() && (
				<div className='flex flex-col items-center py-16'>
					<Search className='text-secondary/40 mb-4 size-12' />
					<p className='text-secondary text-sm'>输入关键词开始搜索</p>
					<p className='text-secondary/60 mt-1 text-xs'>支持标题、标签、正文全文搜索</p>
				</div>
			)}

			{/* 无结果 */}
			{!loading && debouncedQuery.trim() && results.length === 0 && (
				<div className='flex flex-col items-center py-16'>
					<FileText className='text-secondary/40 mb-4 size-12' />
					<p className='text-secondary text-sm'>没有找到包含「{debouncedQuery}」的文章</p>
					<p className='text-secondary/60 mt-1 text-xs'>试试换个关键词，或减少搜索词长度</p>
				</div>
			)}

			{/* 搜索结果列表 */}
			{!loading && results.length > 0 && (
				<div className='mt-4 space-y-3'>
					{results.map((result, index) => (
						<motion.div
							key={result.slug}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: Math.min(index * 0.03, 0.3) }}>
							<Link
								href={'/blog/' + result.slug}
								className='card hover:border-brand/30 block rounded-2xl border p-5 transition-colors'>
								{/* 标题行 */}
								<div className='flex items-start gap-2'>
									<div className='min-w-0 flex-1'>
										<h3 className='text-primary flex items-center gap-2 text-base font-medium'>
											<HighlightText text={result.title} query={debouncedQuery} />
										</h3>
									</div>
									{/* 命中类型标记 */}
									{result.matchType === 'title' && (
										<span className='bg-brand/15 text-brand shrink-0 rounded-full px-2 py-0.5 text-[10px]'>
											标题
										</span>
									)}
									{result.matchType === 'tag' && (
										<span className='bg-amber-100 text-amber-700 shrink-0 rounded-full px-2 py-0.5 text-[10px]'>
											标签
										</span>
									)}
									{result.matchType === 'heading' && (
										<span className='bg-blue-100 text-blue-700 shrink-0 rounded-full px-2 py-0.5 text-[10px]'>
											标题树
										</span>
									)}
								</div>

								{/* 上下文片段 */}
								{result.snippet && (
									<p className='text-secondary mt-2 line-clamp-2 text-sm leading-relaxed'>
										<HighlightText text={result.snippet} query={debouncedQuery} />
									</p>
								)}

								{/* 元信息行 */}
								<div className='text-secondary mt-3 flex flex-wrap items-center gap-3 text-xs'>
									<span>{dayjs(result.date).format('YYYY年M月D日')}</span>
									{result.tags.length > 0 && (
										<span className='flex items-center gap-1'>
											<TagIcon className='size-3' />
											{result.tags.map(t => (
												<span key={t} className='inline-flex'>
													#<HighlightText text={t} query={debouncedQuery} />
												</span>
											))}
										</span>
									)}
								</div>
							</Link>
						</motion.div>
					))}
				</div>
			)}
		</div>
	)
}

export default function SearchPage() {
	return (
		<Suspense fallback={<div className='text-secondary py-12 text-center text-sm'>加载中...</div>}>
			<SearchPageContent />
		</Suspense>
	)
}
