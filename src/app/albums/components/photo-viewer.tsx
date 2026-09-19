'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import type { AlbumPhoto } from '../types'
import { preloadOriginal, thumbUrl } from './album-thumb'
import { photoTime } from '../library-utils'

const VIEW_PAD_X = 120
const VIEW_PAD_Y = 96
const MOBILE_PAD = 16
const CAPTION_W = 200
const CAPTION_H = 150
const REST_POSE = { opacity: 1, x: 0, y: 0, scale: 1 }
const SWITCH_INITIAL = { opacity: 0, x: 0, y: 0, scale: 0.7 }

function isMobileView() {
	return window.innerWidth < 640
}

function fitZoomBox(ratio: number) {
	const mobile = isMobileView()
	const padX = mobile ? MOBILE_PAD : VIEW_PAD_X
	const padY = mobile ? MOBILE_PAD : VIEW_PAD_Y
	const maxW = Math.max(1, window.innerWidth - padX * 2)
	const maxH = Math.max(1, window.innerHeight - padY * 2)
	let w: number
	let h: number
	if (ratio >= 1) {
		w = maxW
		h = w / ratio
		if (h > maxH) {
			h = maxH
			w = h * ratio
		}
	} else {
		h = maxH
		w = h * ratio
		if (w > maxW) {
			w = maxW
			h = w / ratio
		}
	}
	return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
}

function captionPos(box: { w: number; h: number }) {
	if (isMobileView()) {
		return { left: 12, top: 56 }
	}
	const imageRight = (window.innerWidth + box.w) / 2
	const left = Math.min(Math.max(16, imageRight - CAPTION_W / 2), window.innerWidth - CAPTION_W - 16)
	const top = Math.min(Math.max(16, window.innerHeight / 2 - CAPTION_H / 2), window.innerHeight - CAPTION_H - 16)
	return { left, top }
}

function photoCell(id: string) {
	const value = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
	return document.querySelector(`[data-album-photo="${value}"]`)
}

function readCellAspect(id: string): number | null {
	const cell = photoCell(id)
	const img = cell?.querySelector('img')
	if (!(img instanceof HTMLImageElement) || !img.naturalWidth || !img.naturalHeight) return null
	return img.naturalWidth / img.naturalHeight
}

function isCellThumbReady(id: string) {
	const cell = photoCell(id)
	const img = cell?.querySelector('img')
	return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
}

