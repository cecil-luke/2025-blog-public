'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Picture } from '../page'

// 串线照片墙 · 图床桌面端实现(≥640px 视口;移动端仍用散落墙 random-layout)
// 参数固定为推荐默认值(300ms/130px/52px);SVG 与墙容器不拦截指针事件,
// 避免盖住页面头部导航/头像与右上角编辑按钮

type WallItem = {
	url: string
	description?: string
	uploadedAt?: string
	pictureId: string
	imageIndex: number | 'single'
}

const TOP_PAD = 120
const MIN_MARGIN = 28
const BOTTOM_PAD = 160

// 图床端固定参数(经原型验证的推荐默认值)
const SPEED_MS = 300
const CELL_PX = 130
const GAP_PX = 52

type WallPos = { x: number; y: number; rot: number }

type Decoration = {
	x: number
	y: number
	frac: number
	terminal?: boolean
}

function buildItems(pictures: Picture[]): WallItem[] {
	const items: WallItem[] = []
	for (const p of pictures) {
		if (p.image) items.push({ url: p.image, description: p.description, uploadedAt: p.uploadedAt, pictureId: p.id, imageIndex: 'single' })
		if (p.images && p.images.length > 0) {
			for (const [imageIndex, url] of p.images.entries()) {
				items.push({ url, description: p.description, uploadedAt: p.uploadedAt, pictureId: p.id, imageIndex })
			}
		}
	}
	return items
}

function stableRot(url: string): number {
	let hash = 0
	for (let i = 0; i < url.length; i++) {
		hash = (hash << 5) - hash + url.charCodeAt(i)
		hash = hash & hash
	}
	return ((Math.abs(hash) % 7) - 3) * 1.2
}

// 蛇形布局:第 1 排从左到右,第 2 排从右到左,依次交替;整行居中,左右边距对称
function computeLayout(items: WallItem[], viewportW: number, cell: number, gapX: number) {
	const cols = Math.max(1, Math.floor((viewportW - MIN_MARGIN * 2 + gapX) / (cell + gapX)))
	const gapY = Math.round(gapX * 1.7)
	const rows = Math.ceil(items.length / cols)
	const rowW = cols * cell + (cols - 1) * gapX
	const margin = Math.max(MIN_MARGIN, (viewportW - rowW) / 2)
	const positions: WallPos[] = items.map((item, i) => {
		const row = Math.floor(i / cols)
		const c = i % cols
		const x = margin + cell / 2 + (row % 2 === 0 ? c : cols - 1 - c) * (cell + gapX)
		const y = TOP_PAD + cell / 2 + row * (cell + gapY)
		return { x, y, rot: stableRot(item.url) }
	})
	const totalH = TOP_PAD + rows * (cell + gapY) - gapY + BOTTOM_PAD
	return { positions, cols, rows, totalH }
}

// 花瓣调色板:一朵花一个颜色,相邻花朵按序轮换
const PETAL_COLORS = ['#ef5350', '#ff8a65', '#ffd54f', '#f06292', '#ba68c8', '#64b5f6']

