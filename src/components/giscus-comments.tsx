'use client'

import { useEffect, useRef, useState } from 'react'
import { COMMENTS_CONFIG } from '@/config/comments'

type GiscusCommentsProps = {
	slug: string
}

export function GiscusComments({ slug }: GiscusCommentsProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [loadRequested, setLoadRequested] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const [attempt, setAttempt] = useState(0)

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
		script.setAttribute('data-theme', COMMENTS_CONFIG.theme)
		script.setAttribute('data-lang', COMMENTS_CONFIG.language)

		const handleError = () => setLoadError(true)
		script.addEventListener('error', handleError)
		container.appendChild(script)

		return () => {
			script.removeEventListener('error', handleError)
			container.replaceChildren()
		}
	}, [attempt, loadRequested, slug])

	const handleLoad = () => {
		setLoadRequested(true)
		setLoadError(false)
	}

	const handleRetry = () => {
		setLoadError(false)
		setAttempt(value => value + 1)
	}

	return (
		<section aria-labelledby='comments-title' className='border-border bg-card mt-10 rounded-xl border p-5 sm:p-6'>
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
