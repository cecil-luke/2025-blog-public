'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { useAlbumsStore } from './stores/albums-store'
import { sortRecents, newPhotoId } from './library-utils'
import { AlbumsChrome } from './components/albums-chrome'
import { RecentsGrid } from './components/recents-grid'
import { AlbumsShelf } from './components/albums-shelf'
import { PhotoViewer } from './components/photo-viewer'
import UploadDialog from './components/upload-dialog'
import { AlbumDialog, AlbumPickDialog } from './components/album-dialog'
import { MembershipDialog } from './components/membership-dialog'
import type { AlbumPhoto } from './types'
import type { ImageItem } from '../projects/components/image-upload-dialog'

export default function Page() {
	return (
		<Suspense fallback={<div className='text-secondary flex min-h-screen items-center justify-center text-sm'>加载相册...</div>}>
			<AlbumsHome />
		</Suspense>
	)
}

function AlbumsHome() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const tab = searchParams.get('tab') === 'albums' ? 'albums' : 'recents'
	const { library, isEditMode, addPhotos, deletePhoto, createAlbum, updateAlbum, deleteAlbum, setAlbumPhotos } = useAlbumsStore()
	const photos = useMemo(() => sortRecents(library.photos), [library.photos])
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [viewerIndex, setViewerIndex] = useState<number | null>(null)
	const [uploadOpen, setUploadOpen] = useState(false)
	const [albumDialog, setAlbumDialog] = useState<'create' | string | null>(null)
	const [membershipAlbumId, setMembershipAlbumId] = useState<string | null>(null)
	const [pickingAlbum, setPickingAlbum] = useState(false)

	useLayoutEffect(() => {
		// html 设了 scroll-behavior: smooth。从首页滚下来再点进相册时,
		// 路由会把旧的滚动位置平滑滑回顶部,看起来像从最近照片底部往上滑。
		const root = document.documentElement
		const previous = root.style.scrollBehavior
		root.style.scrollBehavior = 'auto'
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
		const frame = requestAnimationFrame(() => {
			root.style.scrollBehavior = previous
		})
		return () => {
			cancelAnimationFrame(frame)
			root.style.scrollBehavior = previous
		}
	}, [])

	useEffect(() => {
		if (!isEditMode) setSelectedIds(new Set())
	}, [isEditMode])

	const setTab = (value: 'recents' | 'albums') => {
		router.replace(value === 'albums' ? '/albums?tab=albums' : '/albums')
	}

	const handleUpload = ({ images, caption, takenAt, albumIds }: { images: ImageItem[]; caption?: string; takenAt?: string; albumIds: string[] }) => {
		const now = new Date().toISOString()
		const items = new Map<string, ImageItem>()
		const nextPhotos: AlbumPhoto[] = images.map(image => {
			const id = newPhotoId()
			if (image.type === 'file') items.set(id, image)
			const url = image.type === 'file' ? image.previewUrl : image.url
			return { id, url, uploadedAt: now, caption, takenAt }
		})
		addPhotos(nextPhotos, items, albumIds)
		setUploadOpen(false)
	}

	const editingAlbum = typeof albumDialog === 'string' ? library.albums.find(album => album.id === albumDialog) : undefined
	const membershipAlbum = membershipAlbumId ? library.albums.find(album => album.id === membershipAlbumId) : undefined

	return (
		<AlbumsChrome
			title='相册'
			count={photos.length}
			backHref='/'
			backLabel='首页'
			tab={tab}
			onTabChange={setTab}
			extraEditButtons={
				<>
					{tab === 'recents' && selectedIds.size > 0 && library.albums.length > 0 && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => {
								if (library.albums.length === 1) setMembershipAlbumId(library.albums[0].id)
								else setPickingAlbum(true)
							}}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							加入相簿
						</motion.button>
					)}
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => setAlbumDialog('create')}
						className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
						新建相簿
					</motion.button>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => setUploadOpen(true)}
						className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
						上传
					</motion.button>
				</>
			}>
			{tab === 'recents' ? (
				<RecentsGrid
					photos={photos}
					isEditMode={isEditMode}
					selectedIds={selectedIds}
					onToggleSelect={id =>
						setSelectedIds(prev => {
							const next = new Set(prev)
							if (next.has(id)) next.delete(id)
							else next.add(id)
							return next
						})
					}
					onDelete={deletePhoto}
					onOpen={id => setViewerIndex(photos.findIndex(photo => photo.id === id))}
					emptyText={isEditMode ? '还没有照片，点击右上角上传。' : '还没有照片'}
				/>
			) : (
				<AlbumsShelf
					library={library}
					isEditMode={isEditMode}
					onOpenRecents={() => setTab('recents')}
					onOpenAlbum={slug => router.push(`/albums/${slug}`)}
					onRename={id => setAlbumDialog(id)}
					onDelete={deleteAlbum}
				/>
			)}

			{viewerIndex !== null && photos[viewerIndex] && (
				<PhotoViewer photos={photos} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
			)}

			{uploadOpen && <UploadDialog albums={library.albums} onClose={() => setUploadOpen(false)} onSubmit={handleUpload} />}

			{albumDialog !== null && (
				<AlbumDialog
					album={editingAlbum}
					photos={
						albumDialog === 'create'
							? selectedIds.size > 0
								? photos.filter(photo => selectedIds.has(photo.id))
								: photos
							: editingAlbum
								? photos.filter(photo => editingAlbum.photoIds.includes(photo.id))
								: []
					}
					onClose={() => setAlbumDialog(null)}
					onSubmit={input => {
						if (albumDialog === 'create') {
							const fromSelection = selectedIds.size > 0 ? [...selectedIds] : []
							const photoIds = input.coverPhotoId ? [...new Set([...fromSelection, input.coverPhotoId])] : fromSelection
							const album = createAlbum({
								...input,
								photoIds: photoIds.length > 0 ? photoIds : undefined,
								coverPhotoId: input.coverPhotoId
							})
							setSelectedIds(new Set())
							setAlbumDialog(null)
							router.push(`/albums/${album.slug}`)
						} else {
							updateAlbum(albumDialog, input)
							setAlbumDialog(null)
						}
					}}
				/>
			)}

			{pickingAlbum && (
				<AlbumPickDialog
					albums={library.albums}
					onClose={() => setPickingAlbum(false)}
					onPick={id => {
						setPickingAlbum(false)
						setMembershipAlbumId(id)
					}}
				/>
			)}

			{membershipAlbum && (
				<MembershipDialog
					album={selectedIds.size > 0 ? { ...membershipAlbum, photoIds: [...new Set([...membershipAlbum.photoIds, ...selectedIds])] } : membershipAlbum}
					photos={library.photos}
					onClose={() => setMembershipAlbumId(null)}
					onSubmit={photoIds => {
						setAlbumPhotos(membershipAlbum.id, photoIds)
						setSelectedIds(new Set())
						setMembershipAlbumId(null)
					}}
				/>
			)}
		</AlbumsChrome>
	)
}
