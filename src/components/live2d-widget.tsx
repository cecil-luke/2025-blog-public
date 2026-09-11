'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { MenuItem, Widget } from '@lukias/l2d-cubism2'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'

// ============================================================
// 模型配置
// ============================================================

type Live2DModelConfig = {
	path: string
	name: string
}

const DEFAULT_MODELS: Live2DModelConfig[] = [
	{ path: '/live2d/models/rem/model.json', name: 'Rem' },
	{ path: '/live2d/models/Kar98k-normal/model.json', name: 'Kar98k' },
	{ path: '/live2d/models/HK416-1-normal/model.json', name: 'HK416' }
]

// 展示看板娘的路由：首页 + 下列路由前缀
const TARGET_ROUTE_PREFIXES = ['/blog', '/projects', '/about', '/share', '/bloggers']

// 自动切换间隔（毫秒）—— 每两分钟
const AUTO_SWITCH_INTERVAL = 120_000

// 看板娘垂直位置：七分之三，配合 translateY(-50%) 居中
const WIDGET_TOP = '42.857%'

// 本地 Cubism 2 专用包不支持 .model3.json，提前过滤避免加载失败。
let warnedAboutUnsupportedModels = false

function filterSupportedModels(list: Live2DModelConfig[]): Live2DModelConfig[] {
	const supported = list.filter(model => !model.path.endsWith('.model3.json'))
	if (!warnedAboutUnsupportedModels && supported.length !== list.length) {
		warnedAboutUnsupportedModels = true
		console.warn(
			'[Live2DWidget] 本地 Cubism 2 专用包不支持 model3.json，已忽略：',
			list.filter(model => model.path.endsWith('.model3.json')).map(model => model.name)
		)
	}
	return supported
}

