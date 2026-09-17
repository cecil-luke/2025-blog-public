'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { AlbumPhoto } from '../types'
import { groupByMonth, sortRecents } from '../library-utils'
import { AlbumThumb } from './album-thumb-img'

const BATCH = 48

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

	const groups = groupByMonth(sortRecents(photos).slice(0, visibleCount))

	return (
		<div className='pb-24'>
			{groups.map(group => (
				<section key={group.key} className='mb-6'>
					<h2 className='bg-bg/80 text-secondary sticky top-0 z-10 px-1 py-2 text-sm font-medium backdrop-blur-md'>{group.label}</h2>
					<div className='grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8'>
						{group.photos.map(photo => {
							const selected = selectedIds?.has(photo.id) ?? false
							return (
								<div key={photo.id} className='relative aspect-square'>
									<button
										type='button'
										data-album-photo={photo.id}
										onClick={() => onOpen(photo.id)}
										className={cn(
											'h-full w-full overflow-hidden rounded-lg bg-white/30',
											selected && 'ring-brand ring-2 ring-offset-1 ring-offset-transparent'
										)}>
										<AlbumThumb url={photo.url} className='h-full w-full object-cover' />
									</button>
									{coverPhotoId === photo.id && (
										<span className='pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] text-white'>封面</span>
									)}
									{isEditMode && onToggleSelect && (
										<button
											type='button'
											onClick={event => {
												event.stopPropagation()
												onToggleSelect(photo.id)
											}}
											aria-label={selected ? '取消选择' : '选择照片'}
											className={cn(
												'absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] text-white',
												selected ? 'border-brand bg-brand' : 'border-white/80 bg-black/45'
											)}>
											{selected ? '✓' : ''}
										</button>
									)}
									{isEditMode && (
										<div className='absolute top-1 right-1 flex flex-col gap-1'>
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
													className={cn('rounded-full px-1.5 py-0.5 text-[10px] text-white', coverPhotoId === photo.id ? 'bg-brand' : 'bg-black/60')}>
													{coverPhotoId === photo.id ? '封面' : '设为封面'}
												</button>
											)}
										</div>
									)}
								</div>
							)
						})}
					</div>
				</section>
			))}
			<div ref={sentinelRef} className='h-8' />
		</div>
	)
}
