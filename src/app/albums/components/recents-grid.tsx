'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { AlbumPhoto } from '../types'
import { groupByDay, sortRecents } from '../library-utils'
import { AlbumThumb } from './album-thumb-img'
import { preloadOriginal } from './album-thumb'

const BATCH = 48

function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false)
	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)')
		const apply = () => setReduced(media.matches)
		apply()
		media.addEventListener('change', apply)
		return () => media.removeEventListener('change', apply)
	}, [])
	return reduced
}

function dockHover(index: number, hoverIdx: number | null, cols: number): -1 | 0 | 1 {
	if (hoverIdx === null) return -1
	if (index === hoverIdx) return 0
	if (Math.floor(index / cols) !== Math.floor(hoverIdx / cols)) return -1
	return Math.abs(index - hoverIdx) === 1 ? 1 : -1
}

function dockOrigin(index: number, cols: number): 'left' | 'right' | 'center' {
	const col = index % cols
	if (col === 0) return 'left'
	if (col === cols - 1) return 'right'
	return 'center'
}

export function RecentsGrid({
	photos,
	isEditMode = false,
	selectedIds,
	coverPhotoId,
	onToggleSelect,
	onDelete,
	onRemove,
	onSetCover,
	onOpen,
	emptyText
}: {
	photos: AlbumPhoto[]
	isEditMode?: boolean
	selectedIds?: Set<string>
	coverPhotoId?: string
	onToggleSelect?: (id: string) => void
	onDelete?: (id: string) => void
	onRemove?: (id: string) => void
	onSetCover?: (id: string) => void
	onOpen: (id: string) => void
	emptyText: string
}) {
	const [visibleCount, setVisibleCount] = useState(BATCH)
	const sentinelRef = useRef<HTMLDivElement>(null)
	const reducedMotion = usePrefersReducedMotion()

	useEffect(() => {
		setVisibleCount(BATCH)
	}, [photos.length])

	useEffect(() => {
		const node = sentinelRef.current
		if (!node) return
		const observer = new IntersectionObserver(
			entries => {
				if (entries.some(entry => entry.isIntersecting)) {
					setVisibleCount(count => Math.min(photos.length, count + BATCH))
				}
			},
			{ rootMargin: '400px 0px' }
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [photos.length])

	if (photos.length === 0) {
		return <div className='text-secondary flex min-h-[40vh] items-center justify-center text-sm'>{emptyText}</div>
	}

	const groups = groupByDay(sortRecents(photos).slice(0, visibleCount))

	return (
		<div className='pb-24'>
			{groups.map(group => (
				<DayGrid
					key={group.key}
					label={group.label}
					photos={group.photos}
					isEditMode={isEditMode}
					selectedIds={selectedIds}
					coverPhotoId={coverPhotoId}
					canHover={!reducedMotion}
					onToggleSelect={onToggleSelect}
					onDelete={onDelete}
					onRemove={onRemove}
					onSetCover={onSetCover}
					onOpen={onOpen}
				/>
			))}
			<div ref={sentinelRef} className='h-8' />
		</div>
	)
}

function DayGrid({
	label,
	photos,
	isEditMode,
	selectedIds,
	coverPhotoId,
	canHover,
	onToggleSelect,
	onDelete,
	onRemove,
	onSetCover,
	onOpen
}: {
	label: string
	photos: AlbumPhoto[]
	isEditMode: boolean
	selectedIds?: Set<string>
	coverPhotoId?: string
	canHover: boolean
	onToggleSelect?: (id: string) => void
	onDelete?: (id: string) => void
	onRemove?: (id: string) => void
	onSetCover?: (id: string) => void
	onOpen: (id: string) => void
}) {
	const gridRef = useRef<HTMLDivElement>(null)
	const [cols, setCols] = useState(4)
	const [hoverIdx, setHoverIdx] = useState<number | null>(null)

	useEffect(() => {
		const grid = gridRef.current
		if (!grid) return
		const measure = () => {
			const cell = grid.querySelector('[data-album-photo]')
			if (!(cell instanceof HTMLElement)) return
			const width = cell.getBoundingClientRect().width
			if (width <= 0) return
			const gap = 4
			setCols(Math.max(1, Math.round((grid.clientWidth + gap) / (width + gap))))
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(grid)
		return () => observer.disconnect()
	}, [photos.length])

	return (
		<section className='mb-6 overflow-visible'>
			<h2 className='text-secondary px-1 py-2 text-sm font-medium'>{label}</h2>
			<div ref={gridRef} className='grid grid-cols-4 gap-1 overflow-visible py-2 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8'>
				{photos.map((photo, index) => (
					<PhotoTile
						key={photo.id}
						photo={photo}
						hover={canHover ? dockHover(index, hoverIdx, cols) : -1}
						origin={dockOrigin(index, cols)}
						selected={selectedIds?.has(photo.id) ?? false}
						isCover={coverPhotoId === photo.id}
						isEditMode={isEditMode}
						onHoverEnter={() => {
							if (canHover) setHoverIdx(index)
						}}
						onHoverLeave={() => setHoverIdx(current => (current === index ? null : current))}
						onOpen={() => {
							setHoverIdx(null)
							onOpen(photo.id)
						}}
						onToggleSelect={onToggleSelect}
						onDelete={onDelete}
						onRemove={onRemove}
						onSetCover={onSetCover}
					/>
				))}
			</div>
		</section>
	)
}

function PhotoTile({
	photo,
	hover,
	origin,
	selected,
	isCover,
	isEditMode,
	onHoverEnter,
	onHoverLeave,
	onOpen,
	onToggleSelect,
	onDelete,
	onRemove,
	onSetCover
}: {
	photo: AlbumPhoto
	hover: -1 | 0 | 1
	origin: 'left' | 'right' | 'center'
	selected: boolean
	isCover: boolean
	isEditMode: boolean
	onHoverEnter: () => void
	onHoverLeave: () => void
	onOpen: () => void
	onToggleSelect?: (id: string) => void
	onDelete?: (id: string) => void
	onRemove?: (id: string) => void
	onSetCover?: (id: string) => void
}) {
	const [thumbLoaded, setThumbLoaded] = useState(false)
	const scale = hover === 0 ? 1.45 : hover === 1 ? 1.18 : 1
	const lift = hover === 0 ? -12 : hover === 1 ? -4 : 0
	const z = hover === 0 ? 50 : hover === 1 ? 45 : 2

	useEffect(() => {
		if (hover !== 0 || !thumbLoaded) return
		void preloadOriginal(photo.url)
	}, [hover, thumbLoaded, photo.url])

	return (
		<motion.div
			initial={false}
			animate={{ scale, y: lift }}
			transition={{ type: 'spring', stiffness: 300, damping: 22 }}
			onMouseEnter={onHoverEnter}
			onMouseLeave={onHoverLeave}
			style={{ zIndex: z }}
			className={cn(
				'relative aspect-square overflow-visible',
				origin === 'left' && 'origin-left',
				origin === 'right' && 'origin-right',
				origin === 'center' && 'origin-center'
			)}>
			<button
				type='button'
				data-album-photo={photo.id}
				onClick={onOpen}
				style={{ boxShadow: hover === 0 ? '0 24px 48px rgba(0,0,0,0.32)' : undefined }}
				className={cn(
					'h-full w-full overflow-hidden rounded-lg border-2 border-white bg-white/30 shadow-sm',
					selected && 'ring-brand ring-2 ring-offset-1 ring-offset-transparent'
				)}>
				<AlbumThumb url={photo.url} className='h-full w-full object-cover' onLoad={() => setThumbLoaded(true)} />
			</button>
			{isCover && <span className='pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] text-white'>封面</span>}
			{isEditMode && onToggleSelect && (
				<button
					type='button'
					onClick={event => {
						event.stopPropagation()
						onToggleSelect(photo.id)
					}}
					aria-label={selected ? '取消选择' : '选择照片'}
					className={cn(
						'absolute top-1 left-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] text-white',
						selected ? 'border-brand bg-brand' : 'border-white/80 bg-black/45'
					)}>
					{selected ? '✓' : ''}
				</button>
			)}
			{isEditMode && (
				<div className='absolute top-1 right-1 z-10 flex flex-col gap-1'>
					{onDelete && (
						<button
							type='button'
							onClick={event => {
								event.stopPropagation()
								if (confirm('从最近项目删除后，原图和缩略图都会被删除。确定吗？')) onDelete(photo.id)
							}}
							className='flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white'
							aria-label='删除照片'>
							×
						</button>
					)}
					{onRemove && (
						<button
							type='button'
							onClick={event => {
								event.stopPropagation()
								onRemove(photo.id)
							}}
							className='rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white'
							aria-label='移出相簿'>
							移出
						</button>
					)}
					{onSetCover && (
						<button
							type='button'
							onClick={event => {
								event.stopPropagation()
								onSetCover(photo.id)
							}}
							className={cn('rounded-full px-1.5 py-0.5 text-[10px] text-white', isCover ? 'bg-brand' : 'bg-black/60')}>
							{isCover ? '封面' : '设为封面'}
						</button>
					)}
				</div>
			)}
		</motion.div>
	)
}
