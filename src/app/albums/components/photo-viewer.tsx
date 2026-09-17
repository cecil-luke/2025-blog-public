'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import type { AlbumPhoto } from '../types'
import { thumbUrl } from './album-thumb'
import { photoTime } from '../library-utils'

const originalPreloads = new Map<string, Promise<void>>()

function preloadOriginal(url: string, priority: 'high' | 'low' = 'low'): Promise<void> {
	const existing = originalPreloads.get(url)
	if (existing) return existing
	const task = new Promise<void>(resolve => {
		const img = new Image()
		img.fetchPriority = priority
		img.onload = () => resolve()
		img.onerror = () => {
			originalPreloads.delete(url)
			resolve()
		}
		img.src = url
	})
	originalPreloads.set(url, task)
	return task
}

const VIEW_PAD = 40
const SIZE_CAP = 1400

function fitBox(ratio: number) {
	const maxW = window.innerWidth - VIEW_PAD * 2
	const maxH = window.innerHeight - 160
	let w: number
	let h: number
	if (ratio >= 1) {
		w = Math.min(maxW, SIZE_CAP)
		h = w / ratio
		if (h > maxH) {
			h = maxH
			w = h * ratio
		}
	} else {
		h = Math.min(maxH, SIZE_CAP)
		w = h * ratio
		if (w > maxW) {
			w = maxW
			h = w / ratio
		}
	}
	return { w: Math.max(120, Math.round(w)), h: Math.max(120, Math.round(h)) }
}

type Origin = { left: number; top: number; width: number; height: number }

