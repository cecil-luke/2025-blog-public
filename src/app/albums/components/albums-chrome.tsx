'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { useAlbumsStore } from '../stores/albums-store'
import { pushAlbums } from '../services/push-albums'
import { cn } from '@/lib/utils'

export function AlbumsChrome({
	title,
	count,
	backHref,
	backLabel,
	tab,
	onTabChange,
	extraEditButtons,
	children
}: {
	title: string
	count: number
	backHref: string
	backLabel: string
	tab?: 'recents' | 'albums'
	onTabChange?: (tab: 'recents' | 'albums') => void
	extraEditButtons?: ReactNode
	children: ReactNode
}) {
	const router = useRouter()
	const keyInputRef = useRef<HTMLInputElement>(null)
	const [isSaving, setIsSaving] = useState(false)
	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false
	const { isEditMode, setEditMode, library, imageItems, cancelEdits, markSaved } = useAlbumsStore()

	const handleChoosePrivateKey = async (file: File) => {
		try {
			const text = await file.text()
			setPrivateKey(text)
			await handleSave()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleSave = async () => {
		setIsSaving(true)
		try {
			await pushAlbums({
				library,
				imageItems
			})
			markSaved()
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleSaveClick = () => {
		if (!isAuth) keyInputRef.current?.click()
		else handleSave()
	}

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!isEditMode && (event.ctrlKey || event.metaKey) && event.key === ',') {
				event.preventDefault()
				setEditMode(true)
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isEditMode, setEditMode])

	const buttonText = isAuth ? '保存' : '导入密钥'

	return (
		<div className='mx-auto min-h-screen max-w-6xl px-4 pt-20 pb-16 sm:px-6'>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async event => {
					const file = event.target.files?.[0]
					if (file) await handleChoosePrivateKey(file)
					if (event.currentTarget) event.currentTarget.value = ''
				}}
			/>

			<header className='mb-6 flex flex-wrap items-center gap-3'>
				<button type='button' onClick={() => router.push(backHref)} className='rounded-xl border bg-white/60 px-3 py-1.5 text-sm backdrop-blur-sm'>
					← {backLabel}
				</button>
				<div className='min-w-0'>
					<h1 className='truncate text-xl font-semibold'>{title}</h1>
					<p className='text-secondary text-xs'>{count} 张</p>
				</div>
				{onTabChange && tab && (
					<div className='flex rounded-xl border bg-white/50 p-0.5 text-sm backdrop-blur-sm'>
						{(
							[
								['recents', '最近'],
								['albums', '相簿']
							] as const
						).map(([value, label]) => (
							<button
								type='button'
								key={value}
								onClick={() => onTabChange(value)}
								className={cn('rounded-lg px-3 py-1.5', tab === value ? 'bg-white shadow-sm' : 'text-secondary')}>
								{label}
							</button>
						))}
					</div>
				)}
			</header>

			{children}

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='fixed top-4 right-6 z-30 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={cancelEdits}
							disabled={isSaving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							取消
						</motion.button>
						{extraEditButtons}
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSaveClick} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : buttonText}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setEditMode(true)}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>
		</div>
	)
}
