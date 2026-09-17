'use client'

import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import Link from 'next/link'
import { HomeDraggableLayer } from './home-draggable-layer'
import { useAlbumsStore } from '@/app/albums/stores/albums-store'
import { sortRecents } from '@/app/albums/library-utils'
import { thumbUrl } from '@/app/albums/components/album-thumb'
import { cn } from '@/lib/utils'

const HOVER_SHIFT = [
	'group-hover:-translate-x-0.5 group-hover:-translate-y-1 group-hover:-rotate-2 group-hover:scale-105',
	'group-hover:translate-x-0.5 group-hover:-translate-y-1 group-hover:rotate-2 group-hover:scale-105',
	'group-hover:-translate-x-0.5 group-hover:translate-y-0.5 group-hover:rotate-1 group-hover:scale-105',
	'group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:-rotate-1 group-hover:scale-105'
]

export default function AlbumCard() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const styles = cardStyles.albumCard
	if (!styles) return null

	const hiCardStyles = cardStyles.hiCard
	const shareStyles = cardStyles.shareCard
	const socialButtonsStyles = cardStyles.socialButtons

	const x =
		styles.offsetX !== null ? center.x + styles.offsetX : center.x + hiCardStyles.width / 2 - socialButtonsStyles.width + shareStyles.width + CARD_SPACING
	const y = styles.offsetY !== null ? center.y + styles.offsetY : center.y + hiCardStyles.height / 2 + CARD_SPACING + socialButtonsStyles.height + CARD_SPACING

	const libraryPhotos = useAlbumsStore(state => state.library.photos)
	const photos = sortRecents(libraryPhotos).slice(0, 4)
	const count = libraryPhotos.length

	return (
		<HomeDraggableLayer cardKey='albumCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card className='cursor-pointer p-3 max-sm:static max-sm:translate-0' order={styles.order} width={styles.width} height={styles.height} x={x} y={y}>
				<Link href='/albums' className='group flex h-full flex-col'>
					<div className='grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5'>
						{Array.from({ length: 4 }).map((_, index) => {
							const photo = photos[index]
							return (
								<div
									key={photo?.id ?? `empty-${index}`}
									className={cn('overflow-hidden rounded-2xl bg-white/35 transition-transform duration-300 ease-out', HOVER_SHIFT[index])}>
									{photo ? (
										<img
											src={thumbUrl(photo.url)}
											alt=''
											loading='lazy'
											decoding='async'
											onError={event => {
												if (event.currentTarget.src !== photo.url) event.currentTarget.src = photo.url
											}}
											className='h-full w-full object-cover'
										/>
									) : null}
								</div>
							)
						})}
					</div>
					<div className='text-secondary mt-2 shrink-0 text-xs'>{count > 0 ? `相册 · ${count} 张` : '还没有照片'}</div>
				</Link>
			</Card>
		</HomeDraggableLayer>
	)
}
