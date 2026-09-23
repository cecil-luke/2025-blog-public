'use client'

import { useEffect, useRef, useState } from 'react'

type MarkdownPlayerProps = {
	src: string
	width?: string
	height?: string
	title?: string
	allow?: string
	allowFullScreen?: boolean
}

function parsePx(value?: string): number | undefined {
	if (!value) return
	const n = Number(String(value).replace(/px$/i, '').trim())
	return Number.isFinite(n) && n > 0 ? n : undefined
}

function embedUrl(src: string): URL | null {
	try {
		return new URL(src.startsWith('//') ? `https:${src}` : src)
	} catch {
		return null
	}
}

function absoluteEmbedSrc(src: string): string {
	return src.startsWith('//') ? `https:${src}` : src
}

type EmbedLayout = { kind: 'bar'; w: number; h: number } | { kind: 'video'; ratio: string }

function embedLayout(src: string, width?: string, height?: string): EmbedLayout {
	const attrW = parsePx(width)
	const attrH = parsePx(height)
	const url = embedUrl(src)
	const host = url?.hostname || ''

	if (host.endsWith('music.163.com') || host.endsWith('y.qq.com')) {
		const type = url?.searchParams.get('type')
		if (type === '0' || type === '1') {
			return { kind: 'bar', w: attrW || 330, h: Math.max(attrH || 450, 450) }
		}
		// Browser/Typora default iframe is 300×150 and shows the full single-track chrome
		// (cover, transport, footer). Official 330×86 crops the bottom controls.
		return { kind: 'bar', w: attrW || 330, h: Math.max(attrH || 150, 150) }
	}

	if (attrW && attrH) {
		return { kind: 'video', ratio: `${attrW} / ${attrH}` }
	}

	return { kind: 'video', ratio: '16 / 9' }
}

export function isTinyIframe(attribs: Record<string, string>): boolean {
	const w = parsePx(attribs.width)
	const h = parsePx(attribs.height)
	return Boolean(w && h && w <= 160 && h <= 40)
}

export function isPlayerIframe(src: string, attribs: Record<string, string>): boolean {
	if (!src || isTinyIframe(attribs)) return false
	const host = embedUrl(src)?.hostname || ''
	if (
		host.endsWith('music.163.com') ||
		host.endsWith('player.bilibili.com') ||
		host.includes('youtube') ||
		host.endsWith('youtu.be') ||
		host.endsWith('vimeo.com') ||
		host.includes('youku.com') ||
		host.endsWith('y.qq.com')
	) {
		return true
	}
	const w = parsePx(attribs.width)
	const h = parsePx(attribs.height)
	return Boolean(w && h && w >= 200 && h >= 70)
}

export function MarkdownPlayer({ src, width, height, title, allow, allowFullScreen }: MarkdownPlayerProps) {
	const boxRef = useRef<HTMLDivElement>(null)
	const layout = embedLayout(src, width, height)
	const [scale, setScale] = useState(1)
	const embedSrc = absoluteEmbedSrc(src)

	const barWidth = layout.kind === 'bar' ? layout.w : 0
	const barHeight = layout.kind === 'bar' ? layout.h : 0

	useEffect(() => {
		if (!barWidth) return
		const box = boxRef.current
		if (!box) return

		const update = () => {
			const next = box.clientWidth / barWidth
			setScale(Number.isFinite(next) && next > 0 ? next : 1)
		}

		update()
		const observer = new ResizeObserver(update)
		observer.observe(box)
		return () => observer.disconnect()
	}, [barWidth])

	if (layout.kind === 'video') {
		return (
			<div className='md-player md-player-video' style={{ aspectRatio: layout.ratio }}>
				<iframe src={embedSrc} title={title || 'embedded player'} allow={allow} allowFullScreen={allowFullScreen} />
			</div>
		)
	}

	return (
		<div ref={boxRef} className='md-player md-player-bar' style={{ height: Math.ceil(layout.h * scale) }}>
			<iframe
				src={embedSrc}
				title={title || 'embedded player'}
				width={layout.w}
				height={layout.h}
				allow={allow}
				allowFullScreen={allowFullScreen}
				style={{ width: layout.w, height: layout.h, transform: `scale(${scale})` }}
			/>
		</div>
	)
}
