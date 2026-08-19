'use client'

import { useEffect, useRef, useState } from 'react'

// ============================================================
// 类型定义
// ============================================================

interface Snowflake {
	id: number
	el: HTMLDivElement
	type: 'dot' | 'image'
	size: number
	x: number
	y: number
	vx: number
	vy: number
	baseVy: number
	rotation: number
	rotationSpeed: number
	originX: number
	isInteracting: boolean
}

// ============================================================
// 常量
// ============================================================

const SNOWFLAKE_IMAGES = ['/images/christmas/snowflake/1.webp', '/images/christmas/snowflake/2.webp', '/images/christmas/snowflake/3.webp']
const DOT_RATIO = 0.8
const COUNT = 80

const REPEL_RADIUS = 180
const REPEL_STRENGTH = 5
const LERP_FACTOR = 0.08
const RETURN_FACTOR = 0.008
const CLICK_BURST_RADIUS = 180
const CLICK_BURST_STRENGTH = 8

const REPEL_RADIUS_SQ = REPEL_RADIUS * REPEL_RADIUS
const CLICK_BURST_RADIUS_SQ = CLICK_BURST_RADIUS * CLICK_BURST_RADIUS

// ============================================================
// 模块级单例引擎
// ============================================================

interface PointerState {
	x: number
	y: number
	vx: number
	vy: number
	isDown: boolean
	downX: number
	downY: number
	downTime: number
}

const pointer: PointerState = {
	x: -9999,
	y: -9999,
	vx: 0,
	vy: 0,
	isDown: false,
	downX: 0,
	downY: 0,
	downTime: 0
}

let prevPointer = { x: -9999, y: -9999 }

// 所有实例共享的雪花集合
const allSnowflakes: Snowflake[] = []
let engineRafId = 0
let engineLastTime: number | null = null

// 指针监听器（单例）
let listenerCount = 0
let handlers: {
	onMouseMove: (e: MouseEvent) => void
	onMouseDown: (e: MouseEvent) => void
	onMouseUp: () => void
	onTouchMove: (e: TouchEvent) => void
	onTouchStart: (e: TouchEvent) => void
	onTouchEnd: () => void
} | null = null

function ensurePointerListener() {
	if (listenerCount++ > 0) return

	const onMouseMove = (e: MouseEvent) => {
		pointer.x = e.clientX
		pointer.y = e.clientY
	}

	const onMouseDown = (e: MouseEvent) => {
		pointer.isDown = true
		pointer.downX = e.clientX
		pointer.downY = e.clientY
		pointer.downTime = performance.now()
	}

	const onMouseUp = () => {
		pointer.isDown = false
	}

	const onTouchMove = (e: TouchEvent) => {
		if (e.touches.length > 0) {
			pointer.x = e.touches[0].clientX
			pointer.y = e.touches[0].clientY
		}
	}

	const onTouchStart = (e: TouchEvent) => {
		if (e.touches.length > 0) {
			pointer.isDown = true
			pointer.downX = e.touches[0].clientX
			pointer.downY = e.touches[0].clientY
			pointer.downTime = performance.now()
		}
	}

	const onTouchEnd = () => {
		pointer.isDown = false
	}

	handlers = { onMouseMove, onMouseDown, onMouseUp, onTouchMove, onTouchStart, onTouchEnd }

	window.addEventListener('mousemove', onMouseMove, { passive: true })
	window.addEventListener('mousedown', onMouseDown, { passive: true })
	window.addEventListener('mouseup', onMouseUp, { passive: true })
	window.addEventListener('touchmove', onTouchMove, { passive: true })
	window.addEventListener('touchstart', onTouchStart, { passive: true })
	window.addEventListener('touchend', onTouchEnd, { passive: true })
}

function cleanupPointerListener() {
	if (--listenerCount > 0) return
	if (handlers) {
		window.removeEventListener('mousemove', handlers.onMouseMove)
		window.removeEventListener('mousedown', handlers.onMouseDown)
		window.removeEventListener('mouseup', handlers.onMouseUp)
		window.removeEventListener('touchmove', handlers.onTouchMove)
		window.removeEventListener('touchstart', handlers.onTouchStart)
		window.removeEventListener('touchend', handlers.onTouchEnd)
		handlers = null
	}
}

// 动画引擎循环
function engineLoop(time: number) {
	if (engineLastTime === null || time - engineLastTime > 100) {
		engineLastTime = time
		engineRafId = requestAnimationFrame(engineLoop)
		return
	}

	const deltaTime = time - engineLastTime
	engineLastTime = time
	updateSnowflakes(deltaTime)
	engineRafId = requestAnimationFrame(engineLoop)
}

function startEngine() {
	if (engineRafId === 0 && allSnowflakes.length > 0) {
		engineLastTime = null
		engineRafId = requestAnimationFrame(engineLoop)
	}
}

function stopEngineIfIdle() {
	if (allSnowflakes.length === 0 && engineRafId !== 0) {
		cancelAnimationFrame(engineRafId)
		engineRafId = 0
	}
}

// ============================================================
// 物理模拟
// ============================================================

