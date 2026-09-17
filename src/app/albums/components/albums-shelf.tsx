'use client'

import type { AlbumLibrary } from '../types'
import { resolveCoverUrl, sortRecents } from '../library-utils'
import { AlbumThumb } from './album-thumb-img'
import { cn } from '@/lib/utils'

export function AlbumsShelf({
	library,
	isEditMode = false,
	onOpenRecents,
	onOpenAlbum,
	onRename,
	onDelete
}: {
	library: AlbumLibrary
	isEditMode?: boolean
	onOpenRecents: () => void
	onOpenAlbum: (slug: string) => void
	onRename?: (id: string) => void
	onDelete?: (id: string) => void
}) {
	const recentsCover = sortRecents(library.photos).slice(0, 4)

	return (
		<div className='grid grid-cols-2 gap-4 pb-24 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
			<button type='button' onClick={onOpenRecents} className='text-left'>
				<div className='aspect-square overflow-hidden rounded-3xl bg-white/30 p-1.5 shadow-sm'>
					<div className='grid h-full grid-cols-2 grid-rows-2 gap-1'>
						{Array.from({ length: 4 }).map((_, index) => {
							const photo = recentsCover[index]
							return (
								<div key={photo?.id ?? `empty-${index}`} className='overflow-hidden rounded-xl bg-white/25'>
									{photo ? <AlbumThumb url={photo.url} className='h-full w-full object-cover' /> : null}
								</div>
							)
						})}
					</div>
				</div>
				<div className='mt-2 px-1'>
					<div className='text-sm font-medium'>最近项目</div>
					<div className='text-secondary text-xs'>{library.photos.length} 张</div>
				</div>
			</button>

			{library.albums.map(album => {
				const coverUrl = resolveCoverUrl(album, library.photos)
				return (
					<div key={album.id} className='relative'>
						<button type='button' onClick={() => onOpenAlbum(album.slug)} className='w-full text-left'>
							<div className={cn('aspect-square overflow-hidden rounded-3xl bg-white/30 shadow-sm', !coverUrl && 'flex items-center justify-center')}>
								{coverUrl ? <AlbumThumb url={coverUrl} className='h-full w-full object-cover' /> : <span className='text-secondary text-xs'>空相簿</span>}
							</div>
							<div className='mt-2 px-1'>
								<div className='line-clamp-1 text-sm font-medium'>{album.title}</div>
								<div className='text-secondary text-xs'>{album.photoIds.length} 张</div>
							</div>
						</button>
						{isEditMode && (
							<div className='absolute top-2 right-2 flex gap-1'>
								{onRename && (
									<button
										type='button'
										onClick={event => {
											event.stopPropagation()
											onRename(album.id)
										}}
										className='rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white'>
										重命名
									</button>
								)}
								{onDelete && (
									<button
										type='button'
										onClick={event => {
											event.stopPropagation()
											if (confirm(`删除相簿「${album.title}」不会删除照片，只取消引用。确定吗？`)) onDelete(album.id)
										}}
										className='rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white'>
										删除
									</button>
								)}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
