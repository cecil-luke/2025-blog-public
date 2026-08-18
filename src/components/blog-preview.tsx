'use client'

import { motion } from 'motion/react'
import { INIT_DELAY } from '@/consts'
import { useMarkdownRender } from '@/hooks/use-markdown-render'
import { useSize } from '@/hooks/use-size'
import { BlogSidebar } from '@/components/blog-sidebar'
import { GiscusComments } from '@/components/giscus-comments'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { useBlogIndex, type BlogIndexItem } from '@/hooks/use-blog-index'
import { MobileBlogToc } from '@/components/mobile-blog-toc'
import Link from 'next/link'

type BlogPreviewProps = {
	markdown: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	slug?: string
	showComments?: boolean
	showEnhancements?: boolean
}

export function BlogPreview({ markdown, title, tags, date, summary, cover, slug, showComments = false, showEnhancements = false }: BlogPreviewProps) {
	const { maxSM: isMobile } = useSize()
	const { content, toc, wordCount, readingMinutes, loading } = useMarkdownRender(markdown)
	const { items } = useBlogIndex()
	const { siteContent } = useConfigStore()
	const summaryInContent = siteContent.summaryInContent ?? false
	const navigation = getAdjacentBlogs(items, slug)

	if (loading) {
		return <div className='text-secondary flex h-full items-center justify-center text-sm'>渲染中...</div>
	}

	return (
		<div className='mx-auto flex max-w-[1140px] justify-center gap-6 px-6 pt-28 pb-12 max-sm:px-0'>
			<motion.article
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: INIT_DELAY }}
				className='card bg-article static flex-1 overflow-auto rounded-xl p-8'>
				<div>
					<div className='text-center text-2xl font-semibold'>{title}</div>

					<div className='text-secondary mt-4 flex flex-wrap items-center justify-center gap-3 px-8 text-center text-sm'>
						{tags.map(t => (
							<span key={t}>#{t}</span>
						))}
					</div>

					<div className='text-secondary mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm'>
						<span>{date}</span>
						{showEnhancements && wordCount > 0 && (
							<>
								<span aria-hidden='true'>·</span>
								<span>{wordCount.toLocaleString()} 字</span>
								<span aria-hidden='true'>·</span>
								<span>约 {readingMinutes} 分钟阅读</span>
							</>
						)}
					</div>

					{summary && summaryInContent && <div className='text-secondary mt-6 cursor-text text-center text-sm'>“{summary}”</div>}

					<div className='prose mt-6 max-w-none cursor-text'>{content}</div>

					{showEnhancements && slug && (navigation.previous || navigation.next) && <BlogNavigation previous={navigation.previous} next={navigation.next} />}

					{showComments && slug && <GiscusComments key={slug} slug={slug} />}
				</div>
			</motion.article>

			{!isMobile && <BlogSidebar cover={cover} summary={summary} toc={toc} slug={slug} />}
			{showEnhancements && isMobile && <MobileBlogToc toc={toc} />}
		</div>
	)
}

function getAdjacentBlogs(items: BlogIndexItem[], slug?: string) {
	if (!slug) return { previous: undefined, next: undefined }
	const sorted = [...items].sort((a, b) => {
		const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
		return dateDiff || a.slug.localeCompare(b.slug)
	})
	const index = sorted.findIndex(item => item.slug === slug)
	if (index < 0) return { previous: undefined, next: undefined }
	return { previous: sorted[index - 1], next: sorted[index + 1] }
}

function BlogNavigation({ previous, next }: { previous?: BlogIndexItem; next?: BlogIndexItem }) {
	return (
		<nav aria-label='文章导航' className='mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2'>
			{previous ? <BlogNavLink direction='上一篇' item={previous} /> : <div />}
			{next ? <BlogNavLink direction='下一篇' item={next} align='right' /> : <div />}
		</nav>
	)
}

function BlogNavLink({ direction, item, align = 'left' }: { direction: string; item: BlogIndexItem; align?: 'left' | 'right' }) {
	return (
		<Link
			href={`/blog/${item.slug}`}
			className={`bg-card hover:border-brand/50 block rounded-xl border p-4 transition-colors ${align === 'right' ? 'text-right' : ''}`}>
			<span className='text-secondary text-xs'>{direction}</span>
			<span className='mt-2 line-clamp-2 block font-medium'>{item.title || item.slug}</span>
		</Link>
	)
}
