'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useCenterInit, useCenterStore } from '@/hooks/use-center'
import { Picture } from '../page'
import siteContent from '@/config/site-content.json'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'
import { thumbUrl } from './picture-thumb'

interface RandomLayoutProps {
	pictures: Picture[]
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: (picture: Picture) => void
}

type PositionedItem = {
	x: number
	y: number
	rotation: number
}

type OriginalSize = {
	width: number
	height: number
}

interface FloatingImageProps {
	url: string
	index: number
	groupIndex: number
	position: PositionedItem
	description?: string
	uploadedAt?: string
	pictureId: string
	imageIndex: number | 'single'
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: () => void
	sequencer: GallerySequencer
}

type UrlItem = {
	url: string
	groupIndex: number
	description?: string
	uploadedAt?: string
	pictureId: string
	imageIndex: number | 'single'
}

const buildUrlList = (pictures: Picture[]): UrlItem[] => {
	const result: UrlItem[] = []

	for (const [index, picture] of pictures.entries()) {
		if (picture.image) {
			result.push({
				url: picture.image,
				groupIndex: index,
				description: picture.description,
				uploadedAt: picture.uploadedAt,
				pictureId: picture.id,
				imageIndex: 'single'
			})
		}

		if (picture.images && picture.images.length > 0) {
			result.push(
				...picture.images.map((url, imageIndex) => ({
					url,
					groupIndex: index,
					description: picture.description,
					uploadedAt: picture.uploadedAt,
					pictureId: picture.id,
					imageIndex: imageIndex
				}))
			)
		}
	}

	return result
}

let lastZIndex = 10
const TOP_Z_INDEX = 9999

const formatUploadedAt = (uploadedAt?: string) => {
	if (!uploadedAt) return ''
	const date = new Date(uploadedAt)
	if (Number.isNaN(date.getTime())) return uploadedAt

	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')

	return `${year}-${month}-${day} ${hours}:${minutes}`
}

const loadSavedOffset = (url: string): { x: number; y: number } => {
	try {
		const saved = localStorage.getItem(`picture-offset-${url}`)
		if (saved) {
			const parsed = JSON.parse(saved)
			return { x: parsed.x || 0, y: parsed.y || 0 }
		}
	} catch (error) {
		console.error('Failed to load saved offset:', error)
	}
	return { x: 0, y: 0 }
}

const saveOffset = (url: string, offset: { x: number; y: number }) => {
	try {
		localStorage.setItem(`picture-offset-${url}`, JSON.stringify(offset))
	} catch (error) {
		console.error('Failed to save offset:', error)
	}
}

interface SequencerItem {
	id: number
	startLoad: () => void
	reveal: () => void
	loading: boolean
	loaded: boolean
	revealed: boolean
	dead: boolean
}

// 画廊调度器:两段式流水线
// 1. 预加载:最多 maxConcurrent 张同时下载,按注册顺序依次放行,提前把后面的图片加载好
// 2. 展示:严格按注册顺序逐张放行,每张间隔至少 minGapMs,且必须等图片加载完成才展示
//    上一张展示后,下一张才会开始 —— 避免多张同时弹出、避免出现还没加载好的空框
class GallerySequencer {
	private items: SequencerItem[] = []
	private activeLoads = 0
	private cursor = 0
	private lastRevealAt = 0
	private revealTimer: ReturnType<typeof setTimeout> | null = null
	readonly maxConcurrent = 6
	readonly minGapMs = 200

	register(startLoad: () => void, reveal: () => void): number {
		const id = this.items.length
		this.items.push({ id, startLoad, reveal, loading: false, loaded: false, revealed: false, dead: false })
		this.pump()
		return id
	}

	unregister(id: number) {
		const item = this.items[id]
		if (!item) return
		// 组件卸载:若还在下载,释放预加载名额
		if (item.loading && !item.loaded) {
			this.activeLoads--
		}
		item.dead = true
		this.pump()
	}

	markLoaded(id: number) {
		const item = this.items[id]
		if (!item || item.dead || item.loaded) return
		item.loaded = true
		if (item.loading) {
			item.loading = false
			this.activeLoads--
		}
		this.pump()
	}

