'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { MenuItem, Widget } from 'l2d-widget'
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

const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
let cubismCorePromise: Promise<void> | null = null

// 展示看板娘的路由：首页 + 下列路由前缀
const TARGET_ROUTE_PREFIXES = ['/blog', '/projects', '/about', '/share', '/bloggers']

// 自动切换间隔（毫秒）—— 每两分钟
const AUTO_SWITCH_INTERVAL = 120_000

// 看板娘垂直位置：七分之三，配合 translateY(-50%) 居中
const WIDGET_TOP = '42.857%'

/**
 * l2d-widget@0.1.2 内置的 Cubism 4（moc3）运行时内核是坏的：加载任意
 * `.model3.json`（包括官方 Haru / Hiyori 等）都会在内部抛出
 * `TypeError: g[y[((n + 36) >> 2)]] is not a function`，且抛错发生在内核自己的
 * 异步回调里，业务代码无法捕获，结果是模型永远卡在“切换中”。
 * 所以这里在运行时把 Cubism 4 模型过滤掉，保证看板娘始终可用。
 */
let warnedAboutCubism4 = false

function filterSupportedModels(list: Live2DModelConfig[]): Live2DModelConfig[] {
	const supported = list.filter(model => !model.path.endsWith('.model3.json'))
	if (!warnedAboutCubism4 && supported.length !== list.length) {
		warnedAboutCubism4 = true
		console.warn(
			'[Live2DWidget] l2d-widget 的 Cubism 4 内核不可用，已忽略：',
			list.filter(model => model.path.endsWith('.model3.json')).map(model => model.name)
		)
	}
	return supported
}

function isTargetRoute(pathname: string): boolean {
	return pathname === '/' || TARGET_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

/**
 * l2d-widget 在生产构建中会在模块求值阶段直接读取全局 Live2DCubismCore。
 * 先加载官方 Core，避免打包后初始化顺序变化导致的 ReferenceError。
 */
function loadLive2DCubismCore(): Promise<void> {
	const live2dWindow = window as Window & { Live2DCubismCore?: unknown }
	if (live2dWindow.Live2DCubismCore) return Promise.resolve()
	if (cubismCorePromise) return cubismCorePromise

	cubismCorePromise = new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = CUBISM_CORE_URL
		script.async = true
		script.crossOrigin = 'anonymous'
		script.onload = () => resolve()
		script.onerror = () => {
			cubismCorePromise = null
			reject(new Error('Live2D Cubism Core 加载失败'))
		}
		document.head.appendChild(script)
	})

	return cubismCorePromise
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
		l2d?: { resize?: () => void }
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

		async function initWidget() {
			try {
				await loadLive2DCubismCore()
				if (cancelled) return

				// 动态 import 避免 SSR 问题
				const { createWidget } = await import('l2d-widget')

				if (cancelled) return

				// 统一切换入口：菜单按钮与定时器都走这里，保证索引一致
				const switchTo = (index: number) => {
					const next = ((index % models.length) + models.length) % models.length
					currentModelIndexRef.current = next
					widgetRef.current?.switchModel?.(next)?.catch(err => {
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

				// 自动切换定时器——每分钟换一个模型
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

		initWidget()

		return () => {
			cancelled = true
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