// 线从第一张照片中心开始,依次穿过每张照片中心,最后沿末段方向再延伸一段"收尾尾巴",
// 尾巴终点开一朵收尾花,串线不再光秃秃地断在最后一张照片上。
// 花草只布置在"露在照片外面"的线段上:按照片方块沿线段方向的出射距离裁剪,
// 保证任何花草都不会被照片挡住,只在线上可见。
function computePath(positions: WallPos[], cell: number, viewportW: number) {
	const d = 'M ' + positions.map(p => p.x + ' ' + p.y).join(' L ')
	const cum: number[] = [0]
	let acc = 0
	for (let i = 1; i < positions.length; i++) {
		acc += Math.hypot(positions[i].x - positions[i - 1].x, positions[i].y - positions[i - 1].y)
		cum.push(acc)
	}

	// 收尾尾巴:沿最后一段方向延伸(长度与最后一段相同),终点开一朵花;
	// 向右/左延伸时收进视口;向下延伸时把高度差记入 extraBottom,由 Wall 补足容器高度
	let tailEnd: { x: number; y: number } | null = null
	let extraBottom = 0
	if (positions.length >= 2) {
		const last = positions[positions.length - 1]
		const prev = positions[positions.length - 2]
		const dxL = last.x - prev.x
		const dyL = last.y - prev.y
		const lenL = Math.hypot(dxL, dyL)
		if (lenL > 0) {
			const ux = dxL / lenL
			const uy = dyL / lenL
			let L = lenL
			if (ux > 0.01) L = Math.min(L, Math.max(24, viewportW - 16 - last.x))
			else if (ux < -0.01) L = Math.min(L, Math.max(24, last.x - 16))
			const h = cell / 2 + 6
			const exit = (h * lenL) / Math.max(Math.abs(dxL), Math.abs(dyL), 1e-6)
			const visible = L - exit
			if (visible > 4) {
				const endX = last.x + ux * L
				const endY = last.y + uy * L
				tailEnd = { x: endX, y: endY }
				extraBottom = Math.max(0, endY + 10 - (last.y + cell / 2 + BOTTOM_PAD))
				acc += L
			}
		}
	}

	const fracs = positions.map((_, i) => (acc > 0 ? cum[i] / acc : 0))

	// 每两张照片之间固定一朵花,长在露出来的线段正中间
	const decorations: Decoration[] = []
	if (acc > 0) {
		const h = cell / 2 + 6 // 照片半宽 + 旋转/边框余量
		for (let j = 0; j < positions.length - 1; j++) {
			const a = positions[j]
			const b = positions[j + 1]
			const dx = b.x - a.x
			const dy = b.y - a.y
			const len = Math.hypot(dx, dy)
			if (len <= 0) continue

			// 线从照片方块中心沿该方向出射的距离,两侧都留出,花不会被照片挡住
			const exit = (h * len) / Math.max(Math.abs(dx), Math.abs(dy), 1e-6)
			const visible = len - exit * 2
			if (visible <= 4) continue

			// 花长在露出来的线段正中间:位置用"段内"偏移 mid,
			// 弧长坐标 s = cum[j] + mid 只用于决定开放时机(frac)
			const mid = exit + visible / 2
			const s = cum[j] + mid
			decorations.push({
				x: a.x + (dx / len) * mid,
				y: a.y + (dy / len) * mid,
				frac: s / acc
			})
		}
		// 收尾花:开在尾巴终点(整条线的末端),线画到终点后才绽放
		if (tailEnd) decorations.push({ x: tailEnd.x, y: tailEnd.y, frac: 1, terminal: true })
	}

	return { d: tailEnd ? d + ' L ' + tailEnd.x + ' ' + tailEnd.y : d, total: acc, fracs, decorations, extraBottom }
}

// 预加载队列:最多 6 张并发、按顺序提前下载
interface Slot {
	startLoad: () => void
	loading: boolean
	loaded: boolean
	dead: boolean
}

class PreloadQueue {
	private slots: Slot[] = []
	private active = 0

	constructor(private readonly maxConcurrent = 6) {}

	register(startLoad: () => void): number {
		const id = this.slots.length
		this.slots.push({ startLoad, loading: false, loaded: false, dead: false })
		this.pump()
		return id
	}

	unregister(id: number) {
		const s = this.slots[id]
		if (!s) return
		if (s.loading && !s.loaded) this.active--
		s.dead = true
		this.pump()
	}

	markLoaded(id: number) {
		const s = this.slots[id]
		if (!s || s.dead || s.loaded) return
		s.loaded = true
		if (s.loading) {
			s.loading = false
			this.active--
		}
		this.pump()
	}

	isLoaded(id: number) {
		return !!this.slots[id]?.loaded
	}

	private pump() {
		for (const s of this.slots) {
			if (this.active >= this.maxConcurrent) return
			if (s.dead || s.loaded || s.loading) continue
			s.loading = true
			this.active++
			s.startLoad()
		}
	}
}

