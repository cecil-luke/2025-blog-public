'use client'

import { useState } from 'react'
import { DialogModal } from '@/components/dialog-modal'
import type { AlbumPhoto, NamedAlbum } from '../types'
import { sortRecents } from '../library-utils'
import { AlbumThumb } from './album-thumb-img'
import { cn } from '@/lib/utils'

export function MembershipDialog({
	album,
	photos,
	onClose,
	onSubmit
}: {
	album: NamedAlbum
	photos: AlbumPhoto[]
	onClose: () => void
	onSubmit: (photoIds: string[]) => void
}) {
	const [selected, setSelected] = useState<Set<string>>(() => new Set(album.photoIds))
	const recents = sortRecents(photos)

	const toggle = (id: string) => {
		setSelected(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	return (
		<DialogModal open onClose={onClose} className='card w-2xl max-w-[calc(100vw-2rem)] max-sm:w-full'>
			<div className='space-y-4'>
				<div>
					<h2 className='text-xl font-bold'>加入「{album.title}」</h2>
					<p className='text-secondary mt-1 text-xs'>从最近项目勾选照片。取消勾选会从相簿移除引用，不会删除原图。</p>
				</div>
				{recents.length === 0 ? (
					<div className='text-secondary py-10 text-center text-sm'>最近项目还没有照片</div>
				) : (
					<div className='grid max-h-[50vh] grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6'>
						{recents.map(photo => (
							<button
								type='button'
								key={photo.id}
								onClick={() => toggle(photo.id)}
								className={cn('aspect-square overflow-hidden rounded-lg', selected.has(photo.id) && 'ring-brand ring-2 ring-offset-1')}>
								<AlbumThumb url={photo.url} className='h-full w-full object-cover' />
							</button>
						))}
					</div>
				)}
				<div className='flex items-center justify-between gap-3'>
					<span className='text-secondary text-xs'>已选 {selected.size} 张</span>
					<div className='flex gap-3'>
						<button type='button' onClick={onClose} className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
							取消
						</button>
						<button type='button' onClick={() => onSubmit([...selected])} className='brand-btn px-4'>
							确定
						</button>
					</div>
				</div>
			</div>
		</DialogModal>
	)
}
