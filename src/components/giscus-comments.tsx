'use client'

import { useEffect, useRef, useState } from 'react'
import { COMMENTS_CONFIG } from '@/config/comments'

type GiscusCommentsProps = {
	slug: string
}

export function GiscusComments({ slug }: GiscusCommentsProps) {
	// giscus 脚本挂载容器
	const containerRef = useRef<HTMLDivElement>(null)
	// 评论区 <section>，用于 IntersectionObserver 观测滚动进入视口
	const sectionRef = useRef<HTMLElement>(null)
	const [loadRequested, setLoadRequested] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const [attempt, setAttempt] = useState(0)
	const [giscusTheme, setGiscusTheme] = useState<'dark_dimmed' | 'noborder_light'>('noborder_light')

	// 监听主题切换事件，动态更新 giscus 主题
	useEffect(() => {
		const handler = (e: Event) => {
			const effective = (e as CustomEvent).detail as 'light' | 'dark'
			setGiscusTheme(effective === 'dark' ? 'dark_dimmed' : 'noborder_light')
			setAttempt(v => v + 1)
		}
		window.addEventListener('blog-theme-change', handler)
		return () => window.removeEventListener('blog-theme-change', handler)
	}, [])

	// 滚动到文章末尾（评论区进入视口）时自动加载评论，提前 200px 触发避免空白等待
	useEffect(() => {
		if (loadRequested || !sectionRef.current) return

		const observer = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setLoadRequested(true)
						observer.disconnect() // 只触发一次，加载后不再重复监听
					}
				}
			},
			{ rootMargin: '200px 0px' }
		)

		observer.observe(sectionRef.current)
		return () => observer.disconnect()
	}, [loadRequested])

	// 加载 giscus 脚本；loadRequested 为 true 后才注入，避免页面打开就请求
	useEffect(() => {
		if (!loadRequested || !containerRef.current) return

		const container = containerRef.current
		const script = document.createElement('script')

		container.replaceChildren()
		setLoadError(false)

		script.src = 'https://giscus.app/client.js'
		script.async = true
		script.crossOrigin = 'anonymous'
		script.setAttribute('data-repo', COMMENTS_CONFIG.repo)
		script.setAttribute('data-repo-id', COMMENTS_CONFIG.repoId)
		script.setAttribute('data-category', COMMENTS_CONFIG.category)
		script.setAttribute('data-category-id', COMMENTS_CONFIG.categoryId)
		script.setAttribute('data-mapping', COMMENTS_CONFIG.mapping)
		script.setAttribute('data-term', `blog:${slug}`)
		script.setAttribute('data-strict', COMMENTS_CONFIG.strict ? '1' : '0')
		script.setAttribute('data-reactions-enabled', COMMENTS_CONFIG.reactionsEnabled ? '1' : '0')
		script.setAttribute('data-emit-metadata', '0')
		script.setAttribute('data-input-position', COMMENTS_CONFIG.inputPosition)
		script.setAttribute('data-theme', giscusTheme)
		script.setAttribute('data-lang', COMMENTS_CONFIG.language)

		const handleError = () => setLoadError(true)
		script.addEventListener('error', handleError)
		container.appendChild(script)

		return () => {
			script.removeEventListener('error', handleError)
			container.replaceChildren()
		}
	}, [attempt, loadRequested, slug])

	// 手动点击加载（备用，滚动自动加载未触发时仍可点击）
	const handleLoad = () => {
		setLoadRequested(true)
		setLoadError(false)
	}

	const handleRetry = () => {
		setLoadError(false)
		setAttempt(value => value + 1)
	}

	return (
		<section ref={sectionRef} aria-labelledby='comments-title' className='border-border bg-card mt-10 rounded-xl border p-5 sm:p-6'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
				<div>
					<h2 id='comments-title' className='text-lg font-semibold'>
						讨论
					</h2>
					<p className='text-secondary mt-1 text-sm'>登录 GitHub 后即可参与；评论将公开保存在 GitHub Discussions。</p>
				</div>

				<a
					href={COMMENTS_CONFIG.discussionsUrl}
					target='_blank'
					rel='noreferrer'
					className='text-secondary hover:text-primary shrink-0 text-sm underline-offset-4 transition-colors hover:underline'>
					查看评论仓库
				</a>
			</div>

			{!loadRequested && (
				<button type='button' onClick={handleLoad} className='brand-btn mt-5 px-4 py-2 text-sm'>
					加载评论
				</button>
			)}

			{loadRequested && (
				<div className='mt-5'>
					{loadError ? (
						<div className='text-secondary flex flex-wrap items-center gap-3 text-sm'>
							<span>评论暂时无法加载。</span>
							<button type='button' onClick={handleRetry} className='text-primary underline-offset-4 hover:underline'>
								重试
							</button>
						</div>
					) : null}

					<div ref={containerRef} aria-live='polite' />
				</div>
			)}
		</section>
	)
}