function cellOrigin(photoId: string): Origin | null {
	const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(photoId) : photoId
	const cell = document.querySelector(`[data-album-photo="${escaped}"]`)
	if (!cell) return null
	const rect = cell.getBoundingClientRect()
	return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function centeredBox(box: { w: number; h: number }): Origin {
	return {
		left: (window.innerWidth - box.w) / 2,
		top: (window.innerHeight - box.h) / 2 - 24,
		width: box.w,
		height: box.h
	}
}

export function PhotoViewer({
	photos,
	index,
	onIndexChange,
	onClose
}: {
	photos: AlbumPhoto[]
	index: number
	onIndexChange: (index: number) => void
	onClose: () => void
}) {
	const photo = photos[index]
	const total = photos.length
	const [mounted, setMounted] = useState(false)
	const [closing, setClosing] = useState(false)
	const [frame, setFrame] = useState<Origin | null>(null)
	const [box, setBox] = useState<{ w: number; h: number } | null>(null)
	const [thumbSrc, setThumbSrc] = useState(() => (photo ? thumbUrl(photo.url) : ''))
	const [fullReady, setFullReady] = useState(false)
	const [fullFailed, setFullFailed] = useState(false)
	const [showLoading, setShowLoading] = useState(false)
	const openedFromRef = useRef<Origin | null>(photo ? cellOrigin(photo.id) : null)
	const closingToRef = useRef<Origin | null>(null)
	const touchRef = useRef<{ x: number; y: number } | null>(null)
	const thumbImgRef = useRef<HTMLImageElement>(null)
	const fullImgRef = useRef<HTMLImageElement>(null)
	const closeRef = useRef<() => void>(() => {})

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!photo) return
		openedFromRef.current = cellOrigin(photo.id) ?? openedFromRef.current
		setThumbSrc(thumbUrl(photo.url))
		setFullReady(false)
		setFullFailed(false)
		setShowLoading(false)
		setBox(fitBox(4 / 3))
		setFrame(null)
	}, [photo?.id, photo?.url])

	const applyRatio = (naturalW: number, naturalH: number) => {
		if (!naturalW || !naturalH || closing) return
		setBox(fitBox(naturalW / naturalH))
	}

	useLayoutEffect(() => {
		const thumb = thumbImgRef.current
		if (thumb?.complete && thumb.naturalWidth) applyRatio(thumb.naturalWidth, thumb.naturalHeight)
		const full = fullImgRef.current
		if (full?.complete && full.naturalWidth > 0) setFullReady(true)
	}, [photo?.url, thumbSrc])

	useEffect(() => {
		if (!box) return
		if (closing && closingToRef.current) {
			setFrame(closingToRef.current)
			return
		}
		const origin = openedFromRef.current
		if (origin && !frame) {
			setFrame(origin)
			requestAnimationFrame(() => setFrame(centeredBox(box)))
			return
		}
		setFrame(centeredBox(box))
	}, [box, closing])

	useEffect(() => {
		if (!photo) return
		void preloadOriginal(photo.url, 'high')
		if (total < 2) return
		const neighbors = [index === 0 ? total - 1 : index - 1, (index + 1) % total]
		for (const neighbor of neighbors) void preloadOriginal(photos[neighbor].url)
	}, [photo?.url, index, photos, total])

	useEffect(() => {
		if (fullReady || fullFailed) {
			setShowLoading(false)
			return
		}
		const timer = window.setTimeout(() => setShowLoading(true), 150)
		return () => window.clearTimeout(timer)
	}, [fullReady, fullFailed, photo?.id])

	const close = useCallback(() => {
		if (closing || !photo) return
		closingToRef.current = cellOrigin(photo.id) ?? openedFromRef.current
		setClosing(true)
	}, [closing, photo])

	closeRef.current = close

	const goPrev = useCallback(() => {
		if (total < 2 || closing) return
		openedFromRef.current = null
		onIndexChange(index === 0 ? total - 1 : index - 1)
	}, [closing, index, onIndexChange, total])

	const goNext = useCallback(() => {
		if (total < 2 || closing) return
		openedFromRef.current = null
		onIndexChange((index + 1) % total)
	}, [closing, index, onIndexChange, total])

	useEffect(() => {
		const previous = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeRef.current()
			else if (event.key === 'ArrowLeft') goPrev()
			else if (event.key === 'ArrowRight') goNext()
		}
		window.addEventListener('keydown', onKey)
		return () => {
			document.body.style.overflow = previous
			window.removeEventListener('keydown', onKey)
		}
	}, [goPrev, goNext])

	if (!mounted || !photo) return null

	const captionDate = dayjs(photoTime(photo)).isValid() ? dayjs(photoTime(photo)).format('YYYY年M月D日') : ''

	return createPortal(
		<>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: closing ? 0 : 1 }}
				transition={{ duration: closing ? 0.4 : 0.25 }}
				onClick={close}
				className='fixed inset-0 z-[90] bg-black/75 backdrop-blur-xl'
			/>
			<img
				ref={thumbImgRef}
				src={thumbSrc}
				alt=''
				aria-hidden='true'
				draggable={false}
				decoding='async'
				onLoad={event => applyRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
				onError={() => {
					if (thumbSrc !== photo.url) setThumbSrc(photo.url)
				}}
				className='pointer-events-none invisible absolute h-0 w-0'
			/>
			{frame && (
				<motion.div
					initial={false}
					animate={{
						left: frame.left,
						top: frame.top,
						width: frame.width,
						height: frame.height,
						opacity: closing && !closingToRef.current ? 0 : 1
					}}
					transition={closing ? { duration: 0.45, ease: [0.45, 0, 0.55, 1] } : { type: 'spring', stiffness: 260, damping: 26 }}
					onAnimationComplete={() => {
						if (closing) onClose()
					}}
					onClick={event => event.stopPropagation()}
					onTouchStart={event => {
						const touch = event.changedTouches[0]
						if (touch) touchRef.current = { x: touch.clientX, y: touch.clientY }
					}}
					onTouchEnd={event => {
						const start = touchRef.current
						const touch = event.changedTouches[0]
						touchRef.current = null
						if (!start || !touch) return
						const dx = touch.clientX - start.x
						const dy = touch.clientY - start.y
						if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return
						if (dx > 0) goPrev()
						else goNext()
					}}
					className='fixed z-[91] overflow-hidden rounded-lg bg-black/40 shadow-2xl'>
					<img
						src={thumbSrc}
						alt=''
						aria-hidden='true'
						draggable={false}
						decoding='async'
						className='absolute inset-0 h-full w-full object-contain select-none'
					/>
					<img
						ref={fullImgRef}
						src={photo.url}
						alt={photo.caption || ''}
						draggable={false}
						decoding='async'
						fetchPriority='high'
						onLoad={event => {
							applyRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
							setFullReady(true)
						}}
						onError={() => setFullFailed(true)}
						className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 select-none ${fullReady ? 'opacity-100' : 'opacity-0'}`}
					/>
					{showLoading && !fullReady && !fullFailed && (
						<div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
							<div className='h-8 w-8 animate-spin rounded-full border-2 border-white/35 border-t-white' />
						</div>
					)}
				</motion.div>
			)}
			{!closing && (
				<>
					<button
						type='button'
						onClick={close}
						aria-label='关闭'
						className='fixed top-5 right-5 z-[92] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg text-white backdrop-blur-sm hover:bg-white/25'>
						×
					</button>
					{total > 1 && (
						<>
							<button
								type='button'
								onClick={goPrev}
								aria-label='上一张'
								className='fixed top-1/2 left-4 z-[92] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm hover:bg-white/25 max-sm:left-2'>
								‹
							</button>
							<button
								type='button'
								onClick={goNext}
								aria-label='下一张'
								className='fixed top-1/2 right-4 z-[92] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm hover:bg-white/25 max-sm:right-2'>
								›
							</button>
						</>
					)}
					<div className='pointer-events-none fixed inset-x-0 bottom-6 z-[92] flex flex-col items-center gap-1 px-6 text-center text-white'>
						{(captionDate || photo.caption) && (
							<div className='pointer-events-auto max-w-lg rounded-2xl bg-black/35 px-4 py-2 text-sm backdrop-blur-sm'>
								{captionDate && <div className='text-xs text-white/70'>{captionDate}</div>}
								{photo.caption && <div className='mt-0.5'>{photo.caption}</div>}
							</div>
						)}
						<div className='text-xs text-white/70'>
							{index + 1} / {total}
						</div>
					</div>
				</>
			)}
		</>,
		document.body
	)
}

