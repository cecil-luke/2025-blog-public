'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

const MODE_INFO: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
	light: { icon: Sun, label: '亮色' },
	dark: { icon: Moon, label: '暗色' },
	auto: { icon: Monitor, label: '跟随系统' }
}

type Variant = 'desktop' | 'mobile'

export function ThemeToggle({ variant = 'desktop' }: { variant?: Variant }) {
	const { mode, toggle } = useTheme()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const info = MODE_INFO[mode]
	const Icon = info.icon

	// 未挂载时渲染占位，避免水合不匹配
	if (!mounted) {
		return (
			<div
				className={cn(
					'flex size-12 items-center justify-center rounded-full',
					variant === 'mobile' && 'bg-brand/20 shadow-md'
				)}
			/>
		)
	}

	if (variant === 'mobile') {
		return (
			<button
				type='button'
				aria-label={'切换主题（当前：' + info.label + '）'}
				title={'当前：' + info.label + '，点击切换'}
				onClick={toggle}
				className='bg-brand/20 hover:bg-brand/30 fixed right-6 z-50 flex size-12 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-colors'
				style={{ bottom: 'calc(18.5rem + env(safe-area-inset-bottom))' }}
			>
			<AnimatePresence mode='wait'>
				<motion.div
					key={mode}
					initial={{ rotate: -90, opacity: 0 }}
					animate={{ rotate: 0, opacity: 1 }}
					exit={{ rotate: 90, opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					<Icon className='size-5 text-primary' />
				</motion.div>
			</AnimatePresence>
		</button>
		)
	}

	// 桌面端：位于编辑按钮（top-4 right-6）正下方，垂直对齐，有间距
	return (
		<button
			type='button'
			aria-label={'切换主题（当前：' + info.label + '）'}
			title={'当前：' + info.label + '，点击切换'}
			onClick={toggle}
			className='bg-card text-secondary hover:text-brand fixed top-[4.75rem] right-6 z-50 flex size-10 items-center justify-center rounded-xl border shadow-sm backdrop-blur-sm transition-colors max-sm:hidden'
		>
			<AnimatePresence mode='wait'>
				<motion.div
					key={mode}
					initial={{ rotate: -90, opacity: 0 }}
					animate={{ rotate: 0, opacity: 1 }}
					exit={{ rotate: 90, opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					<Icon className='size-4' />
				</motion.div>
			</AnimatePresence>
		</button>
	)
}
