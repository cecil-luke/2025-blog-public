'use client'

import { useEffect, useRef } from 'react'

export function ReadingProgress() {
	const progressRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		let frame = 0
		let delayedUpdate = 0
		const scrollElement = document.scrollingElement || document.documentElement
		const update = () => {
			if (frame) return
			frame = requestAnimationFrame(() => {
				frame = 0
				const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
				const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollElement.scrollTop / maxScroll)) : 0
				progressRef.current?.style.setProperty('width', `${progress * 100}%`)
			})
		}

		update()
		const resizeObserver = new ResizeObserver(update)
		resizeObserver.observe(document.documentElement)
		if (document.body) resizeObserver.observe(document.body)
		window.addEventListener('scroll', update, { passive: true })
		window.addEventListener('resize', update)
		window.addEventListener('load', update)
		delayedUpdate = window.setTimeout(update, 300)
		return () => {
			window.removeEventListener('scroll', update)
			window.removeEventListener('resize', update)
			window.removeEventListener('load', update)
			resizeObserver.disconnect()
			if (frame) cancelAnimationFrame(frame)
			if (delayedUpdate) window.clearTimeout(delayedUpdate)
		}
	}, [])

	return (
		<div aria-hidden='true' className='pointer-events-none fixed top-0 left-0 z-[100] h-1 w-full bg-black/10'>
			<div ref={progressRef} className='bg-brand h-full w-0 shadow-sm transition-[width] duration-100 ease-out' />
		</div>
	)
}