	private pump() {
		this.pumpLoads()
		if (this.revealTimer) return
		this.pumpReveals()
	}

	private pumpLoads() {
		for (const item of this.items) {
			if (this.activeLoads >= this.maxConcurrent) return
			if (item.dead || item.loaded || item.loading) continue
			item.loading = true
			this.activeLoads++
			item.startLoad()
		}
	}

	private pumpReveals() {
		while (this.cursor < this.items.length) {
			const item = this.items[this.cursor]

			// 已删除的图片直接跳过
			if (item.dead) {
				this.cursor++
				continue
			}

			// 还没加载完:等 markLoaded 触发后再试
			if (!item.loaded) return

			// 保持每张之间的展示节奏
			const wait = this.lastRevealAt + this.minGapMs - performance.now()
			if (wait > 0) {
				this.revealTimer = setTimeout(() => {
					this.revealTimer = null
					this.pumpReveals()
				}, wait)
				return
			}

			item.revealed = true
			item.reveal()
			this.lastRevealAt = performance.now()
			this.cursor++
		}
	}
}

const FloatingImage = ({
	url,
	index,
	groupIndex,
	position,
	description,
	uploadedAt,
	pictureId,
	imageIndex,
	isEditMode,
	onDeleteSingle,
	onDeleteGroup,
	sequencer
}: FloatingImageProps) => {
	const { centerX, centerY } = useCenterStore()
	const { maxSM, init } = useSize()
	const bodyRef = useRef(document.body)
	const mouseDownTimeRef = useRef<number | null>(null)
	const [zIndex, setZIndex] = useState(index)
	const [srcReady, setSrcReady] = useState(false)
	const [visible, setVisible] = useState(false)
	const sequencerIdRef = useRef<number | null>(null)
	const [dragOffset, setDragOffset] = useState(() => loadSavedOffset(url))
	// 墙展示用缩略图,放大切原图;缩略图缺失时回退原图(thumbFailedRef)
	const [imgSrc, setImgSrc] = useState(() => thumbUrl(url))
	const thumbFailedRef = useRef(false)

	// 注册到画廊调度器:后台预加载 + 按顺序逐张展示
	useEffect(() => {
		const id = sequencer.register(
			() => setSrcReady(true),
			() => setVisible(true)
		)
		sequencerIdRef.current = id
		return () => {
			sequencer.unregister(id)
			sequencerIdRef.current = null
		}
	}, [sequencer])

	const [originalSize, setOriginalSize] = useState<OriginalSize | null>(null)

	const displaySize = useMemo(() => {
		if (!originalSize) {
			return { width: 200, height: 200 }
		}

		const ratio = originalSize.width / originalSize.height
		const minRatio = 2 / 3
		const maxRatio = 3 / 2
		const clampedRatio = Math.min(Math.max(ratio, minRatio), maxRatio)

		const baseWidth = 200

		return {
			width: baseWidth,
			height: baseWidth / clampedRatio
		}
	}, [originalSize])

	const zoomedSize = useMemo(() => {
		if (!originalSize) {
			return { width: 200, height: 200 }
		}

		if (typeof window === 'undefined') {
			return originalSize
		}

		const padding = 24
		const maxWidth = document.documentElement.clientWidth - padding * 2
		const maxHeight = document.documentElement.clientHeight - padding * 2

		const scale = Math.min(maxWidth / originalSize.width, maxHeight / originalSize.height, 1)

		return {
			width: originalSize.width * scale,
			height: originalSize.height * scale
		}
	}, [originalSize])

	const [isZoomed, setIsZoomed] = useState(false)
	const dragStartOffsetRef = useRef({ x: 0, y: 0 })

	// 放大时切到原图保证清晰;回到墙时切回复略图节省内存(缩略图缺失则保持原图)
	useEffect(() => {
		if (!srcReady) return
		if (isZoomed) {
			setImgSrc(url)
		} else if (!thumbFailedRef.current) {
			setImgSrc(thumbUrl(url))
		}
	}, [isZoomed, srcReady, url])

	if (!position) return null

	return (
		<>
			{isZoomed && (
				<motion.div
					onClick={() => {
						setIsZoomed(false)
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.3 }}
					style={{ zIndex: TOP_Z_INDEX }}
					className='bg-card fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl'
				/>
			)}
			<motion.div
				drag={!isZoomed && visible}
				dragConstraints={bodyRef}
				dragMomentum={false}
				onDragStart={() => {
					if (!isZoomed) {
						dragStartOffsetRef.current = { ...dragOffset }
					}
				}}
				onMouseDown={event => {
					lastZIndex = lastZIndex + 1
					setZIndex(lastZIndex)
					mouseDownTimeRef.current = event.timeStamp
				}}
				onMouseUp={event => {
					if (mouseDownTimeRef.current !== null) {
						const duration = event.timeStamp - mouseDownTimeRef.current
						if (duration <= 150) {
							if (!isZoomed && visible) {
								setIsZoomed(true)
							} else if (maxSM) {
								setIsZoomed(false)
							}
						}
					}
					mouseDownTimeRef.current = null
				}}
				onDragEnd={(_, info) => {
					if (!isZoomed) {
						const newOffset = {
							x: dragStartOffsetRef.current.x + info.offset.x,
							y: dragStartOffsetRef.current.y + info.offset.y
						}
						setDragOffset(newOffset)
						saveOffset(url, newOffset)
					}
				}}
				initial={{
					opacity: 0,
					scale: 0.6,
					rotate: position.rotation,
					x: dragOffset.x,
					y: dragOffset.y,
					zIndex
				}}
				animate={
					isZoomed
						? {
								zIndex: TOP_Z_INDEX,
								rotate: 0,
								scale: 1,
								opacity: 1,
								x: 0,
								y: 0
							}
						: {
								zIndex,
								rotate: position.rotation,
								scale: visible ? 1 : 0.6,
								opacity: visible ? 1 : 0,
								x: dragOffset.x,
								y: dragOffset.y
							}
				}
				style={{
					left: isZoomed ? centerX : centerX + position.x,
					top: isZoomed ? centerY : centerY + position.y,
					width: isZoomed ? zoomedSize.width : displaySize.width,
					height: isZoomed ? zoomedSize.height : displaySize.height,
					borderWidth: isZoomed ? (maxSM ? 12 : 24) : 8
				}}
				transition={{ type: 'tween', ease: 'easeOut' }}
				className={cn(
					'pointer-events-auto absolute origin-center -translate-1/2 cursor-pointer shadow-xl transition-[scale]',
					!isEditMode && !isZoomed && 'hover:scale-105'
				)}>
				{srcReady && (
					<img
						src={imgSrc}
						decoding='async'
						onLoad={event => {
							const img = event.currentTarget
							setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight })
							if (sequencerIdRef.current !== null) {
								sequencer.markLoaded(sequencerIdRef.current)
							}
						}}
						onError={() => {
							// 缩略图缺失回退原图;原图也失败才推进链条,避免后面的图片被卡住
							if (imgSrc !== url && !thumbFailedRef.current) {
								thumbFailedRef.current = true
								setImgSrc(url)
							} else if (sequencerIdRef.current !== null) {
								sequencer.markLoaded(sequencerIdRef.current)
							}
						}}
						draggable={false}
						className='h-full w-full object-cover select-none'
					/>
				)}
				{isEditMode && !isZoomed && (
					<motion.button
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						onClick={e => {
							e.stopPropagation()
							onDeleteSingle?.(pictureId, imageIndex)
						}}
						onMouseUp={e => {
							e.stopPropagation()
						}}
						className='absolute -top-2 -right-2 rounded-full bg-red-500 p-1.5 opacity-0 shadow-lg transition-all group-hover:opacity-100 hover:scale-105 hover:bg-red-600'
						style={{ zIndex: 1 }}>
						<svg xmlns='http://www.w3.org/2000/svg' className='h-3 w-3 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
						</svg>
					</motion.button>
				)}
			</motion.div>

			{isZoomed && description && (
				<motion.div
					drag
					dragConstraints={maxSM ? undefined : bodyRef}
					dragMomentum={false}
					className='fixed min-h-[150px] w-[200px] cursor-pointer p-6 shadow'
					style={{
						backgroundColor: siteContent.backgroundColors[groupIndex % siteContent.backgroundColors.length],
						zIndex: TOP_Z_INDEX + 1,
						right: maxSM ? 12 : centerX / 3,
						top: maxSM ? 12 : centerY
					}}
					initial={{ opacity: 0, scale: 0.4 }}
					animate={{ opacity: 1, scale: 1 }}>
					<div className='text-secondary mb-2 text-xs'>{formatUploadedAt(uploadedAt)}</div>
					<div className='text-sm'>{description}</div>
				</motion.div>
			)}
		</>
	)
}

