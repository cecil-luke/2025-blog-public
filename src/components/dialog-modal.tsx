'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface DialogModalProps {
	open: boolean
	onClose: () => void
	children: ReactNode
	className?: string
	overlayClassName?: string
	disableCloseOnOverlay?: boolean
	lockScroll?: boolean
	closeOnEsc?: boolean
}

export function DialogModal({
	open,
	onClose,
	children,
	className,
	overlayClassName,
	disableCloseOnOverlay = false,
	lockScroll = true,
	closeOnEsc = true
}: DialogModalProps) {
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!lockScroll || !open) return
		const previous = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = previous
		}
	}, [lockScroll, open])

	useEffect(() => {
		if (!closeOnEsc || !open) return
		const handler = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose()
			}
		}
		window.addEventListener('keydown', handler)
		return () => {
			window.removeEventListener('keydown', handler)
		}
	}, [closeOnEsc, onClose, open])

	if (!mounted) return null

	return createPortal(
		<AnimatePresence>
			{open && (
				<div className={cn('bg-card fixed inset-0 z-50', overlayClassName)} onClick={disableCloseOnOverlay ? undefined : onClose}>
					{/* 模糊层与内容平级：祖先上的 transform / backdrop-filter 会让内部滑条拖不动 */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='pointer-events-none absolute inset-0 backdrop-blur-xl'
					/>
					<div className='pointer-events-none relative flex h-full w-full items-center justify-center p-4'>
						<div className={cn('pointer-events-auto static', className)} onClick={e => e.stopPropagation()}>
							{children}
						</div>
					</div>
				</div>
			)}
		</AnimatePresence>,
		document.body
	)
}