function transformFromCell(id: string, wrap?: HTMLElement | null, box?: { w: number; h: number } | null) {
	const cell = photoCell(id)
	if (!(cell instanceof HTMLElement)) return { x: 0, y: 0, scale: 0.7 }
	const c = cell.getBoundingClientRect()
	const restW = cell.offsetWidth || c.width
	const cx = c.left + c.width / 2
	const cy = c.top + c.height / 2
	if (wrap) {
		const w = wrap.getBoundingClientRect()
		return {
			x: cx - (w.left + w.width / 2),
			y: cy - (w.top + w.height / 2),
			scale: Math.max(0.08, restW / Math.max(1, w.width))
		}
	}
	const frameW = box?.w ?? 360
	return {
		x: cx - window.innerWidth / 2,
		y: cy - window.innerHeight / 2,
		scale: Math.max(0.08, restW / Math.max(1, frameW))
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
	const [closing, setClosing] = useState(false)
	const [exit, setExit] = useState<{ x: number; y: number; scale: number; opacity: number } | null>(null)
	const [origin, setOrigin] = useState<{ x: number; y: number; scale: number } | null>(null)
	const [box, setBox] = useState<{ w: number; h: number } | null>(null)
	const [labelPos, setLabelPos] = useState<{ left: number; top: number } | null>(null)
	const [thumbSrc, setThumbSrc] = useState(() => (photo ? thumbUrl(photo.url) : ''))
	const [fullReady, setFullReady] = useState(false)
	const [fullFailed, setFullFailed] = useState(false)
	const [showLoading, setShowLoading] = useState(false)
	const backdropRef = useRef<HTMLDivElement>(null)
	const wrapRef = useRef<HTMLDivElement>(null)
	const thumbImgRef = useRef<HTMLImageElement>(null)
	const fullImgRef = useRef<HTMLImageElement>(null)
	const touchRef = useRef<{ x: number; y: number } | null>(null)
	const closeRef = useRef<() => void>(() => {})
	const entryIdRef = useRef(photo?.id)
	const openedIdRef = useRef(photo?.id)
	const entryPoseRef = useRef<{ opacity: number; x: number; y: number; scale: number } | null>(null)

	const applyRatio = (naturalW: number, naturalH: number, overwrite = false) => {
		if (!naturalW || !naturalH) return
		setBox(current => {
			if (current && !overwrite) return current
			return fitZoomBox(naturalW / naturalH)
		})
	}

	useLayoutEffect(() => {
		if (!photo || origin) return
		const ratio = readCellAspect(photo.id)
		const nextBox = ratio ? fitZoomBox(ratio) : null
		if (nextBox) setBox(current => current ?? nextBox)
		setOrigin(transformFromCell(photo.id, null, nextBox))
	}, [origin, photo])

	useLayoutEffect(() => {
		const thumb = thumbImgRef.current
		if (thumb?.complete) applyRatio(thumb.naturalWidth, thumb.naturalHeight)
		const full = fullImgRef.current
		if (full?.complete && full.naturalWidth > 0) {
			applyRatio(full.naturalWidth, full.naturalHeight, true)
			setFullReady(true)
		}
	}, [origin, photo?.url, thumbSrc])

	useEffect(() => {
		if (!photo) return
		const switched = openedIdRef.current !== photo.id
		openedIdRef.current = photo.id
		setThumbSrc(thumbUrl(photo.url))
		setFullReady(false)
		setFullFailed(false)
		setShowLoading(false)
		if (!switched) return
		const ratio = readCellAspect(photo.id)
		setBox(ratio ? fitZoomBox(ratio) : null)
	}, [photo?.id, photo?.url])

	useEffect(() => {
		if (!box || closing) return
		setLabelPos(captionPos(box))
	}, [box, closing, photo?.id])

	useEffect(() => {
		if (!photo) return
		void preloadOriginal(photo.url, 'high')
		if (total < 2) return
		const neighbors = [index === 0 ? total - 1 : index - 1, (index + 1) % total]
		for (const neighbor of neighbors) {
			const next = photos[neighbor]
			if (!next || !isCellThumbReady(next.id)) continue
			void preloadOriginal(next.url)
		}
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
		const next = transformFromCell(photo.id, wrapRef.current, box)
		setExit({ ...next, opacity: 0 })
		setClosing(true)
	}, [box, closing, photo])

	closeRef.current = close

	const goPrev = useCallback(() => {
		if (total < 2 || closing) return
		onIndexChange(index === 0 ? total - 1 : index - 1)
	}, [closing, index, onIndexChange, total])

	const goNext = useCallback(() => {
		if (total < 2 || closing) return
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
		const onResize = () => {
			setBox(current => {
				if (!current) return current
				return fitZoomBox(current.w / current.h)
			})
		}
		window.addEventListener('keydown', onKey)
		window.addEventListener('resize', onResize)
		return () => {
			document.body.style.overflow = previous
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('resize', onResize)
		}
	}, [goPrev, goNext])

	if (origin && !entryPoseRef.current) {
		entryPoseRef.current = { opacity: 0, x: origin.x, y: origin.y, scale: origin.scale }
	}

	if (typeof document === 'undefined' || !photo || !origin) return null

	const captionDate = dayjs(photoTime(photo)).isValid() ? dayjs(photoTime(photo)).format('YYYY年M月D日') : ''
	const hasInfo = Boolean(captionDate || photo.caption)

	return createPortal(
		<>
			<motion.div
				ref={backdropRef}
				initial={{ opacity: 0 }}
				animate={{ opacity: closing ? 0 : 1 }}
				transition={{ duration: closing ? 0.45 : 0.3 }}
				onClick={close}
				className='bg-card/80 fixed inset-0 z-[90] backdrop-blur-2xl backdrop-saturate-150'
			/>
			<div className='pointer-events-none fixed inset-0 z-[91] flex items-center justify-center'>
				<motion.div
					key={photo.id}
					ref={wrapRef}
					initial={photo.id === entryIdRef.current ? entryPoseRef.current! : SWITCH_INITIAL}
					animate={exit ?? REST_POSE}
					transition={closing ? { duration: 0.45, ease: [0.45, 0, 0.55, 1] } : { type: 'spring', stiffness: 260, damping: 24 }}
					onAnimationComplete={definition => {
						if (!definition || typeof definition !== 'object' || !('opacity' in definition) || definition.opacity !== 0) return
						onClose()
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
					style={{
						width: box?.w,
						height: box?.h,
						visibility: box ? 'visible' : 'hidden'
					}}
					className='pointer-events-auto relative overflow-hidden rounded-lg shadow-2xl'>
					<img
						ref={thumbImgRef}
						src={thumbSrc}
						alt=''
						aria-hidden='true'
						draggable={false}
						decoding='async'
						onLoad={event => {
							const img = event.currentTarget
							applyRatio(img.naturalWidth, img.naturalHeight)
						}}
						onError={() => {
							if (thumbSrc !== photo.url) setThumbSrc(photo.url)
						}}
						className='absolute inset-0 h-full w-full object-cover select-none'
					/>
					<img
						ref={fullImgRef}
						src={photo.url}
						alt={photo.caption || ''}
						draggable={false}
						decoding='async'
						fetchPriority='high'
						onLoad={event => {
							const img = event.currentTarget
							applyRatio(img.naturalWidth, img.naturalHeight, true)
							setFullReady(true)
						}}
						onError={() => setFullFailed(true)}
						className={`absolute inset-0 h-full w-full object-cover select-none transition-opacity duration-300 ${fullReady ? 'opacity-100' : 'opacity-0'}`}
					/>
					{showLoading && !fullReady && !fullFailed && (
						<div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
							<div className='h-8 w-8 animate-spin rounded-full border-2 border-white/50 border-t-white' />
						</div>
					)}
				</motion.div>
			</div>
			{!closing && hasInfo && labelPos && (
				<motion.div
					key={photo.id}
					drag
					dragConstraints={backdropRef}
					dragMomentum={false}
					initial={{ opacity: 0, scale: 0.4 }}
					animate={{ opacity: 1, scale: 1 }}
					onClick={event => event.stopPropagation()}
					style={{
						zIndex: 92,
						left: labelPos.left,
						top: labelPos.top,
						backgroundColor: 'rgb(255 255 255 / 40%)'
					}}
					data-album-caption
					role='note'
					className={`fixed cursor-grab rounded-md active:cursor-grabbing ${
						isMobileView()
							? 'w-max max-w-[min(220px,calc(100vw-24px))] p-3'
							: `w-[200px] p-6 ${photo.caption ? 'min-h-[150px]' : ''}`
					}`}>
					{captionDate && <div className='mb-2 text-[15px] font-bold text-black'>{captionDate}</div>}
					{photo.caption && <div className='max-h-64 overflow-y-auto text-sm text-black'>{photo.caption}</div>}
				</motion.div>
			)}
			{!closing && (
				<>
					<button
						type='button'
						onClick={close}
						aria-label='关闭'
						className='border-border fixed top-5 right-5 z-[93] flex h-10 w-10 items-center justify-center rounded-full border bg-white/70 text-lg shadow-md backdrop-blur-md transition-colors hover:bg-white/95'>
						×
					</button>
					{total > 1 && (
						<>
							<button
								type='button'
								onClick={goPrev}
								aria-label='上一张'
								className='border-border fixed top-1/2 left-4 z-[93] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-white/70 text-2xl shadow-md backdrop-blur-md transition-colors hover:bg-white/95 max-sm:left-2 max-sm:border-white/40 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none max-sm:hover:bg-transparent'>
								‹
							</button>
							<button
								type='button'
								onClick={goNext}
								aria-label='下一张'
								className='border-border fixed top-1/2 right-4 z-[93] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-white/70 text-2xl shadow-md backdrop-blur-md transition-colors hover:bg-white/95 max-sm:right-2 max-sm:border-white/40 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none max-sm:hover:bg-transparent'>
								›
							</button>
						</>
					)}
					<div className='border-border pointer-events-none fixed bottom-6 left-1/2 z-[93] -translate-x-1/2 rounded-full border bg-white/70 px-4 py-1.5 text-sm shadow-md backdrop-blur-md'>
						{index + 1} / {total}
					</div>
				</>
			)}
		</>,
		document.body
	)
}
