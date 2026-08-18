import useSWR from 'swr'
import { useMemo, useState, useEffect } from 'react'
import { debounce } from 'ts-debounce'

// ── 类型定义 ──────────────────────────────────────────────

export type SearchIndexItem = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary: string
	hidden: boolean
	category?: string
	contentText: string
	headings: { level: number; text: string }[]
}

export type SearchResult = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary: string
	category?: string
	score: number
	snippet?: string
	matchType: 'title' | 'tag' | 'heading' | 'summary' | 'content'
}

// ── 索引加载（SWR 全局缓存，懒加载） ──────────────────────

const fetcher = async (url: string): Promise<SearchIndexItem[]> => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) throw new Error('Failed to load search index')
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

/**
 * 搜索索引 SWR hook。
 * 首次调用时才发起请求，之后全局缓存。
 * 隐藏文章对非登录用户不可见，与 useBlogIndex 行为一致。
 */
export function useSearchIndex(includeHidden = false) {
	const { data, error, isLoading } = useSWR<SearchIndexItem[]>('/search-index.json', fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	const items = useMemo(() => {
		if (!data) return []
		if (includeHidden) return data
		return data.filter(item => !item.hidden)
	}, [data, includeHidden])

	return { items, loading: isLoading, error }
}

// ── 搜索算法 ────────────────────────────────────────────────

/**
 * 中文子串匹配：对 query 做二元切分（bigram），每个 bigram 在目标中查找。
 * 英文/数字按空格分词后子串匹配。
 * 只要任意一个 bigram/词命中即为匹配，分数按命中次数累加。
 *
 * 返回 { matched, score, positions }
 */
function matchText(query: string, target: string): { matched: boolean; score: number; positions: number[] } {
	if (!query || !target) return { matched: false, score: 0, positions: [] }

	const lowerTarget = target.toLowerCase()
	const lowerQuery = query.toLowerCase().trim()

	if (!lowerQuery) return { matched: false, score: 0, positions: [] }

	let score = 0
	const positions: number[] = []

	// 整体子串匹配（最高优先级）
	const idx = lowerTarget.indexOf(lowerQuery)
	if (idx >= 0) {
		score += 30
		positions.push(idx)
	}

	// 二元切分（适用于中文连续字）
	const bigrams: string[] = []
	for (let i = 0; i < lowerQuery.length - 1; i++) {
		const bg = lowerQuery.slice(i, i + 2)
		if (bg.trim()) bigrams.push(bg)
	}

	// 英文/数字按空格分词
	const words = lowerQuery.split(/\s+/).filter(w => w.length >= 2 && /^[a-z0-9]/.test(w))

	// 单中文字（仅当无 bigram 和 word 时作为回退）
	const singleChars = lowerQuery.split('').filter(c => c.trim() && /[\u4e00-\u9fa5]/.test(c))

	for (const bg of bigrams) {
		let from = 0
		while (true) {
			const pos = lowerTarget.indexOf(bg, from)
			if (pos < 0) break
			score += 3
			if (!positions.includes(pos)) positions.push(pos)
			from = pos + bg.length
		}
	}

	for (const word of words) {
		let from = 0
		while (true) {
			const pos = lowerTarget.indexOf(word, from)
			if (pos < 0) break
			score += 5
			if (!positions.includes(pos)) positions.push(pos)
			from = pos + word.length
		}
	}

	if (bigrams.length === 0 && words.length === 0) {
		for (const ch of singleChars) {
			let from = 0
			while (true) {
				const pos = lowerTarget.indexOf(ch, from)
				if (pos < 0) break
				score += 1
				if (!positions.includes(pos)) positions.push(pos)
				from = pos + ch.length
			}
		}
	}

	return { matched: score > 0, score, positions }
}

/**
 * 提取匹配上下文片段。
 * 在 contentText 中找到第一个命中位置，前后各取 contextChars 字符。
 */
function extractSnippet(contentText: string, query: string, contextChars = 40): string | undefined {
	if (!contentText || !query) return undefined

	const lowerContent = contentText.toLowerCase()
	const lowerQuery = query.toLowerCase().trim()

	if (!lowerQuery) return undefined

	let firstPos = lowerContent.indexOf(lowerQuery)

	// 二元切分回退
	if (firstPos < 0) {
		for (let i = 0; i < lowerQuery.length - 1; i++) {
			const bg = lowerQuery.slice(i, i + 2)
			if (bg.trim()) {
				const pos = lowerContent.indexOf(bg)
				if (pos >= 0 && (firstPos < 0 || pos < firstPos)) {
					firstPos = pos
				}
			}
		}
	}

	// 英文单词回退
	if (firstPos < 0) {
		const words = lowerQuery.split(/\s+/).filter(w => w.length >= 2)
		for (const word of words) {
			const pos = lowerContent.indexOf(word)
			if (pos >= 0 && (firstPos < 0 || pos < firstPos)) {
				firstPos = pos
			}
		}
	}

	if (firstPos < 0) return undefined

	const start = Math.max(0, firstPos - contextChars)
	const end = Math.min(contentText.length, firstPos + lowerQuery.length + contextChars)

	let snippet = contentText.slice(start, end)
	if (start > 0) snippet = '...' + snippet
	if (end < contentText.length) snippet = snippet + '...'

	return snippet
}

/**
 * 搜索主函数：对索引列表进行搜索，返回评分排序后的结果。
 *
 * 评分规则：
 *   标题子串匹配:  +50（整体包含）
 *   标签完全匹配:  +40
 *   标签子串匹配:  +20
 *   标题树匹配:    +25
 *   摘要子串匹配:  +15
 *   正文子串匹配:  +5 (每多一个位置 +2, 上限 +25)
 *   日期加分:      越新越多 (上限 +10)
 *
 * 多关键字 AND 逻辑：所有关键字都必须命中。
 */
export function search(items: SearchIndexItem[], query: string, limit?: number): SearchResult[] {
	const trimmed = query.trim()
	if (!trimmed) return []

	const keywords = trimmed.split(/\s+/).filter(Boolean)
	const now = Date.now()
	const results: SearchResult[] = []

	for (const item of items) {
		let totalScore = 0
		let bestSnippet: string | undefined
		let bestMatchType: SearchResult['matchType'] = 'content'
		let allKeywordsMatched = true

		for (const kw of keywords) {
			let kwScore = 0
			let kwSnippet: string | undefined
			let kwMatchType: SearchResult['matchType'] = 'content'

			// 标题匹配
			const titleMatch = matchText(kw, item.title)
			if (titleMatch.matched) {
				kwScore += 50
				if (kwMatchType === 'content') kwMatchType = 'title'
			}

			// 标签匹配
			for (const tag of item.tags) {
				const tagMatch = matchText(kw, tag)
				if (tagMatch.matched) {
					const isExact = tag.toLowerCase() === kw.toLowerCase()
					kwScore += isExact ? 40 : 20
					if (kwMatchType !== 'title' && kwMatchType !== 'tag') kwMatchType = 'tag'
				}
			}

			// 标题树匹配
			for (const heading of item.headings) {
				const headingMatch = matchText(kw, heading.text)
				if (headingMatch.matched) {
					kwScore += 25
					if (kwMatchType === 'content') kwMatchType = 'heading'
				}
			}

			// 摘要匹配
			if (item.summary) {
				const summaryMatch = matchText(kw, item.summary)
				if (summaryMatch.matched) {
					kwScore += 15
					if (kwMatchType === 'content') kwMatchType = 'summary'
					if (!kwSnippet) kwSnippet = extractSnippet(item.summary, kw, 30)
				}
			}

			// 正文匹配
			const contentMatch = matchText(kw, item.contentText)
			if (contentMatch.matched) {
				const contentScore = Math.min(5 + contentMatch.positions.length * 2, 25)
				kwScore += contentScore
				if (kwMatchType === 'content') kwMatchType = 'content'
				if (!kwSnippet) kwSnippet = extractSnippet(item.contentText, kw, 40)
			}

			if (kwScore === 0) {
				allKeywordsMatched = false
				break
			}

			totalScore += kwScore
			if (!bestSnippet && kwSnippet) bestSnippet = kwSnippet
			const priority: Record<string, number> = { title: 5, tag: 4, heading: 3, summary: 2, content: 1 }
			if (priority[kwMatchType] > priority[bestMatchType]) {
				bestMatchType = kwMatchType
			}
		}

		if (!allKeywordsMatched) continue

		// 日期加分
		if (item.date) {
			const dateMs = new Date(item.date).getTime()
			if (!isNaN(dateMs)) {
				const daysAgo = (now - dateMs) / (1000 * 60 * 60 * 24)
				const dateBonus = Math.max(0, Math.min(10, 10 - daysAgo / 30))
				totalScore += dateBonus
			}
		}

		results.push({
			slug: item.slug,
			title: item.title,
			tags: item.tags,
			date: item.date,
			summary: item.summary,
			category: item.category,
			score: totalScore,
			snippet: bestSnippet,
			matchType: bestMatchType
		})
	}

	results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score
		return (b.date || '').localeCompare(a.date || '')
	})

	return limit ? results.slice(0, limit) : results
}

