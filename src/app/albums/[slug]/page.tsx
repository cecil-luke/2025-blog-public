'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useAlbumsStore } from '../stores/albums-store'
import { albumPhotos } from '../library-utils'
import { AlbumsChrome } from '../components/albums-chrome'
import { RecentsGrid } from '../components/recents-grid'
import { PhotoViewer } from '../components/photo-viewer'
import { AlbumDialog } from '../components/album-dialog'
import { MembershipDialog } from '../components/membership-dialog'

export default function Page() {
	const params = useParams() as { slug?: string | string[] }
	const rawSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || ''
	let slug = rawSlug
	try {
		slug = decodeURIComponent(rawSlug)
	} catch {
		slug = rawSlug
	}
	const router = useRouter()
	const { library, isEditMode, updateAlbum, deleteAlbum, removeFromAlbum, setCover, setAlbumPhotos } = useAlbumsStore()
	const album = library.albums.find(item => item.slug === slug)
	const photos = useMemo(() => (album ? albumPhotos(album, library.photos) : []), [album, library.photos])
	const [viewerIndex, setViewerIndex] = useState<number | null>(null)
	const [renameOpen, setRenameOpen] = useState(false)
	const [membershipOpen, setMembershipOpen] = useState(false)

	if (!album) {
		return (
			<AlbumsChrome title='相簿不存在' count={0} backHref='/albums?tab=albums' backLabel='相簿'>
				<div className='text-secondary flex min-h-[40vh] items-center justify-center text-sm'>这本相簿不存在或已被删除。</div>
			</AlbumsChrome>
		)
	}

	return (
		<AlbumsChrome
			title={album.title}
			count={photos.length}
			backHref='/albums?tab=albums'
			backLabel='相簿'
			extraEditButtons={
				<>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => setRenameOpen(true)}
						className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
						编辑
					</motion.button>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => setMembershipOpen(true)}
						className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
						加入照片
					</motion.button>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => {
							if (!confirm(`删除相簿「${album.title}」不会删除照片。确定吗？`)) return
							deleteAlbum(album.id)
							router.push('/albums?tab=albums')
						}}
						className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
						删除相簿
					</motion.button>
				</>
			}>
			{album.description && <p className='text-secondary mb-4 text-sm'>{album.description}</p>}
			<RecentsGrid
				photos={photos}
				isEditMode={isEditMode}
				coverPhotoId={album.coverPhotoId}
				onRemove={id => removeFromAlbum(album.id, id)}
				onSetCover={id => setCover(album.id, id)}
				onOpen={id => setViewerIndex(photos.findIndex(photo => photo.id === id))}
				emptyText={isEditMode ? '这本相簿还是空的，点击右上角加入照片。' : '这本相簿还是空的'}
			/>

			{viewerIndex !== null && photos[viewerIndex] && (
				<PhotoViewer photos={photos} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
			)}

			{renameOpen && (
				<AlbumDialog
					album={album}
					photos={photos}
					onClose={() => setRenameOpen(false)}
					onSubmit={input => {
						updateAlbum(album.id, input)
						setRenameOpen(false)
					}}
				/>
			)}

			{membershipOpen && (
				<MembershipDialog
					album={album}
					photos={library.photos}
					onClose={() => setMembershipOpen(false)}
					onSubmit={photoIds => {
						setAlbumPhotos(album.id, photoIds)
						setMembershipOpen(false)
					}}
				/>
			)}
		</AlbumsChrome>
	)
}
