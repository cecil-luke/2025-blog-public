'use client'

import { useEffect, useState } from 'react'
import { thumbUrl } from './album-thumb'

export function AlbumThumb({ url, alt = '', className, draggable = false }: { url: string; alt?: string; className?: string; draggable?: boolean }) {
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
			onError={() => {
				if (src !== url) setSrc(url)
			}}
			className={className}
		/>
	)
}