// 基于唯一标识生成稳定的位置
// 使用 ref 存储稳定的位置映射
const positionCacheRef = new Map<string, PositionedItem>()
const getStablePosition = (uniqueId: string, width: number, height: number): PositionedItem => {
	// 如果已有缓存,直接返回
	if (positionCacheRef.has(uniqueId)) {
		return positionCacheRef.get(uniqueId)!
	}

	// 使用 uniqueId 的哈希值来生成稳定的索引
	let hash = 0
	for (let i = 0; i < uniqueId.length; i++) {
		const char = uniqueId.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32bit integer
	}
	const stableIndex = Math.abs(hash) % 10000

	const maxRadius = Math.min(width, height) / 2 - 100
	const goldenAngle = Math.PI * (3 - Math.sqrt(5))

	// 使用稳定索引来计算位置,而不是数组索引
	const t = (stableIndex % 1000) / 1000
	const radius = Math.pow(t, 0.8) * maxRadius
	const angle = stableIndex * goldenAngle

	const baseX = radius * Math.cos(angle)
	const baseY = radius * Math.sin(angle)

	// 使用 uniqueId 生成稳定的 jitter,确保每次都是相同的位置
	const jitterSeed = Math.abs(hash) % 1000
	const jitterRadius = 12
	const jitterX = (jitterSeed % (jitterRadius * 2)) - jitterRadius
	const jitterY = ((jitterSeed * 7) % (jitterRadius * 2)) - jitterRadius

	const rotation = ((jitterSeed * 13) % 60) - 30

	const position = {
		x: baseX + jitterX,
		y: baseY + jitterY,
		rotation
	}

	positionCacheRef.set(uniqueId, position)
	return position
}

