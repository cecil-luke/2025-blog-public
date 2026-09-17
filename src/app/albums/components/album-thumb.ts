// 相册缩略图 URL 映射
// 网格/卡片展示用缩略图(public/images/albums/sm/<base>.webp,600px 宽),
// 放大查看用原图。仅对本地 /images/albums/ 路径做映射,
// blob / 外链原样返回,搭配 <img onError> 回退到原图。

const PREFIX = '/images/albums/'

function fileBase(url: string): string | null {
	if (typeof url !== 'string' || !url.startsWith(PREFIX)) return null
	const name = url.slice(PREFIX.length)
	if (!name || name.startsWith('sm/')) return null
	const dot = name.lastIndexOf('.')
	return dot > 0 ? name.slice(0, dot) : name
}

export function thumbUrl(url: string): string {
	const base = fileBase(url)
	if (!base) return url
	return `${PREFIX}sm/${base}.webp`
}

/** 由原图 URL 推出缩略图在仓库中的相对路径,用于删除时连缩略图一起清理。非相册路径返回 null。 */
export function thumbRepoPath(url: string): string | null {
	const base = fileBase(url)
	if (!base) return null
	return `public/images/albums/sm/${base}.webp`
}

export function originalRepoPath(url: string): string | null {
	if (typeof url !== 'string' || !url.startsWith(PREFIX)) return null
	const name = url.slice(PREFIX.length)
	if (!name || name.startsWith('sm/')) return null
	return `public/images/albums/${name}`
}
