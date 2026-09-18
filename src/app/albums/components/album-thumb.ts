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

const originalPreloads = new Map<string, Promise<void>>()

/** 原图预加载：同一 URL 只打一次，命中后查看器 <img> 走缓存。 */
export function preloadOriginal(url: string, priority: 'high' | 'low' = 'low'): Promise<void> {
	const existing = originalPreloads.get(url)
	if (existing) return existing
	const task = new Promise<void>(resolve => {
		const img = new Image()
		img.fetchPriority = priority
		img.onload = () => resolve()
		img.onerror = () => {
			originalPreloads.delete(url)
			resolve()
		}
		img.src = url
	})
	originalPreloads.set(url, task)
	return task
}