export const RandomLayout = ({ pictures, isEditMode = false, onDeleteSingle, onDeleteGroup }: RandomLayoutProps) => {
	useCenterInit()
	const { width, height } = useCenterStore()
	const [show, setShow] = useState(false)
	// 每个实例独立调度器,避免模块单例在多次进出页面时 items 数组无限增长
	const sequencerRef = useRef<GallerySequencer | null>(null)
	if (!sequencerRef.current) sequencerRef.current = new GallerySequencer()

	useEffect(() => {
		setTimeout(() => {
			setShow(true)
		}, 1000)
	}, [])

	const urls = useMemo(() => buildUrlList(pictures), [pictures])

	const pictureMap = useMemo(() => {
		const map = new Map<string, Picture>()
		pictures.forEach(picture => {
			map.set(picture.id, picture)
		})
		return map
	}, [pictures])

	if (!urls.length || !width || !height) {
		return null
	}

	if (!show) return null

	lastZIndex = urls.length + 11

	return (
		<>
			{urls.map((item, index) => {
				const picture = pictureMap.get(item.pictureId)
				const uniqueId = item.url
				const position = getStablePosition(uniqueId, width, height)

				return (
					<FloatingImage
						key={uniqueId}
						url={item.url}
						index={index}
						groupIndex={item.groupIndex}
						position={position}
						description={item.description}
						uploadedAt={item.uploadedAt}
						pictureId={item.pictureId}
						imageIndex={item.imageIndex}
						isEditMode={isEditMode}
						sequencer={sequencerRef.current!}
						onDeleteSingle={onDeleteSingle}
						onDeleteGroup={picture ? () => onDeleteGroup?.(picture) : undefined}
					/>
				)
			})}
		</>
	)
}