const formatUploadedAt = (uploadedAt?: string) => {
	if (!uploadedAt) return ''
	const date = new Date(uploadedAt)
	if (Number.isNaN(date.getTime())) return uploadedAt
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function PhotoCell({ item, pos, cell, queue, popped, skip, hover, onHoverEnter, onHoverLeave, onZoom, isEditMode = false, onDeleteSingle }: {
	item: WallItem
	pos: WallPos
	cell: number
	queue: PreloadQueue
	popped: boolean
	skip: boolean
	hover: -1 | 0 | 1
	onHoverEnter: () => void
	onHoverLeave: () => void
	onZoom: () => void
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
}) {
	const [srcReady, setSrcReady] = useState(false)
	const idRef = useRef<number | null>(null)

	useEffect(() => {
		const id = queue.register(() => setSrcReady(true))
		idRef.current = id
		return () => {
			queue.unregister(id)
			idRef.current = null
		}
	}, [queue])

	const active = popped || skip

	// Dock 式悬停:本图放大上浮,路径上相邻两张小幅放大;纯悬停、无需点击
	const scale = active ? (hover === 0 ? 1.45 : hover === 1 ? 1.18 : 1) : 0.4
	const lift = hover === 0 ? -12 : hover === 1 ? -4 : 0
	const z = hover === 0 ? 15 : hover === 1 ? 12 : 2

	return (
		<motion.div
			data-wall-cell
			initial={{ opacity: 0, scale: 0.4, rotate: 0, y: 0 }}
			animate={{ opacity: active ? 1 : 0, scale, rotate: pos.rot, y: lift }}
			transition={{ type: 'spring', stiffness: 300, damping: 22 }}
			onMouseEnter={() => {
				if (active) onHoverEnter()
			}}
			onMouseLeave={() => {
				if (active) onHoverLeave()
			}}
			onClick={() => active && onZoom()}
			style={{ left: pos.x, top: pos.y, width: cell, height: cell, zIndex: z }}
			className='pointer-events-auto absolute origin-center -translate-1/2 cursor-pointer'>
			{(srcReady || skip) && (
				<img
					src={item.url}
					decoding='async'
					onLoad={() => {
						if (idRef.current !== null) queue.markLoaded(idRef.current)
					}}
					onError={() => {
						if (idRef.current !== null) queue.markLoaded(idRef.current)
					}}
					draggable={false}
					style={{ boxShadow: hover === 0 ? '0 24px 48px rgba(0,0,0,0.32)' : undefined }}
					className='h-full w-full rounded-lg border-4 border-white object-cover shadow-lg select-none'
				/>
			)}
			{isEditMode && (
				<motion.button
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					onClick={event => {
						event.stopPropagation()
						onDeleteSingle?.(item.pictureId, item.imageIndex)
					}}
					onMouseUp={event => {
						event.stopPropagation()
					}}
					title='删除'
					className='absolute -top-2 -right-2 z-[5] rounded-full bg-red-500 p-1.5 shadow-lg transition-all hover:scale-105 hover:bg-red-600'
					style={{ zIndex: 5 }}>
					<svg xmlns='http://www.w3.org/2000/svg' className='h-3 w-3 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
					</svg>
				</motion.button>
			)}
		</motion.div>
	)
}

// 放大查看:背景 + 大图 + 可拖动书签标签 + 上一张/下一张(首尾循环)+ 键盘 ←/→/Esc
function PhotoZoom({ item, index, total, onClose, onPrev, onNext }: { item: WallItem; index: number; total: number; onClose: () => void; onPrev: () => void; onNext: () => void }) {
	const [labelPos, setLabelPos] = useState<{ right: number; top: number } | null>(null)
	const [closing, setClosing] = useState(false)
	const [exit, setExit] = useState<{ x: number; y: number; scale: number } | null>(null)
	const backdropRef = useRef<HTMLDivElement>(null)
	const imgWrapRef = useRef<HTMLDivElement>(null)

	// 关闭:像 macOS 程序缩回程序坞一样,大图飞回墙里对应照片的位置再消失
	const close = () => {
		if (closing) return
		const cell = document.querySelectorAll('[data-wall-cell]')[index]
		const wrap = imgWrapRef.current
		if (cell && wrap) {
			const c = cell.getBoundingClientRect()
			const w = wrap.getBoundingClientRect()
			setExit({
				x: c.left + c.width / 2 - (w.left + w.width / 2),
				y: c.top + c.height / 2 - (w.top + w.height / 2),
				scale: Math.max(0.08, c.width / Math.max(1, w.width))
			})
		} else {
			setExit({ x: 0, y: 0, scale: 0.15 })
		}
		setClosing(true)
	}

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close()
			else if (e.key === 'ArrowLeft') onPrev()
			else if (e.key === 'ArrowRight') onNext()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [close, onPrev, onNext])

	// 标签每次回到固定初始位置(照片右边,一半压图一半在外),图加载后按真实尺寸定位
	const placeLabel = (naturalW: number, naturalH: number) => {
		const maxW = window.innerWidth - 96
		const maxH = window.innerHeight - 96
		const scale = Math.min(1, maxW / naturalW, maxH / naturalH)
		const w = naturalW * scale + 16
		setLabelPos({
			right: Math.max(16, (window.innerWidth - w) / 2 - 100),
			top: window.innerHeight / 2 - 75
		})
	}

	return (
		<>
			<motion.div
				ref={backdropRef}
				data-zoom-backdrop
				initial={{ opacity: 0 }}
				animate={{ opacity: closing ? 0 : 1 }}
				transition={{ duration: closing ? 0.45 : 0.3 }}
				onClick={close}
				style={{ zIndex: 70 }}
				className='bg-card fixed inset-0 backdrop-blur-xl'
			/>
			<motion.div
				ref={imgWrapRef}
				initial={{ opacity: 0, scale: 0.7 }}
				animate={closing && exit ? { x: exit.x, y: exit.y, scale: exit.scale, opacity: 0 } : { opacity: 1, scale: 1 }}
				transition={closing ? { duration: 0.45, ease: [0.45, 0, 0.55, 1] } : { type: 'spring', stiffness: 260, damping: 24 }}
				onAnimationComplete={() => {
					if (closing) onClose()
				}}
				style={{ zIndex: 80 }}
				className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
				<img
					data-zoom-img
					src={item.url}
					draggable={false}
					onLoad={event => {
						const img = event.currentTarget
						placeLabel(img.naturalWidth, img.naturalHeight)
					}}
					className='max-h-[calc(100vh-96px)] max-w-[calc(100vw-96px)] rounded-lg border-8 border-white object-contain shadow-2xl select-none'
				/>
			</motion.div>
			{!closing && item.description && labelPos && (
				<motion.div
					drag
					dragConstraints={backdropRef}
					dragMomentum={false}
					initial={{ opacity: 0, scale: 0.4 }}
					animate={{ opacity: 1, scale: 1 }}
					style={{
						zIndex: 81,
						right: labelPos.right,
						top: labelPos.top,
						backgroundColor: '#f6e8c1',
						borderColor: '#d9c48f'
					}}
					className='fixed w-[200px] min-h-[150px] cursor-pointer rounded-md border p-6 shadow-lg'>
					<div className='mb-2 text-xs text-[#8a6d3f]'>{formatUploadedAt(item.uploadedAt)}</div>
					<div className='text-sm text-[#5f4a28]'>{item.description}</div>
			</motion.div>
			)}
			{!closing && (
			<>
				<button
					onClick={onPrev}
					aria-label='上一张'
					style={{ zIndex: 82 }}
					className='fixed left-6 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/70 text-2xl text-[#5f4a28] shadow-md transition-colors hover:bg-white/95'>
					‹
				</button>
				<button
					onClick={onNext}
					aria-label='下一张'
					style={{ zIndex: 82 }}
					className='fixed right-6 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/70 text-2xl text-[#5f4a28] shadow-md transition-colors hover:bg-white/95'>
					›
				</button>
				<div data-zoom-counter style={{ zIndex: 82 }} className='fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-white/70 px-4 py-1.5 text-sm text-[#5f4a28] shadow-md'>
					{index + 1} / {total}
				</div>
			</>
			)}
		</>
	)
}

