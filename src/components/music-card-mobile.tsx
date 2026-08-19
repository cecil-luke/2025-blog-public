'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useMusicPlayer } from '@/hooks/use-music-player'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { usePathname } from 'next/navigation'
import MusicSVG from '@/svgs/music.svg'
import PlaySVG from '@/svgs/play.svg'
import { Pause, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import clsx from 'clsx'

// 移动端右下角按钮竖排（从上到下）：搜索 → 音乐 → 目录 → 向上箭头
// 每个按钮 size-12(3rem)，间距 0.5rem；整体上移避开音乐迷你条（迷你条贴底约 4rem 高）
// 向上箭头(最下): 4.5rem（高于迷你条顶部，不重叠）
// 目录:           8rem   (4.5+3.5)
// 音乐(本组件):   11.5rem (8+3.5)
// 搜索:           15rem   (11.5+3.5)
const FAB_BOTTOM = 'calc(11.5rem + env(safe-area-inset-bottom))'

// 抽屉/遮罩用极高层 z-index，确保盖过图床照片墙的 inline zIndex（散落墙最大可达 urls.length+11，实测 128）
// 散落墙照片 absolute 的 zIndex 在 <main z-10> stacking context 内，与音乐卡同 context 比较。
// 取 200 稳定高于任何照片常规层；照片墙全屏查看器 TOP_Z_INDEX=9999 是 zoom 互斥场景，不会同时出现。
const DRAWER_Z = 'z-[200]'

export default function MusicCardMobile() {
	const pathname = usePathname()
	const { cardStyles } = useConfigStore()
	const enabled = cardStyles.musicCard?.enabled !== false

	const [drawerOpen, setDrawerOpen] = useState(false)
	// peek = true 表示"抽屉已收起，但正在播放，保留迷你条"
	const [peek, setPeek] = useState(false)
	const progressRef = useRef<HTMLDivElement | null>(null)

	const player = useMusicPlayer(enabled)
	const { tracks, currentIndex, isPlaying, progress, currentTrack } = player

	// 记录抽屉收起时是否在播放（用于决定 peek）
	const wasPlayingRef = useRef(false)
	useEffect(() => {
		if (drawerOpen) wasPlayingRef.current = isPlaying
	}, [isPlaying, drawerOpen])

	// 路由切换时收起抽屉与迷你条
	useEffect(() => {
		setDrawerOpen(false)
		setPeek(false)
	}, [pathname])

	// ESC 收起抽屉
	useEffect(() => {
		if (!drawerOpen) return
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeDrawer()
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [drawerOpen, isPlaying])

	// 抽屉打开时锁定 body 滚动
	useEffect(() => {
		if (!drawerOpen) return
		const prev = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = prev
		}
	}, [drawerOpen])

	// 暂停时自动收起迷你条（避免悬挂的空迷你条）
	useEffect(() => {
		if (!isPlaying && peek) setPeek(false)
	}, [isPlaying, peek])

	if (!enabled) return null

	const toggleDrawer = () => {
		if (drawerOpen) {
			closeDrawer()
		} else {
			setPeek(false)
			setDrawerOpen(true)
		}
	}

	const closeDrawer = () => {
		setDrawerOpen(false)
		// 收起时若正在播放，保留迷你条
		if (player.isPlaying) setPeek(true)
	}

	const handlePlayTrack = (index: number) => {
		player.playTrack(index)
	}

	const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
		const bar = progressRef.current
		if (!bar) return
		const rect = bar.getBoundingClientRect()
		const pct = ((e.clientX - rect.left) / rect.width) * 100
		player.seek(Math.max(0, Math.min(100, pct)))
	}

	// FAB 显示条件：抽屉未打开 且 (非 peek 模式 或 peek 模式但迷你条不显示——即暂停后)
	// 简化：抽屉未打开时永远显示 FAB（peek 迷你条与 FAB 互斥，由下面条件控制）
	const showFab = !drawerOpen
	// 迷你条显示条件：抽屉未打开 且 peek 且 正在播放
	const showPeek = !drawerOpen && peek && isPlaying

	return (
		<>
			{/* 悬浮入口按钮（左下角，搜索之下、目录之上） */}
			<AnimatePresence>
				{showFab && !showPeek && (
					<motion.button
						key='fab'
						type='button'
						onClick={toggleDrawer}
						aria-label={isPlaying ? `${currentTrack?.name ?? ''} - 打开音乐` : '打开音乐'}
						initial={{ opacity: 0, scale: 0.4 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.4 }}
						whileTap={{ scale: 0.92 }}
						className='bg-brand/20 hover:bg-brand/30 fixed right-6 z-50 flex size-12 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-colors'
						style={{ bottom: FAB_BOTTOM }}>
						{isPlaying ? (
							<span className='flex items-center gap-1'>
								<span className='bg-brand h-3 w-1 animate-[pulse_1s_ease-in-out_infinite] rounded-full' style={{ animationDelay: '0ms' }} />
								<span className='bg-brand h-2.5 w-1 animate-[pulse_1s_ease-in-out_infinite] rounded-full' style={{ animationDelay: '150ms' }} />
								<span className='bg-brand h-3.5 w-1 animate-[pulse_1s_ease-in-out_infinite] rounded-full' style={{ animationDelay: '300ms' }} />
							</span>
						) : (
							<MusicSVG className='text-primary h-6 w-6' />
						)}
						{isPlaying && <span className='bg-brand absolute top-0 right-0 size-2.5 rounded-full ring-2 ring-white' />}
					</motion.button>
				)}
			</AnimatePresence>

			{/* 播放中收起后的迷你条（贴底部安全区，左下角上方） */}
			<AnimatePresence>
				{showPeek && (
					<motion.div
						key='peek'
						initial={{ y: 80, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 80, opacity: 0 }}
						className={clsx('bg-card fixed left-3 right-3 z-50 flex items-center gap-2 rounded-2xl border p-2 shadow-lg backdrop-blur-md')}
						style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
						<button type='button' onClick={() => setDrawerOpen(true)} aria-label='展开音乐抽屉' className='flex min-w-0 flex-1 items-center gap-2 text-left'>
							<MusicSVG className='text-brand h-5 w-5 shrink-0' />
							<span className='text-secondary truncate text-xs'>{currentTrack?.name}</span>
						</button>
						<button
							type='button'
							onClick={player.togglePlayPause}
							aria-label='暂停'
							className='bg-brand/15 flex size-8 shrink-0 items-center justify-center rounded-full'>
							<Pause className='text-brand size-4' />
						</button>
						<button
							type='button'
							onClick={player.playNext}
							aria-label='下一首'
							className='text-secondary hover:text-brand flex size-7 shrink-0 items-center justify-center'>
							<SkipForward className='size-4' />
						</button>
						<button
							type='button'
							onClick={() => setPeek(false)}
							aria-label='关闭迷你条'
							className='text-secondary hover:text-primary flex size-7 shrink-0 items-center justify-center'>
							<X className='size-4' />
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* 底部抽屉：迷你播放条 + 曲目列表 */}
			<AnimatePresence>
				{drawerOpen && (
					<>
						{/* 遮罩：极高层，盖过图床照片墙 */}
						<motion.div
							key='overlay'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={closeDrawer}
							className={clsx('fixed inset-0 bg-black/30 backdrop-blur-[2px]', DRAWER_Z)}
						/>
						{/* 抽屉：极高层 */}
						<motion.div
							key='drawer'
							initial={{ y: '100%' }}
							animate={{ y: 0 }}
							exit={{ y: '100%' }}
							transition={{ type: 'spring', damping: 30, stiffness: 320 }}
							className={clsx('bg-card fixed inset-x-0 bottom-0 flex max-h-[72dvh] flex-col rounded-t-3xl border-t shadow-2xl backdrop-blur-md', DRAWER_Z)}
							style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
							{/* 拖拽指示条 */}
							<div className='mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/15' />

							{/* 顶部标题 + 关闭 */}
							<div className='flex shrink-0 items-center justify-between px-4 pt-2 pb-1'>
								<div className='text-primary flex items-center gap-2 text-sm font-medium'>
									<MusicSVG className='text-brand h-5 w-5' />
									播放列表
								</div>
								<button
									type='button'
									onClick={closeDrawer}
									aria-label='收起'
									className='text-secondary hover:text-primary flex size-8 items-center justify-center rounded-full hover:bg-white/60'>
									<X className='size-5' />
								</button>
							</div>

							{/* 迷你播放条：曲名 + 进度 + 控制按钮 */}
							<div className='flex shrink-0 items-center gap-2 px-4 py-2'>
								<button
									type='button'
									onClick={player.playPrev}
									aria-label='上一首'
									className='text-secondary hover:text-brand flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/60'>
									<SkipBack className='size-5' />
								</button>
								<button
									type='button'
									onClick={player.togglePlayPause}
									aria-label={isPlaying ? '暂停' : '播放'}
									className='flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-md transition-opacity hover:opacity-80'>
									{isPlaying ? <Pause className='text-brand size-5' /> : <PlaySVG className='text-brand ml-0.5 size-5' />}
								</button>
								<button
									type='button'
									onClick={player.playNext}
									aria-label='下一首'
									className='text-secondary hover:text-brand flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/60'>
									<SkipForward className='size-5' />
								</button>

								<div className='min-w-0 flex-1'>
									<div className='text-primary truncate text-sm font-medium'>{currentTrack?.name}</div>
									<div
										ref={progressRef}
										onClick={handleSeek}
										className='mt-1.5 h-1.5 cursor-pointer rounded-full bg-white/60'
										role='slider'
										aria-label='播放进度'
										aria-valuemin={0}
										aria-valuemax={100}
										aria-valuenow={Math.round(progress)}>
										<div className='bg-linear h-full rounded-full transition-all duration-300' style={{ width: `${progress}%` }} />
									</div>
								</div>
							</div>

							<div className='border-border mx-4 shrink-0 border-t' />

							{/* 曲目列表（可滚动） */}
							<div className='scrollbar-none flex-1 overflow-y-auto px-2 py-2'>
								{tracks.map((track, index) => {
									const isCurrent = index === currentIndex
									return (
										<button
											key={track.src}
											onClick={() => handlePlayTrack(index)}
											className={clsx(
												'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
												isCurrent ? 'bg-brand/15 text-brand' : 'text-secondary hover:text-primary hover:bg-white/60'
											)}>
											<span className='flex size-5 shrink-0 items-center justify-center'>
												{isCurrent && isPlaying ? (
													<Volume2 className='size-4' />
												) : (
													<span className={clsx('size-1.5 rounded-full bg-current', isCurrent && 'opacity-100')} />
												)}
											</span>
											<span className='min-w-0 flex-1 truncate'>{track.name}</span>
											{isCurrent && <span className='text-secondary shrink-0 text-xs opacity-70'>{isPlaying ? '播放中' : '已暂停'}</span>}
										</button>
									)
								})}
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	)
}