'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import { RangeSlider } from '@/components/range-slider'
import { makeThumbFile, makeWebpFile } from '@/lib/file-utils'
import type { ImageItem } from '../../projects/components/image-upload-dialog'

interface UploadDialogProps {
	onClose: () => void
	onSubmit: (payload: { images: ImageItem[]; description: string; uploadedAt?: string }) => void
}

type CompressProgress = { current: number; total: number }

export default function UploadDialog({ onClose, onSubmit }: UploadDialogProps) {
	const [description, setDescription] = useState('')
	const [uploadedAt, setUploadedAt] = useState('')
	const [images, setImages] = useState<ImageItem[]>([])
	const [quality, setQuality] = useState(0.9)
	const [limitMaxWidth, setLimitMaxWidth] = useState(true)
	const [maxWidth, setMaxWidth] = useState(1200)
	const [compressing, setCompressing] = useState<CompressProgress | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const busy = compressing !== null

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || [])
		if (files.length === 0) return

		const nextImages: ImageItem[] = []
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				toast.error('请选择图片文件')
				return
			}
			nextImages.push({ type: 'file', file, previewUrl: URL.createObjectURL(file) })
		}

		setImages(prev => [...prev, ...nextImages])
		event.target.value = ''
	}

	const handleSubmit = async () => {
		if (busy) return
		if (images.length === 0) {
			toast.error('请至少选择一张图片')
			return
		}

		const fileCount = images.filter(image => image.type === 'file').length
		const compressed: ImageItem[] = []
		setCompressing({ current: 0, total: Math.max(fileCount, 1) })

		try {
			let done = 0
			for (const image of images) {
				if (image.type !== 'file') {
					compressed.push(image)
					continue
				}
				done += 1
				setCompressing({ current: done, total: fileCount })
				const webp = await makeWebpFile(image.file, quality, limitMaxWidth ? maxWidth : undefined)
				const thumbFile = await makeThumbFile(webp)
				URL.revokeObjectURL(image.previewUrl)
				compressed.push({
					type: 'file',
					file: webp,
					previewUrl: URL.createObjectURL(webp),
					thumbFile
				})
			}
			onSubmit({
				images: compressed,
				description,
				uploadedAt: uploadedAt ? new Date(uploadedAt).toISOString() : undefined
			})
			setImages([])
			setDescription('')
			setUploadedAt('')
			onClose()
		} catch (error) {
			console.error(error)
			toast.error('压缩失败，请稍后再试')
			compressed.forEach(image => {
				if (image.type === 'file') URL.revokeObjectURL(image.previewUrl)
			})
			setCompressing(null)
		}
	}

	const handleClose = () => {
		if (busy) return
		images.forEach(image => {
			if (image.type === 'file') URL.revokeObjectURL(image.previewUrl)
		})
		setImages([])
		setDescription('')
		setUploadedAt('')
		onClose()
	}

	const compressPercent = compressing ? Math.round((compressing.current / Math.max(compressing.total, 1)) * 100) : 0

	return (
		<DialogModal open onClose={handleClose} closeOnEsc={!busy} disableCloseOnOverlay={busy} className='card w-2xl max-w-[calc(100vw-2rem)] max-sm:w-full'>
			<div className='space-y-4'>
				<h2 className='text-xl font-bold'>上传图片</h2>

				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>选择图片（可多选）</label>
					<input ref={fileInputRef} type='file' accept='image/*' multiple className='hidden' onChange={handleFileSelect} disabled={busy} />

					{images.length === 0 ? (
						<div
							onClick={() => !busy && fileInputRef.current?.click()}
							className='hover:bg-secondary/10 flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 transition-colors'>
							<div className='text-center'>
								<Plus className='mx-auto mb-1 h-8 w-8 text-gray-500' />
								<p className='text-secondary text-xs'>点击选择图片</p>
							</div>
						</div>
					) : (
						<>
							<div className='relative flex h-40 items-center justify-center overflow-visible rounded-xl bg-linear-to-br from-gray-50 to-gray-100'>
								{images.slice(0, 3).map((image, index) =>
									image.type === 'file' ? (
										<div
											key={`${image.previewUrl}-${index}`}
											className={`absolute h-32 w-44 overflow-hidden rounded-xl border-4 border-white bg-white shadow-xl transition-transform ${
												index === 0 ? '-left-4 -translate-y-2 -rotate-6' : index === 1 ? 'z-20 rotate-1' : 'right-0 translate-y-2 rotate-6'
											}`}>
											<img src={image.previewUrl} alt={`preview-${index}`} className='h-full w-full object-cover' />
										</div>
									) : null
								)}

								{images.length > 3 && (
									<div className='absolute right-4 -bottom-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white shadow-lg'>共 {images.length} 张</div>
								)}
							</div>

							<div className='mt-3 flex items-center justify-between'>
								<span className='text-secondary text-xs'>已选择 {images.length} 张图片</span>
								<button
									type='button'
									disabled={busy}
									onClick={() => fileInputRef.current?.click()}
									className='rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40'>
									继续添加
								</button>
							</div>
						</>
					)}
				</div>

				<div className='rounded-xl border bg-white/50 p-3'>
					<div className='mb-2 flex items-center justify-between gap-2'>
						<label className='text-secondary text-sm font-medium'>压缩（图片工具箱）</label>
						<Link href='/image-toolbox' target='_blank' className='text-brand text-xs hover:underline'>
							打开 /image-toolbox
						</Link>
					</div>
					<div>
						<div className='text-secondary mb-1 flex items-center justify-between text-xs'>
							<label htmlFor='pictures-compress-quality' className='font-medium'>
								质量
							</label>
							<span className='font-medium'>{Math.round(quality * 100)}%</span>
						</div>
						<RangeSlider
							id='pictures-compress-quality'
							min={0.3}
							max={1}
							step={0.05}
							value={quality}
							disabled={busy}
							aria-label='压缩质量'
							className='w-full'
							onValueChange={setQuality}
						/>
					</div>
					<div className='mt-3 flex flex-wrap items-center gap-3'>
						<label className='text-secondary flex cursor-pointer items-center gap-2 text-xs'>
							<input
								type='checkbox'
								checked={limitMaxWidth}
								disabled={busy}
								onChange={event => setLimitMaxWidth(event.target.checked)}
								className='accent-brand h-4 w-4'
							/>
							限制最大宽度
						</label>
						{limitMaxWidth && (
							<div className='flex items-center gap-1.5'>
								<input
									type='number'
									min={100}
									max={10000}
									step={100}
									value={maxWidth}
									disabled={busy}
									onChange={event => setMaxWidth(Math.max(100, parseInt(event.target.value) || 1200))}
									className='w-24 rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm'
								/>
								<span className='text-secondary text-xs'>px</span>
							</div>
						)}
					</div>
					<p className='text-secondary mt-2 text-xs'>确认后先按以上参数转成 WEBP，再写入仓库，不保存原图。</p>
				</div>

				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>描述（可选，应用于本次所有图片）</label>
					<textarea
						value={description}
						disabled={busy}
						onChange={event => setDescription(event.target.value)}
						placeholder='这组图片的说明...'
						className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none disabled:opacity-60'
						rows={3}
					/>
				</div>

				<div>
					<label className='text-secondary mb-2 block text-sm font-medium'>时间（可选，不填则用上传图片的时间）</label>
					<input
						type='datetime-local'
						value={uploadedAt}
						disabled={busy}
						onChange={event => setUploadedAt(event.target.value)}
						className='w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none disabled:opacity-60'
					/>
				</div>

				{compressing && (
					<div className='space-y-1.5'>
						<div className='text-secondary flex items-center justify-between text-xs'>
							<span>
								正在压缩 {compressing.current} / {compressing.total}
							</span>
							<span>{compressPercent}%</span>
						</div>
						<div className='h-2 overflow-hidden rounded-full bg-black/10'>
							<div className='bg-brand h-full transition-all' style={{ width: `${compressPercent}%` }} />
						</div>
					</div>
				)}

				<div className='mt-4 flex gap-3'>
					<button
						type='button'
						onClick={handleClose}
						disabled={busy}
						className='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50'>
						取消
					</button>
					<button type='button' onClick={() => void handleSubmit()} disabled={busy} className='brand-btn flex-1 justify-center px-4 disabled:opacity-70'>
						{busy ? `压缩中 ${compressing.current}/${compressing.total}` : '确认上传'}
					</button>
				</div>
			</div>
		</DialogModal>
	)
}
