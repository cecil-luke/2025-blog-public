'use client'

import { useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { DialogModal } from '@/components/dialog-modal'
import { cn } from '@/lib/utils'
import type { TocItem } from '@/lib/markdown-renderer'

export function MobileBlogToc({ toc }: { toc: TocItem[] }) {
	const [open, setOpen] = useState(false)
	if (toc.length === 0) return null

	return (
		<>
			<button
				type='button'
				aria-label='打开文章目录'
				onClick={() => setOpen(true)}
				className='bg-card text-secondary fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full border px-4 py-3 text-sm shadow-lg'>
				<BookOpen className='size-4' />
				目录
			</button>
			<DialogModal
				open={open}
				onClose={() => setOpen(false)}
				className='bg-card absolute right-0 bottom-0 left-0 max-h-[75vh] overflow-hidden rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]'
				overlayClassName='items-end p-0'>
				<div className='flex items-center justify-between'>
					<h2 className='text-lg font-semibold'>文章目录</h2>
					<button type='button' aria-label='关闭文章目录' onClick={() => setOpen(false)} className='text-secondary rounded-full p-2 hover:bg-black/5'>
						<X className='size-5' />
					</button>
				</div>
				<nav aria-label='文章目录' className='mt-3 max-h-[calc(75vh-5rem)] overflow-y-auto'>
					{toc.map((item, index) => (
						<a
							key={`${item.id}-${index}`}
							href={`#${item.id}`}
							onClick={() => setOpen(false)}
							className={cn('hover:text-brand block min-h-11 py-3 text-sm transition-colors', item.level > 1 && 'pl-4')}>
							{item.text}
						</a>
					))}
				</nav>
			</DialogModal>
		</>
	)
}
