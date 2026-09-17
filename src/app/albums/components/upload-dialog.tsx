'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import { makeThumbFile } from '@/lib/file-utils'
import type { ImageItem } from '../../projects/components/image-upload-dialog'
import type { NamedAlbum } from '../types'

interface UploadDialogProps {
	albums: NamedAlbum[]
	onClose: () => void
	onSubmit: (payload: { images: ImageItem[]; caption?: string; takenAt?: string; albumIds: string[] }) => void
}

export default function UploadDialog({ albums, onClose, onSubmit }: UploadDialogProps) {
	const [caption, setCaption] = useState('')
	const [takenAt, setTakenAt] = useState('')
	const [albumIds, setAlbumIds] = useState<string[]>([])
	const [images, setImages] = useState<ImageItem[]>([])
	const [previewIndex, setPreviewIndex] = useState<number | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const preview = previewIndex !== null ? images[previewIndex] : undefined
	const previewSrc = preview?.type === 'file' ? preview.previewUrl : preview?.type === 'url' ? preview.url : ''

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || [])
		if (files.length === 0) return

		const nextImages: ImageItem[] = []
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				toast.error('请选择图片文件')
				return
			}
			const previewUrl = URL.createObjectURL(file)
			const item: ImageItem = { type: 'file', file, previewUrl }
			makeThumbFile(file)
				.then(thumb => {
					item.thumbFile = thumb
				})
				.catch(err => console.error('生成缩略图失败:', err))
			nextImages.push(item)
		}

		setImages(prev => [...prev, ...nextImages])
		event.target.value = ''
	}

	const removeImage = (index: number) => {
		setImages(prev => {
			const next = [...prev]
			const [removed] = next.splice(index, 1)
			if (removed?.type === 'file') URL.revokeObjectURL(removed.previewUrl)
			return next
		})
		setPreviewIndex(current => {
			if (current === null) return null
			if (current === index) return null
			return current > index ? current - 1 : current
		})
	}

	const handleSubmit = () => {
		if (images.length === 0) {
			toast.error('请至少选择一张图片')
			return
		}

		onSubmit({
			images,
			caption: caption.trim() || undefined,
			takenAt: takenAt ? new Date(takenAt).toISOString() : undefined,
			albumIds
		})
	}

	const handleClose = () => {
		images.forEach(image => {
			if (image.type === 'file') URL.revokeObjectURL(image.previewUrl)
		})
		onClose()
	}

	const toggleAlbum = (id: string) => {
		setAlbumIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
	}

	return (
		<>
			<DialogModal open onClose={handleClose} closeOnEsc={previewIndex === null} className='card w-2xl max-w-[calc(100vw-2rem)] max-sm:w-full'>
				<div className='space-y-4'>
					<h2 className='text-xl font-bold'>上传照片</h2>

					<div>
						<label className='text-secondary mb-2 block text-sm font-medium'>选择图片（可多选，点缩略图可预览）</label>
						<input ref={fileInputRef} type='file' accept='image/*' multiple className='hidden' onChange={handleFileSelect} />

						{images.length === 0 ? (
							<div
								onClick={() => fileInputRef.current?.click()}
								className='hover:bg-secondary/10 flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 transition-colors'>
								<div className='text-center'>
									<Plus className='mx-auto mb-1 h-8 w-8 text-gray-500' />
									<p className='text-secondary text-xs'>点击选择图片</p>
								</div>
							</div>
						) : (
							<>
								<div className='grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4'>
									{images.map((image, index) => {
										const src = image.type === 'file' ? image.previewUrl : image.url
										return (
											<div key={`${src}-${index}`} className='relative aspect-square'>
												<button
													type='button'
													onClick={() => setPreviewIndex(index)}
													className='h-full w-full overflow-hidden rounded-lg bg-white/40'>
													<img src={src} alt='' className='h-full w-full object-cover' />
												</button>
												<button
													type='button'
													onClick={() => removeImage(index)}
													aria-label='移除这张照片'
													className='absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-xs text-white'>
													×
												</button>
											</div>
										)
									})}
									<button
										type='button'
										onClick={() => fileInputRef.current?.click()}
										className='flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/50 text-xs text-gray-500 hover:bg-white'>
										+ 继续添加
									</button>
								</div>
								<p className='text-secondary mt-2 text-xs'>已选择 {images.length} 张，点缩略图查看大图</p>
							</>
						)}
					</div>

					<div>
						<label className='text-secondary mb-2 block text-sm font-medium'>说明（可选）</label>
						<textarea
							value={caption}
							onChange={event => setCaption(event.target.value)}
							placeholder='这批照片的说明...'
							className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
							rows={2}
						/>
					</div>

					<div>
						<label className='text-secondary mb-2 block text-sm font-medium'>拍摄时间（可选，不填则用上传时间）</label>
						<input
							type='datetime-local'
							value={takenAt}
							onChange={event => setTakenAt(event.target.value)}
							className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none'
						/>
					</div>

					{albums.length > 0 && (
						<div>
							<label className='text-secondary mb-2 block text-sm font-medium'>同时放入相簿（可选）</label>
							<div className='flex max-h-28 flex-wrap gap-2 overflow-y-auto'>
								{albums.map(album => (
									<label key={album.id} className='flex cursor-pointer items-center gap-1.5 rounded-full border bg-white/70 px-3 py-1 text-xs'>
										<input type='checkbox' checked={albumIds.includes(album.id)} onChange={() => toggleAlbum(album.id)} className='accent-brand' />
										{album.title}
									</label>
								))}
							</div>
						</div>
					)}

					<div className='mt-4 flex gap-3'>
						<button
							type='button'
							onClick={handleClose}
							className='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50'>
							取消
						</button>
						<button type='button' onClick={handleSubmit} className='brand-btn flex-1 justify-center px-4'>
							确认上传
						</button>
					</div>
				</div>
			</DialogModal>

			{previewSrc && (
				<DialogModal
					open
					onClose={() => setPreviewIndex(null)}
					overlayClassName='z-[70] bg-black/70'
					className='relative max-h-[90vh] max-w-[90vw]'>
					<img src={previewSrc} alt='' className='max-h-[80vh] max-w-[90vw] rounded-xl object-contain' />
					<div className='mt-3 flex items-center justify-between gap-3 text-sm text-white'>
						<span>
							{previewIndex !== null ? previewIndex + 1 : 0} / {images.length}
						</span>
						<div className='flex gap-2'>
							<button
								type='button'
								disabled={previewIndex === 0}
								onClick={() => setPreviewIndex(index => (index === null ? 0 : Math.max(0, index - 1)))}
								className='rounded-lg bg-white/20 px-3 py-1 disabled:opacity-40'>
								上一张
							</button>
							<button
								type='button'
								disabled={previewIndex === null || previewIndex >= images.length - 1}
								onClick={() => setPreviewIndex(index => (index === null ? 0 : Math.min(images.length - 1, index + 1)))}
								className='rounded-lg bg-white/20 px-3 py-1 disabled:opacity-40'>
								下一张
							</button>
							<button type='button' onClick={() => setPreviewIndex(null)} className='rounded-lg bg-white px-3 py-1 text-gray-800'>
								关闭
							</button>
						</div>
					</div>
				</DialogModal>
			)}
		</>
	)
}
