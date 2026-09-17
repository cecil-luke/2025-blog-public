'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import type { AlbumPhoto, NamedAlbum } from '../types'
import { AlbumThumb } from './album-thumb-img'
import { cn } from '@/lib/utils'

export function AlbumPickDialog({ albums, onClose, onPick }: { albums: NamedAlbum[]; onClose: () => void; onPick: (id: string) => void }) {
	return (
		<DialogModal open onClose={onClose} className='card w-md max-sm:w-full'>
			<div className='space-y-4'>
				<h2 className='text-xl font-bold'>加入哪一本相簿？</h2>
				<div className='flex max-h-64 flex-col gap-2 overflow-y-auto'>
					{albums.map(album => (
						<button
							type='button'
							key={album.id}
							onClick={() => onPick(album.id)}
							className='rounded-xl border bg-white/70 px-4 py-2 text-left text-sm hover:bg-white'>
							<div className='font-medium'>{album.title}</div>
							<div className='text-secondary text-xs'>{album.photoIds.length} 张</div>
						</button>
					))}
				</div>
				<button
					type='button'
					onClick={onClose}
					className='w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
					取消
				</button>
			</div>
		</DialogModal>
	)
}

export function AlbumDialog({
	album,
	photos = [],
	onClose,
	onSubmit
}: {
	album?: NamedAlbum | null
	photos?: AlbumPhoto[]
	onClose: () => void
	onSubmit: (input: { title: string; description?: string; coverPhotoId?: string }) => void
}) {
	const [title, setTitle] = useState(album?.title ?? '')
	const [description, setDescription] = useState(album?.description ?? '')
	const [coverPhotoId, setCoverPhotoId] = useState<string | undefined>(
		album?.coverPhotoId && photos.some(photo => photo.id === album.coverPhotoId) ? album.coverPhotoId : photos[0]?.id
	)

	const handleSubmit = () => {
		if (!title.trim()) {
			toast.error('请填写相簿名称')
			return
		}
		onSubmit({ title: title.trim(), description: description.trim() || undefined, coverPhotoId })
	}

	return (
		<DialogModal open onClose={onClose} className='card w-2xl max-w-[calc(100vw-2rem)] max-sm:w-full'>
			<div className='space-y-4'>
				<h2 className='text-xl font-bold'>{album ? '编辑相簿' : '新建相簿'}</h2>
				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>名称</label>
					<input
						value={title}
						onChange={event => setTitle(event.target.value)}
						placeholder='例如：2026 春天'
						className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
					/>
				</div>
				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>简介（可选）</label>
					<textarea
						value={description}
						onChange={event => setDescription(event.target.value)}
						rows={3}
						className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
					/>
				</div>
				{photos.length > 0 && (
					<div>
						<label className='text-secondary mb-2 block text-sm font-medium'>首页照片（相簿封面）</label>
						<p className='text-secondary mb-2 text-xs'>点选一张作为相簿货架上的封面。未选则用第一张。</p>
						<div className='grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6'>
							{photos.map(photo => (
								<button
									type='button'
									key={photo.id}
									onClick={() => setCoverPhotoId(photo.id)}
									className={cn(
										'aspect-square overflow-hidden rounded-lg',
										coverPhotoId === photo.id && 'ring-brand ring-2 ring-offset-1'
									)}>
									<AlbumThumb url={photo.url} className='h-full w-full object-cover' />
								</button>
							))}
						</div>
					</div>
				)}
				<div className='flex gap-3'>
					<button
						type='button'
						onClick={onClose}
						className='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
						取消
					</button>
					<button type='button' onClick={handleSubmit} className='brand-btn flex-1 justify-center px-4'>
						确定
					</button>
				</div>
			</div>
		</DialogModal>
	)
}