function updateSnowflakes(deltaTime: number) {
	const dt = Math.min(deltaTime / 16.67, 2)

	pointer.vx = pointer.x - prevPointer.x
	pointer.vy = pointer.y - prevPointer.y
	prevPointer.x = pointer.x
	prevPointer.y = pointer.y

	const mouseSpeed = Math.sqrt(pointer.vx * pointer.vx + pointer.vy * pointer.vy)
	const now = performance.now()

	for (let i = 0; i < allSnowflakes.length; i++) {
		const flake = allSnowflakes[i]

		let targetVx = 0
		let targetVy = flake.baseVy

		const dx = flake.x - pointer.x
		const dy = flake.y - pointer.y
		const distSq = dx * dx + dy * dy

		if (distSq < REPEL_RADIUS_SQ && distSq > 0) {
			const dist = Math.sqrt(distSq)
			const proximity = 1 - dist / REPEL_RADIUS
			const force = proximity * proximity * REPEL_STRENGTH

			const nx = dx / dist
			const ny = dy / dist

			targetVx += nx * force
			targetVy += ny * force * 0.5

			if (mouseSpeed > 5) {
				targetVx += pointer.vx * LERP_FACTOR * proximity
				targetVy += pointer.vy * LERP_FACTOR * proximity * 0.3
			}

			flake.isInteracting = true
		} else {
			flake.isInteracting = false
		}

		if (pointer.isDown) {
			const cdx = flake.x - pointer.downX
			const cdy = flake.y - pointer.downY
			const cdistSq = cdx * cdx + cdy * cdy

			if (cdistSq < CLICK_BURST_RADIUS_SQ && cdistSq > 0) {
				const cdist = Math.sqrt(cdistSq)
				const cproximity = 1 - cdist / CLICK_BURST_RADIUS
				const timeSinceClick = now - pointer.downTime
				const timeDecay = Math.max(0, 1 - timeSinceClick / 500)
				const burstForce = cproximity * cproximity * CLICK_BURST_STRENGTH * timeDecay

				const cnx = cdx / cdist
				const cny = cdy / cdist

				targetVx += cnx * burstForce
				targetVy += cny * burstForce
			}
		}

		targetVx += (flake.originX - flake.x) * RETURN_FACTOR

		flake.vx += (targetVx - flake.vx) * 0.1
		flake.vy += (targetVy - flake.vy) * 0.1

		flake.x += flake.vx * dt
		flake.y += flake.vy * dt

		flake.rotation += flake.rotationSpeed * dt

		if (flake.y > window.innerHeight + 50) {
			flake.y = -50 - Math.random() * 50
			flake.x = flake.originX
			flake.vx = 0
			flake.vy = 0
		}

		if (flake.x < -100) flake.x = -100
		if (flake.x > window.innerWidth + 100) flake.x = window.innerWidth + 100

		// DOM 更新：用 opacity 替代 filter，减少合成器开销
		const scale = flake.isInteracting ? 1.2 : 1
		const opacity = flake.isInteracting ? 1 : 0.7
		flake.el.style.transform = `translate(${flake.x}px, ${flake.y}px) rotate(${flake.rotation}deg) scale(${scale})`
		flake.el.style.opacity = `${opacity}`
	}
}

// ============================================================
// 组件
// ============================================================

export default function SnowfallBackground({
	zIndex,
	count = COUNT
}: {
	zIndex: number
	count?: number
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [opacity, setOpacity] = useState(0)
	const instanceIdRef = useRef(0)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		container.innerHTML = ''
		const mySnowflakes: Snowflake[] = []
		instanceIdRef.current = Date.now()

		for (let i = 0; i < count; i++) {
			const isDot = Math.random() < DOT_RATIO
			const size = isDot ? Math.random() * 10 + 5 : Math.random() * 40 + 20
			const el = document.createElement('div')
			el.className = 'absolute pointer-events-none'
			el.style.willChange = 'transform, opacity'
			el.style.top = '0'
			el.style.left = '0'
			el.style.opacity = '0.7'

			if (isDot) {
				const dot = document.createElement('div')
				dot.className = 'h-full w-full rounded-full bg-white'
				dot.style.width = `${size}px`
				dot.style.height = `${size}px`
				el.appendChild(dot)
			} else {
				const img = document.createElement('img')
				img.src = SNOWFLAKE_IMAGES[Math.floor(Math.random() * SNOWFLAKE_IMAGES.length)]
				img.alt = ''
				img.className = 'h-full w-full object-contain'
				img.draggable = false
				img.style.width = `${size}px`
				img.style.height = `${size}px`
				el.appendChild(img)
			}

			container.appendChild(el)

			const originX = Math.random() * window.innerWidth
			const snowflake: Snowflake = {
				id: i,
				el,
				type: isDot ? 'dot' : 'image',
				size,
				x: originX,
				y: -Math.random() * window.innerHeight * 1.5,
				vx: 0,
				vy: 0,
				baseVy: 0.3 + Math.random() * 0.5,
				rotation: Math.random() * 360,
				rotationSpeed: (Math.random() - 0.5) * 0.5,
				originX,
				isInteracting: false
			}

			mySnowflakes.push(snowflake)
			allSnowflakes.push(snowflake)
		}

		startEngine()

		return () => {
			for (const sf of mySnowflakes) {
				sf.el.remove()
				const idx = allSnowflakes.indexOf(sf)
				if (idx !== -1) allSnowflakes.splice(idx, 1)
			}
			stopEngineIfIdle()
		}
	}, [count])

	useEffect(() => {
		ensurePointerListener()
		return () => cleanupPointerListener()
	}, [])

	useEffect(() => {
		const id = requestAnimationFrame(() => setOpacity(1))
		return () => cancelAnimationFrame(id)
	}, [])

	return (
		<div
			ref={containerRef}
			className='pointer-events-none fixed inset-0 overflow-hidden'
			style={{
				zIndex,
				opacity,
				transition: 'opacity 1s ease-in'
			}}
		/>
	)
}
