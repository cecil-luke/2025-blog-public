'use client'

import { highlightText, type HighlightSegment } from '@/lib/search'

/**
 * 渲染带关键字高亮的文本。
 * 将 highlightText 返回的 HighlightSegment[] 渲染为 <mark> 包裹的高亮片段。
 */
export function HighlightText({ text, query, className }: { text: string; query: string; className?: string }) {
	const segments = highlightText(text, query)
	return (
		<>
			{segments.map((seg, i) =>
				seg.highlight ? (
					<mark key={i} className={className ?? 'bg-brand/20 text-primary rounded-sm px-0.5'}>
						{seg.text}
					</mark>
				) : (
					<span key={i}>{seg.text}</span>
				)
			)}
		</>
	)
}