// ── 高亮工具 ────────────────────────────────────────────────

export type HighlightSegment = {
	text: string
	highlight: boolean
}

/**
 * 将文本中匹配关键字的部分标记为高亮段。
 * 返回 HighlightSegment 数组，由 React 组件渲染 <mark>。
 */
export function highlightText(text: string, query: string): HighlightSegment[] {
	if (!query || !text) return [{ text, highlight: false }]

	const lowerText = text.toLowerCase()
	const keywords = query
		.trim()
		.split(/\s+/)
		.filter(Boolean)

	if (keywords.length === 0) return [{ text, highlight: false }]

	const ranges: { start: number; end: number }[] = []

	for (const kw of keywords) {
		const lowerKw = kw.toLowerCase()

		// 整体匹配
		let from = 0
		while (true) {
			const pos = lowerText.indexOf(lowerKw, from)
			if (pos < 0) break
			ranges.push({ start: pos, end: pos + lowerKw.length })
			from = pos + lowerKw.length
		}

		// 二元切分回退
		const hasFullMatch = ranges.some(r => r.end - r.start >= lowerKw.length)
		if (!hasFullMatch) {
			for (let i = 0; i < lowerKw.length - 1; i++) {
				const bg = lowerKw.slice(i, i + 2)
				if (!bg.trim()) continue
				let bgFrom = 0
				while (true) {
					const pos = lowerText.indexOf(bg, bgFrom)
					if (pos < 0) break
					if (!ranges.some(r => pos < r.end && pos + bg.length > r.start)) {
						ranges.push({ start: pos, end: pos + bg.length })
					}
					bgFrom = pos + bg.length
				}
			}
		}
	}

	if (ranges.length === 0) return [{ text, highlight: false }]

	// 合并重叠 range
	ranges.sort((a, b) => a.start - b.start)
	const merged: { start: number; end: number }[] = []
	for (const r of ranges) {
		if (merged.length > 0 && r.start <= merged[merged.length - 1].end) {
			merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end)
		} else {
			merged.push({ ...r })
		}
	}

	const segments: HighlightSegment[] = []
	let lastEnd = 0
	for (const r of merged) {
		if (r.start > lastEnd) {
			segments.push({ text: text.slice(lastEnd, r.start), highlight: false })
		}
		segments.push({ text: text.slice(r.start, r.end), highlight: true })
		lastEnd = r.end
	}
	if (lastEnd < text.length) {
		segments.push({ text: text.slice(lastEnd), highlight: false })
	}

	return segments
}

// ── 防抖搜索 hook ───────────────────────────────────────────

/**
 * 防抖搜索 hook：输入变化后 delay ms 才执行搜索，避免每次按键触发。
 */
export function useDebouncedSearch(items: SearchIndexItem[], query: string, delay = 150) {
	const [debouncedQuery, setDebouncedQuery] = useState(query)

	const debouncedSet = useMemo(() => debounce((q: string) => setDebouncedQuery(q), delay), [delay])

	useEffect(() => {
		debouncedSet(query)
		return () => debouncedSet.cancel()
	}, [query, debouncedSet])

	const results = useMemo(() => {
		if (!debouncedQuery.trim()) return []
		return search(items, debouncedQuery)
	}, [items, debouncedQuery])

	return { results, debouncing: query !== debouncedQuery }
}
