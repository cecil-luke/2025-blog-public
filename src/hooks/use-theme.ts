'use client'

import { useEffect, useState, useCallback } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'blog-theme-mode'

// 暗色主题色组——与 config-dialog 中"深夜"预设一致
const DARK_THEME: Record<string, string> = {
	'--color-primary': '#e6e8e8',
	'--color-secondary': '#acadae',
	'--color-bg': '#0a051f',
	'--color-border': '#8a8a8a5e',
	'--color-card': '#ffffff0e',
	'--color-article': '#1a1a2e66',
	'--color-brand': '#35bfab',
	'--color-brand-secondary': '#1fc9e7'
}

// 需要管理的 CSS 变量键列表
const THEME_VAR_KEYS = Object.keys(DARK_THEME)

/** 读取 localStorage 中的主题模式 */
function getStoredMode(): ThemeMode {
	if (typeof window === 'undefined') return 'light'
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
	} catch {
		// ignore
	}
	return 'light'
}

/** 判断系统当前是否暗色 */
function getSystemDark(): boolean {
	if (typeof window === 'undefined') return false
	return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 实际生效的主题：auto 模式下根据系统偏好推导 */
function resolveEffective(mode: ThemeMode): 'light' | 'dark' {
	if (mode === 'auto') return getSystemDark() ? 'dark' : 'light'
	return mode
}

/**
 * 捕获当前 <html> 上的亮色 CSS 变量值，用于切回亮色时恢复。
 * 这样用户通过"色彩配置"面板自定义的配色不会被切换主题覆盖。
 */
function captureLightVars(): Record<string, string> {
	if (typeof document === 'undefined') return {}
	const root = document.documentElement
	const vars: Record<string, string> = {}
	for (const key of THEME_VAR_KEYS) {
		const v = root.style.getPropertyValue(key)
		if (v) vars[key] = v.trim()
	}
	return vars
}

// 模块级缓存：记住切到暗色前的亮色变量（跨渲染持久）
let savedLightVars: Record<string, string> | null = null

/** 将暗色 CSS 变量写入 documentElement */
function applyDark() {
	if (typeof document === 'undefined') return
	const root = document.documentElement
	// 切到暗色前，先保存当前亮色变量
	if (!savedLightVars) savedLightVars = captureLightVars()
	for (const [key, value] of Object.entries(DARK_THEME)) {
		root.style.setProperty(key, value)
	}
	root.dataset.theme = 'dark'
	root.style.colorScheme = 'dark'

	const meta = document.querySelector('meta[name="theme-color"]')
	if (meta) meta.setAttribute('content', '#0a051f')

	window.dispatchEvent(new CustomEvent('blog-theme-change', { detail: 'dark' }))
}

/** 恢复亮色 CSS 变量 */
function applyLight() {
	if (typeof document === 'undefined') return
	const root = document.documentElement
	// 如果有保存的亮色变量，恢复它们；否则保持原本 <html> 内联样式（来自 layout.tsx）
	if (savedLightVars) {
		for (const [key, value] of Object.entries(savedLightVars)) {
			root.style.setProperty(key, value)
		}
		savedLightVars = null
	}
	root.dataset.theme = 'light'
	root.style.colorScheme = 'light'

	const meta = document.querySelector('meta[name="theme-color"]')
	if (meta) meta.setAttribute('content', '#d4e8f3')

	window.dispatchEvent(new CustomEvent('blog-theme-change', { detail: 'light' }))
}

function applyEffectiveTheme(effective: 'light' | 'dark') {
	if (effective === 'dark') applyDark()
	else applyLight()
}

export function useTheme() {
	const [mode, setMode] = useState<ThemeMode>('light')
	const [effective, setEffective] = useState<'light' | 'dark'>('light')

	// 初始化：从 localStorage 读取
	useEffect(() => {
		const stored = getStoredMode()
		setMode(stored)
		const eff = resolveEffective(stored)
		setEffective(eff)
		applyEffectiveTheme(eff)
	}, [])

	// auto 模式下监听系统主题变化
	useEffect(() => {
		if (mode !== 'auto') return
		const mql = window.matchMedia('(prefers-color-scheme: dark)')
		const handler = (e: MediaQueryListEvent) => {
			const eff = e.matches ? 'dark' : 'light'
			setEffective(eff)
			applyEffectiveTheme(eff)
		}
		mql.addEventListener('change', handler)
		return () => mql.removeEventListener('change', handler)
	}, [mode])

	const setThemeMode = useCallback((next: ThemeMode) => {
		setMode(next)
		try {
			localStorage.setItem(STORAGE_KEY, next)
		} catch {
			// ignore
		}
		const eff = resolveEffective(next)
		setEffective(eff)
		applyEffectiveTheme(eff)
	}, [])

	const toggle = useCallback(() => {
		// 三态循环：light -> dark -> auto -> light
		const order: ThemeMode[] = ['light', 'dark', 'auto']
		const idx = order.indexOf(mode)
		setThemeMode(order[(idx + 1) % order.length])
	}, [mode, setThemeMode])

	return { mode, effective, setThemeMode, toggle }
}