function isTargetRoute(pathname: string): boolean {
	return pathname === '/' || TARGET_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function scheduleIdle(callback: () => void, timeout: number): () => void {
	if (typeof window.requestIdleCallback === 'function') {
		const handle = window.requestIdleCallback(callback, { timeout })
		return () => window.cancelIdleCallback(handle)
	}

	const handle = window.setTimeout(callback, timeout)
	return () => window.clearTimeout(handle)
}

/** 找到 l2d-widget 创建的 container 并覆写样式为左侧固定位置 */
function overrideContainerPosition() {
	// l2d-widget 创建 container 的样式：position:fixed; bottom:0; left:0; pointer-events:none
	const candidates = document.querySelectorAll<HTMLDivElement>('div')
	for (const el of candidates) {
		const style = el.style
		if (
			style.position === 'fixed' &&
			style.pointerEvents === 'none' &&
			(style.bottom === '0' || style.bottom === '0px') &&
			(style.left === '0' || style.left === '0px') &&
			style.width &&
			style.height &&
			// 确保是我们创建的 canvas container（包含 canvas 子元素）
			el.querySelector('canvas')
		) {
			el.style.top = WIDGET_TOP
			el.style.left = '24px'
			el.style.bottom = 'auto'
			el.style.right = 'auto'
			el.style.transform = 'translateY(-50%)'
			el.style.zIndex = '40'
			return true
		}
	}
	return false
}

// ============================================================
// 组件
// ============================================================

export default function Live2DWidget() {
	const pathname = usePathname()
	const { maxSM, init } = useSize()
	const { siteContent } = useConfigStore()

	const widgetRef = useRef<{
		destroy?: () => Promise<void>
		switchModel?: (index: number) => Promise<void>
		l2d?: { resize?: () => void; pause?: () => void; resume?: () => void }
	} | null>(null)
	const autoSwitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const currentModelIndexRef = useRef(0)

	// 从配置中读取模型列表，默认使用内置列表
	const configModels = (siteContent as { live2dModels?: Live2DModelConfig[] }).live2dModels
	const models = filterSupportedModels(configModels ?? DEFAULT_MODELS)
	const enableLive2D = (siteContent as { enableLive2DWidget?: boolean }).enableLive2DWidget ?? true

	// 移动端不展示；路由不在目标列表也不展示
	const shouldRender = enableLive2D && !maxSM && init && isTargetRoute(pathname) && models.length > 0

	// 浏览器页面缩放会改变 devicePixelRatio，但画布的 CSS 尺寸不变。
	// 主动调用库的 resize()，让 WebGL 画布按新的像素比重新适配，避免放大后发虚。
	useEffect(() => {
		let resizeFrame: number | null = null

		const handleViewportResize = () => {
			if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
			resizeFrame = requestAnimationFrame(() => {
				resizeFrame = null
				widgetRef.current?.l2d?.resize?.()
			})
		}

		window.addEventListener('resize', handleViewportResize)
		window.visualViewport?.addEventListener('resize', handleViewportResize)

		return () => {
			if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
			window.removeEventListener('resize', handleViewportResize)
			window.visualViewport?.removeEventListener('resize', handleViewportResize)
		}
	}, [])

	// 页面切到后台时暂停 WebGL 渲染，回来后继续，降低 CPU/GPU 和电量消耗。
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) widgetRef.current?.l2d?.pause?.()
			else widgetRef.current?.l2d?.resume?.()
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [])

	useEffect(() => {
		if (!shouldRender) {
			// 清理：销毁 widget（async 但不需要等待——destroy 会做完整资源回收）
			if (widgetRef.current) {
				widgetRef.current.destroy?.()
				widgetRef.current = null
			}
			if (autoSwitchTimerRef.current) {
				clearInterval(autoSwitchTimerRef.current)
				autoSwitchTimerRef.current = null
			}
			return
		}

		let cancelled = false
		let cancelInit: (() => void) | null = null
		let cancelPreload: (() => void) | null = null

		async function initWidget() {
			try {
				// 动态 import 避免 SSR 问题
				const { createWidget, preloadModel } = await import('@lukias/l2d-cubism2')

				if (cancelled) return

				const schedulePreload = () => {
					if (cancelled || models.length < 2) return
					cancelPreload?.()
					cancelPreload = scheduleIdle(() => {
						const next = models[(currentModelIndexRef.current + 1) % models.length]
						if (next) void preloadModel(next.path).catch(() => undefined)
					}, 4000)
				}

				// 统一切换入口：菜单按钮与定时器都走这里，保证索引一致
				const switchTo = (index: number) => {
					const next = ((index % models.length) + models.length) % models.length
					currentModelIndexRef.current = next
					widgetRef.current
						?.switchModel?.(next)
						?.then(() => schedulePreload())
						.catch(err => {
							console.error('[Live2DWidget] 切换模型失败:', err)
						})
				}

				// 只保留“切换模型”和“休息”，去掉默认的 About（详细信息）
				const switchItems: MenuItem[] =
					models.length > 1
						? [
								{
									icon: 'mdi:shuffle-variant',
									label: '切换模型',
									onClick: () => switchTo(currentModelIndexRef.current + 1)
								}
							]
						: []
				const menuItems: MenuItem[] = [
					...switchItems,
					{
						icon: 'mdi:bed',
						label: '休息',
						onClick: (widget: Widget) => widget.sleep()
					}
				]

				// 创建 widget——使用 fade 过渡避免 slide 动画干扰定位
				const widget = createWidget({
					model: models.map(m => ({
						path: m.path,
						tips: {
							welcomeMessage: ['欢迎来访！', '好久不见，欢迎回来！', '你来啦～'],
							messages: ['记得多休息哦～', '有什么可以帮你的吗？', '今天也要开心哦！', '看累了记得站起来走走~', '这篇文章写得不错呢！'],
							duration: 4000,
							interval: 10000
						}
					})),
					position: 'bottom-left',
					size: { width: 350, height: 400 },
					transitionType: 'fade',
					transitionDuration: 800,
					primaryColor: 'rgba(111, 209, 66, 0.9)',
					menus: { items: menuItems }
				})

				if (cancelled) {
					widget.destroy()
					return
				}

				widgetRef.current = widget

				// 覆写 container 样式：固定在左侧 3/7 处
				// createWidget 是同步创建 DOM 的，但 canvas 可能需要一帧才插入
				// 先尝试直接查找，找不到就用 requestAnimationFrame 等一帧
				if (!overrideContainerPosition()) {
					requestAnimationFrame(() => {
						if (!cancelled) overrideContainerPosition()
					})
				}

				schedulePreload()

				// 自动切换定时器——每两分钟换一个模型
				currentModelIndexRef.current = 0
				if (autoSwitchTimerRef.current) clearInterval(autoSwitchTimerRef.current)
				if (models.length > 1) {
					autoSwitchTimerRef.current = setInterval(() => {
						switchTo(currentModelIndexRef.current + 1)
					}, AUTO_SWITCH_INTERVAL)
				}
			} catch (err) {
				console.error('[Live2DWidget] 初始化失败:', err)
			}
		}

		// 等首屏渲染完再初始化模型，避免下载模型资源阻塞页面出现。
		cancelInit = scheduleIdle(() => {
			void initWidget()
		}, 1200)

		return () => {
			cancelled = true
			cancelInit?.()
			cancelPreload?.()
			if (autoSwitchTimerRef.current) {
				clearInterval(autoSwitchTimerRef.current)
				autoSwitchTimerRef.current = null
			}
			if (widgetRef.current) {
				widgetRef.current.destroy?.()
				widgetRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldRender])

	if (!shouldRender) return null

	return null
}
