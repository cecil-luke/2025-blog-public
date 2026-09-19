'use client'

import { useEffect, useState } from 'react'
import { thumbUrl } from './album-thumb'
import { nextMediaFallback } from '@/lib/media-url'

export function AlbumThumb({
	url,
	alt = '',
	className,
	draggable = false,
	onLoad
}: {
	url: string
	alt?: string
	className?: string
	draggable?: boolean
	onLoad?: () => void
}) {
	const [src, setSrc] = useState(() => thumbUrl(url))

	useEffect(() => {
		setSrc(thumbUrl(url))
	}, [url])

	return (
		<img
			src={src}
			alt={alt}
			loading='lazy'
			decoding='async'
			draggable={draggable}
			onLoad={onLoad}
			onError={() => {
				const next = nextMediaFallback(src, url)
				if (next && next !== src) setSrc(next)
			}}
			className={className}
		/>
	)
}
