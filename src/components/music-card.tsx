'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { CARD_SPACING } from '@/consts'
import MusicSVG from '@/svgs/music.svg'
import PlaySVG from '@/svgs/play.svg'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { ListMusic, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

interface Track {
	name: string
	src: string
}

// 兜底播放列表：与 public/music/list.json 保持一致，清单拉取失败时使用
const FALLBACK_TRACKS: Track[] = [
	{ name: 'Close To You', src: '/music/close-to-you.mp3' },
	{ name: 'Christmas', src: '/music/christmas.m4a' }
]

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

	const [tracks, setTracks] = useState<Track[]>(FALLBACK_TRACKS)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [progress, setProgress] = useState(0)
	const [playlistOpen, setPlaylistOpen] = useState(false)
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const currentIndexRef = useRef(0)
	const tracksRef = useRef<Track[]>(FALLBACK_TRACKS)
	const loadedSrcRef = useRef<string | null>(null)

	const isHomePage = pathname === '/'
	const currentTrack = tracks[currentIndex]

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

	// 拉取 public/music/ 播放列表
	useEffect(() => {
		let cancelled = false
		fetch('/music/list.json')
			.then(res => (res.ok ? res.json() : null))
			.then((data: Track[] | null) => {
				if (cancelled) return
				if (!Array.isArray(data) || data.length === 0) return
				setTracks(data)
				setCurrentIndex(prev => (prev < data.length ? prev : 0))
			})
			.catch(() => {
				// 清单拉取失败时继续使用兜底列表
			})
		return () => {
			cancelled = true
		}
	}, [])

	// 路由切换时收起播放列表弹层
	useEffect(() => {
		setPlaylistOpen(false)
	}, [pathname])

	// 同步 ref，供 audio 事件回调读取最新值
	useEffect(() => {
		currentIndexRef.current = currentIndex
	}, [currentIndex])

	useEffect(() => {
		tracksRef.current = tracks
	}, [tracks])

	// Initialize audio element
	useEffect(() => {
		if (!audioRef.current) {
			audioRef.current = new Audio()
		}

		const audio = audioRef.current

		const updateProgress = () => {
			if (audio.duration) {
				setProgress((audio.currentTime / audio.duration) * 100)
			}
		}

		const handleEnded = () => {
			const list = tracksRef.current
			if (list.length === 0) return

			// 单曲列表：从头循环重播
			if (list.length === 1) {
				audio.currentTime = 0
				audio.play().catch(console.error)
				return
			}

			// 播完自动切下一首循环播放
			const nextIndex = (currentIndexRef.current + 1) % list.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
		}

		const handleTimeUpdate = () => {
			updateProgress()
		}

		const handleLoadedMetadata = () => {
			updateProgress()
		}

		audio.addEventListener('timeupdate', handleTimeUpdate)
		audio.addEventListener('ended', handleEnded)
		audio.addEventListener('loadedmetadata', handleLoadedMetadata)

		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate)
			audio.removeEventListener('ended', handleEnded)
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
		}
	}, [])

	// Handle currentIndex change - load new audio
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		const track = tracks[currentIndex]
		if (!track) return
		// src 未变（如清单刷新后数组替换）时跳过，避免播放中从头重来
		if (loadedSrcRef.current === track.src) return
		loadedSrcRef.current = track.src
		audio.src = track.src
		audio.loop = false
		setProgress(0)
	}, [currentIndex, tracks])

	// Handle play/pause state change（依赖 currentIndex：切歌后仍按 isPlaying 播放/暂停）
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return

		if (isPlaying) {
			audio.play().catch(console.error)
		} else {
			audio.pause()
		}
	}, [isPlaying, currentIndex, tracks])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.src = ''
			}
		}
	}, [])

	const togglePlayPause = () => {
		setIsPlaying(prev => !prev)
	}

	const playTrack = (index: number) => {
		setPlaylistOpen(false)
		setCurrentIndex(index)
		setIsPlaying(true)
	}

	const playPrev = () => {
		const length = tracks.length
		if (length === 0) return
		setCurrentIndex(prev => (prev - 1 + length) % length)
	}

	const playNext = () => {
		const length = tracks.length
		if (length === 0) return
		setCurrentIndex(prev => (prev + 1) % length)
	}

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
					onClick={playPrev}
					aria-label='上一首'
					title='上一首'
					className='text-secondary hover:text-brand flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/60'>
					<SkipBack className='size-4' />
				</button>

				<button
					onClick={togglePlayPause}
					aria-label={isPlaying ? '暂停' : '播放'}
					title={isPlaying ? '暂停' : '播放'}
					className='flex size-10 shrink-0 items-center justify-center rounded-full bg-white transition-opacity hover:opacity-80'>
					{isPlaying ? <Pause className='text-brand size-4' /> : <PlaySVG className='text-brand ml-1 size-4' />}
				</button>

				<button
					onClick={playNext}
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
										onClick={() => playTrack(index)}
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