interface WallProps {
	items: WallItem[]
	speed: number
	gap: number
	cell: number
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onReplay: () => void
}

function Wall({ items, speed, gap, cell, isEditMode = false, onDeleteSingle, onReplay }: WallProps) {
	const [viewportW, setViewportW] = useState(0)

	useEffect(() => {
		const update = () => setViewportW(window.innerWidth)
		update()
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])

	const queueRef = useRef<PreloadQueue | null>(null)
	if (!queueRef.current) queueRef.current = new PreloadQueue(6)

	const layout = useMemo(() => (viewportW && items.length ? computeLayout(items, viewportW, cell, gap) : null), [items, viewportW, cell, gap])
	const pathInfo = useMemo(() => (layout ? computePath(layout.positions, cell, viewportW) : null), [layout, viewportW, cell])

	const [revealedCount, setRevealedCount] = useState(0)
	const [decoCount, setDecoCount] = useState(0)
	const [skipped, setSkipped] = useState(false)
	const [followAvailable, setFollowAvailable] = useState(false)
	const [zoomIdx, setZoomIdx] = useState<number | null>(null)
	const [hoverIdx, setHoverIdx] = useState<number | null>(null)
	const revealedRef = useRef(0)
	const decoRef = useRef(0)
	const pRef = useRef(0)
	const interruptedRef = useRef(false)
	const lineRef = useRef<SVGPathElement>(null)
	const tipRef = useRef<SVGCircleElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// 动画引擎:线匀速向前画,线到达哪张照片,哪张照片弹出;沿线花草随之生长;自动跟随滚动
	useEffect(() => {
		if (!layout || !pathInfo || items.length === 0) return
		const N = items.length
		const totalMs = Math.max(1, N * speed)
		let raf = 0
		let lastNow = performance.now()

		// 防御:布局变化(如滚动条出现触发 resize)导致本 effect 重跑时,
		// 已揭示的花草游标若超出新装饰数量,需要收拢,避免游标错位
		if (decoRef.current > pathInfo.decorations.length) {
			decoRef.current = pathInfo.decorations.length
			setDecoCount(decoRef.current)
		}

		const maxScroll = () => {
			const el = containerRef.current
			return el ? el.offsetTop + el.offsetHeight - window.innerHeight : 0
		}

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (reduced) {
			revealedRef.current = N
			decoRef.current = pathInfo.decorations.length
			setRevealedCount(N)
			setDecoCount(pathInfo.decorations.length)
			if (lineRef.current) lineRef.current.style.strokeDashoffset = '0'
			return
		}

		const tick = (now: number) => {
			const dt = now - lastNow
			lastNow = now

			// 进度按帧累计(而非依赖 effect 启动时刻),effect 重跑也不会让线跳回起点;
			// 线头到未加载照片时冻结进度,线暂停等图
			const nextIdx = revealedRef.current
			const frontier = nextIdx < N ? pathInfo.fracs[nextIdx] : 1
			const blocked = nextIdx < N && !queueRef.current!.isLoaded(nextIdx)
			if (!(blocked && pRef.current >= frontier)) {
				pRef.current = Math.min(1, pRef.current + dt / totalMs)
			}
			let p = blocked ? Math.min(pRef.current, frontier) : pRef.current

			if (lineRef.current) lineRef.current.style.strokeDashoffset = String(1 - p)

			if (tipRef.current && pathInfo.total > 0) {
				const pt = lineRef.current?.getPointAtLength(Math.min(p, 1) * pathInfo.total)
				if (pt && p > 0) {
					tipRef.current.setAttribute('cx', String(pt.x))
					tipRef.current.setAttribute('cy', String(pt.y))
					tipRef.current.style.display = 'block'
				}
			}

			// 花朵只在"右侧照片已弹出"后开放:第 k 段的花夹在照片 k 与 k+1 之间,
			// 必须等照片 k+1 弹出(revealedRef >= k+2),此时线头已越过花朵位置,
			// 花才在已画好的线上绽放,既不早于相邻照片、也不会抢在线头前面;
			// 收尾花(terminal)例外:开在线的终点,等线画到终点(p >= frac)才绽放
			while (
				decoRef.current < pathInfo.decorations.length &&
				(pathInfo.decorations[decoRef.current].terminal ? p >= pathInfo.decorations[decoRef.current].frac : revealedRef.current >= decoRef.current + 2)
			) {
				decoRef.current++
				setDecoCount(decoRef.current)
			}

			while (revealedRef.current < N && p >= pathInfo.fracs[revealedRef.current] && queueRef.current!.isLoaded(revealedRef.current)) {
				revealedRef.current++
				setRevealedCount(revealedRef.current)
			}

			const done = revealedRef.current >= N
			let shouldStop = false

			if (!interruptedRef.current) {
				let goal: number
				if (done) {
					goal = maxScroll()
				} else {
					const idx = Math.max(0, revealedRef.current - 1)
					goal = Math.min(Math.max(layout.positions[idx].y - cell / 2 - window.innerHeight * 0.4, 0), maxScroll())
				}
				const cur = window.scrollY
				// 注意:全局 html 有 scroll-behavior: smooth,逐帧 scrollTo 会被浏览器自身的平滑动画拖慢,
				// 必须显式 instant,让 rAF 缓动全权接管
				window.scrollTo({ top: cur + (goal - cur) * 0.12, behavior: 'instant' as ScrollBehavior })
				if (done && Math.abs(goal - cur) < 2) shouldStop = true
			} else if (done) {
				shouldStop = true
			}

			if (!shouldStop) raf = requestAnimationFrame(tick)
		}

		raf = requestAnimationFrame(tick)

		const onUserScroll = () => {
			if (revealedRef.current < N) {
				interruptedRef.current = true
				setFollowAvailable(true)
			}
		}
		window.addEventListener('wheel', onUserScroll, { passive: true })
		window.addEventListener('touchstart', onUserScroll, { passive: true })

		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener('wheel', onUserScroll)
			window.removeEventListener('touchstart', onUserScroll)
		}
	}, [layout, pathInfo, items.length, speed, cell])

	const skipToEnd = () => {
		setSkipped(true)
		revealedRef.current = items.length
		decoRef.current = pathInfo?.decorations.length ?? 0
		setRevealedCount(items.length)
		setDecoCount(pathInfo?.decorations.length ?? 0)
		if (lineRef.current) lineRef.current.style.strokeDashoffset = '0'
		const el = containerRef.current
		if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight - window.innerHeight)
	}

	const resumeFollow = () => {
		interruptedRef.current = false
		setFollowAvailable(false)
	}

	if (!layout || !pathInfo) return null

	const done = revealedCount >= items.length
	const totalH = layout.totalH + pathInfo.extraBottom

	return (
		<>
			<div ref={containerRef} className='pointer-events-none relative w-full' style={{ height: totalH }}>
				<svg className='pointer-events-none absolute inset-0' width='100%' height={totalH} viewBox={`0 0 ${viewportW} ${totalH}`} preserveAspectRatio='none' style={{ zIndex: 1 }}>
					<path
						ref={lineRef}
						d={pathInfo.d}
						fill='none'
						stroke='#8fa87d'
						strokeOpacity={0.8}
						strokeWidth={2.5}
						strokeLinecap='round'
						pathLength={1}
						strokeDasharray='1'
						strokeDashoffset='1'
					/>
					<circle ref={tipRef} r={4} fill='#8fa87d' style={{ display: 'none' }} />
					{pathInfo.decorations.map((dec, i) => {
						const on = i < decoCount
						const flowerColor = PETAL_COLORS[i % PETAL_COLORS.length]
						return (
							<g key={i} data-idx={i} data-frac={dec.frac} transform={`translate(${dec.x} ${dec.y})`} style={{ opacity: on ? 1 : 0, transition: 'opacity 0.35s ease' }}>
								<g
									style={{
										transform: on ? 'scale(1)' : 'scale(0.1)',
										transformBox: 'fill-box',
										transformOrigin: 'center',
										transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
									}}>
									{[0, 72, 144, 216, 288].map(a => {
										const rad = (a * Math.PI) / 180
										return (
											<circle
												key={a}
												cx={Math.cos(rad) * 4.6}
												cy={Math.sin(rad) * 4.6}
												r={3.6}
												fill={flowerColor}
											/>
										)
									})}
									<circle r={2.6} fill='#fff3c4' />
								</g>
							</g>
						)
					})}
				</svg>

				{layout.positions.map((pos, i) => {
					const hover: -1 | 0 | 1 = hoverIdx === null || Math.abs(i - hoverIdx) > 1 ? -1 : i === hoverIdx ? 0 : 1
					return (
						<PhotoCell
							key={items[i].url}
							item={items[i]}
							pos={pos}
							cell={cell}
							queue={queueRef.current!}
							popped={i < revealedCount}
							skip={skipped}
							hover={hover}
							onHoverEnter={() => setHoverIdx(i)}
							onHoverLeave={() => setHoverIdx(cur => (cur === i ? null : cur))}
							onZoom={() => {
								setHoverIdx(null)
								setZoomIdx(i)
							}}
							isEditMode={isEditMode}
							onDeleteSingle={onDeleteSingle}
						/>
					)
				})}
			</div>

			{zoomIdx !== null && (
				<PhotoZoom
					key={zoomIdx}
					item={items[zoomIdx]}
					index={zoomIdx}
					total={items.length}
					onClose={() => setZoomIdx(null)}
					onPrev={() => setZoomIdx(zoomIdx === 0 ? items.length - 1 : zoomIdx - 1)}
					onNext={() => setZoomIdx((zoomIdx + 1) % items.length)}
				/>
			)}

			<div className='card fixed right-6 bottom-6 z-50 flex w-44 flex-col gap-2 p-3 text-xs'>
				<div className='text-secondary'>已展示 {revealedCount}/{items.length}</div>
				{done && <div className='text-secondary'>已到最后一张,动画暂停</div>}
				{followAvailable && !done && (
					<button onClick={resumeFollow} className='brand-btn px-2 py-1.5'>
						继续跟随
					</button>
				)}
				<button onClick={skipToEnd} className='rounded-lg border bg-white/60 px-2 py-1.5 transition-colors hover:bg-white/80'>
					⏭ 跳到结束
				</button>
				<button onClick={onReplay} className='rounded-lg border bg-white/60 px-2 py-1.5 transition-colors hover:bg-white/80'>
					↻ 重播
				</button>

			</div>
		</>
	)
}

interface StringWallProps {
	pictures: Picture[]
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
}

// 图床桌面端入口:照片列表交给串线墙;重播 = 回顶 + 重新开播
// 右下角卡片:展示进度 + 继续跟随/跳到结束/重播
const StringWall = ({ pictures, isEditMode = false, onDeleteSingle }: StringWallProps) => {
	const [runKey, setRunKey] = useState(0)
	const items = useMemo(() => buildItems(pictures), [pictures])

	return (
		<>
			{items.length > 0 && (
				<Wall
					key={runKey}
					items={items}
					speed={SPEED_MS}
					gap={GAP_PX}
					cell={CELL_PX}
					isEditMode={isEditMode}
					onDeleteSingle={onDeleteSingle}
					onReplay={() => {
						window.scrollTo(0, 0)
						setRunKey(k => k + 1)
					}}
				/>
			)}
		</>
	)
}

export { StringWall }
