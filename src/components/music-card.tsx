'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useMusicPlayer } from '@/hooks/use-music-player'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { CARD_SPACING } from '@/consts'
import MusicSVG from '@/svgs/music.svg'
import PlaySVG from '@/svgs/play.svg'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { ListMusic, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

// 选歌弹层宽度（w-72）
const DROPDOWN_WIDTH = 288

export default function MusicCard() {
	const pathname = usePathname()
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const styles = cardStyles.musicCard
	const hiCardStyles = cardStyles.hiCard
	const clockCardStyles = cardStyles.clockCard
	const calendarCardStyles = cardStyles.calendarCard

	const [playlistOpen, setPlaylistOpen] = useState(false)

	const player = useMusicPlayer(true)
	const { tracks, currentIndex, isPlaying, progress, currentTrack } = player

	const isHomePage = pathname === '/'

	const position = useMemo(() => {
		// If not on home page, always position at bottom-right corner when playing
		if (!isHomePage) {
			return {
				x: center.width - styles.width - 16,
				y: center.height - styles.height - 16
			}
		}

		// Default position on home page
		return {
			x: styles.offsetX !== null ? center.x + styles.offsetX : center.x + CARD_SPACING + hiCardStyles.width / 2 - styles.offset,
			y: styles.offsetY !== null ? center.y + styles.offsetY : center.y - clockCardStyles.offset + CARD_SPACING + calendarCardStyles.height + CARD_SPACING
		}
	}, [isPlaying, isHomePage, center, styles, hiCardStyles, clockCardStyles, calendarCardStyles])

	const { x, y } = position

	// 路由切换时收起播放列表弹层
	useEffect(() => {
		setPlaylistOpen(false)
	}, [pathname])

	// 选歌弹层位置：优先贴播放器正右侧；右侧放不下时落到下方，再放不下落到上方，避免溢出视口
	const listHeight = Math.min(256, tracks.length * 40 + 16)
	const rightSpace = center.width - (x + styles.width) - 24
	const dropdownPosition =
		rightSpace >= DROPDOWN_WIDTH
			? 'top-1/2 left-full ml-2 -translate-y-1/2'
			: center.height - (y + styles.height) - 24 >= listHeight
				? 'top-full left-1/2 mt-2 -translate-x-1/2'
				: 'bottom-full left-1/2 mb-2 -translate-x-1/2'

	// Hide component if not on home page and not playing
	if (!isHomePage && !isPlaying) {
		return null
	}

	return (
		<HomeDraggableLayer cardKey='musicCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card
				order={styles.order}
				width={styles.width}
				height={styles.height}
				x={x}
				y={y}
				noTapScale
				className={clsx('flex items-center gap-2', !isHomePage && 'fixed')}>
				{siteContent.enableChristmas && (
					<>
						<img
							src='/images/christmas/snow-10.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 120, left: -8, top: -12, opacity: 0.8 }}
						/>
						<img
							src='/images/christmas/snow-11.webp'
							alt='Christmas decoration'
							className='pointer-events-none absolute'
							style={{ width: 80, right: -10, top: -12, opacity: 0.8 }}
						/>
					</>
				)}

				<MusicSVG className='h-8 w-8 shrink-0' />

				<div className='min-w-0 flex-1'>
					<div className='text-secondary truncate text-sm'>{currentTrack?.name}</div>

					<div className='mt-1 h-2 rounded-full bg-white/60'>
						<div className='bg-linear h-full rounded-full transition-all duration-300' style={{ width: `${progress}%` }} />
					</div>
				</div>

				<button
					onClick={player.playPrev}
					aria-label='上一首'
					title='上一首'
					className='text-secondary hover:text-brand flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/60'>
					<SkipBack className='size-4' />
				</button>

				<button
					onClick={player.togglePlayPause}
					aria-label={isPlaying ? '暂停' : '播放'}
					title={isPlaying ? '暂停' : '播放'}
					className='flex size-10 shrink-0 items-center justify-center rounded-full bg-white transition-opacity hover:opacity-80'>
					{isPlaying ? <Pause className='text-brand size-4' /> : <PlaySVG className='text-brand ml-1 size-4' />}
				</button>

				<button
					onClick={player.playNext}
					aria-label='下一首'
					title='下一首'
					className='text-secondary hover:text-brand flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/60'>
					<SkipForward className='size-4' />
				</button>

				<button
					onClick={() => setPlaylistOpen(open => !open)}
					aria-label='选择歌曲'
					title='选择歌曲'
					aria-expanded={playlistOpen}
					className={clsx(
						'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/60',
						playlistOpen ? 'text-brand' : 'text-secondary'
					)}>
					<ListMusic className='size-4' />
				</button>

				{playlistOpen && (
					<>
						<div className='fixed inset-0 z-40' onClick={() => setPlaylistOpen(false)} />
						<div
							className={clsx(
								'bg-card scrollbar-none absolute z-50 max-h-64 w-72 overflow-y-auto rounded-2xl border p-2 shadow-lg backdrop-blur-md',
								dropdownPosition
							)}>
							{tracks.map((track, index) => {
								const isCurrent = index === currentIndex
								return (
									<button
										key={track.src}
										onClick={() => {
											setPlaylistOpen(false)
											player.playTrack(index)
										}}
										className={clsx(
											'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors',
											isCurrent ? 'bg-brand/15 text-brand' : 'text-secondary hover:text-primary hover:bg-white/60'
										)}>
										<span className='flex size-4 shrink-0 items-center justify-center'>
											{isCurrent && isPlaying ? <Volume2 className='size-3.5' /> : <span className='size-1.5 rounded-full bg-current' />}
										</span>
										<span className='min-w-0 flex-1 truncate'>{track.name}</span>
										{isCurrent && <span className='shrink-0 text-xs opacity-70'>{isPlaying ? '播放中' : '已暂停'}</span>}
									</button>
								)
							})}
						</div>
					</>
				)}
			</Card>
		</HomeDraggableLayer>
	)
}
