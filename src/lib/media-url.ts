import { GITHUB_CONFIG } from '@/consts'

export function isLocalMediaUrl(url: string): boolean {
	return typeof url === 'string' && url.startsWith('/images/')
}

function toPathname(url: string): string {
	if (!url) return ''
	if (url.startsWith('/')) return url.split('?')[0]
	try {
		return new URL(url).pathname
	} catch {
		return url
	}
}

/** Git 提交后立刻可用，不必等 Vercel 把 public/ 打进这一次部署。 */
export function githubRawMediaUrl(url: string): string | null {
	const path = toPathname(url)
	if (!isLocalMediaUrl(path)) return null
	const { OWNER, REPO, BRANCH } = GITHUB_CONFIG
	return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/public${path}`
}

/** 缩略图 → 原图 → GitHub raw。都失败返回 null。 */
export function nextMediaFallback(currentSrc: string, originalUrl: string): string | null {
	if (currentSrc.startsWith('https://raw.githubusercontent.com/')) return null
	const currentPath = toPathname(currentSrc)
	const originalPath = toPathname(originalUrl)
	if (currentPath !== originalPath) return originalPath
	return githubRawMediaUrl(originalPath)
}
