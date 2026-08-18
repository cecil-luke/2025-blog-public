'use client'

import { useState, useEffect, useCallback } from 'react'
import { SearchPalette } from '@/components/search-palette'

/**
 * 搜索面板容器：管理打开/关闭状态，监听 Cmd/Ctrl+K 快捷键。
 * 挂载到 Layout 层，全站可用。
 */
export function SearchPaletteContainer() {
	const [open, setOpen] = useState(false)

	const toggleOpen = useCallback(() => setOpen(prev => !prev), [])

	useEffect(() => {
		// 监听 SearchPalette 内部派发的 toggle 事件
		window.addEventListener('dsh-toggle-search-palette', toggleOpen as EventListener)
		return () => {
			window.removeEventListener('dsh-toggle-search-palette', toggleOpen as EventListener)
		}
	}, [toggleOpen])

	return <SearchPalette open={open} onClose={() => setOpen(false)} />
}
