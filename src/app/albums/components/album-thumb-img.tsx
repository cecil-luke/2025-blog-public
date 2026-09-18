'use client'

import { useEffect, useState } from 'react'
import { thumbUrl } from './album-thumb'

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
				if (src !== url) setSrc(url)
			}}
			className={className}
		/>
	)
}
