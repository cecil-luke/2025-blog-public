const PENDING_REDEPLOY_KEY = 'blog-pending-redeploy'
const PENDING_REDEPLOY_MS = 15 * 60 * 1000

export function markPendingRedeploy(): void {
	if (typeof sessionStorage === 'undefined') return
	sessionStorage.setItem(PENDING_REDEPLOY_KEY, String(Date.now()))
}

export function isPendingRedeploy(): boolean {
	if (typeof sessionStorage === 'undefined') return false
	const raw = sessionStorage.getItem(PENDING_REDEPLOY_KEY)
	if (!raw) return false
	const startedAt = Number(raw)
	if (!Number.isFinite(startedAt)) {
		sessionStorage.removeItem(PENDING_REDEPLOY_KEY)
		return false
	}
	if (Date.now() - startedAt > PENDING_REDEPLOY_MS) {
		sessionStorage.removeItem(PENDING_REDEPLOY_KEY)
		return false
	}
	return true
}

export function isStaleBuildError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '')
	return (
		/Loading chunk [\d]+ failed/i.test(message) ||
		/ChunkLoadError/i.test(message) ||
		/Failed to fetch dynamically imported module/i.test(message) ||
		/error loading dynamically imported module/i.test(message) ||
		/Failed to load chunk/i.test(message) ||
		/Failed to fetch RSC payload/i.test(message) ||
		/unexpected response was received from the server/i.test(message)
	)
}

function headerValue(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string | null {
	if (init?.headers) {
		const fromInit = new Headers(init.headers).get(name)
		if (fromInit !== null) return fromInit
	}
	if (typeof Request !== 'undefined' && input instanceof Request) {
		return input.headers.get(name)
	}
	return null
}

export function isRscRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
	if (headerValue(input, init, 'RSC') === '1') return true
	if (headerValue(input, init, 'Next-Router-Prefetch')) return true
	try {
		const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return new URL(href, 'https://example.com').searchParams.has('_rsc')
	} catch {
		return false
	}
}

export function isRscPrefetch(input: RequestInfo | URL, init?: RequestInit): boolean {
	return headerValue(input, init, 'Next-Router-Prefetch') === '1'
}

export function documentPathFromRequest(input: RequestInfo | URL, origin = 'https://example.com'): string {
	const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	const url = new URL(href, origin)
	url.searchParams.delete('_rsc')
	return `${url.pathname}${url.search}${url.hash}`
}

export function isInternalHtmlLink(anchor: HTMLAnchorElement, location: Pick<Location, 'href' | 'origin'>): URL | null {
	if (anchor.target && anchor.target !== '_self') return null
	if (anchor.hasAttribute('download')) return null
	const href = anchor.getAttribute('href')
	if (!href || href.startsWith('javascript:')) return null
	const url = new URL(anchor.href, location.href)
	if (url.origin !== location.origin) return null
	if (url.pathname === new URL(location.href).pathname && url.search === new URL(location.href).search && url.hash) return null
	return url
}

export function isFailedRscResponse(res: Pick<Response, 'ok' | 'headers'>): boolean {
	if (!res.ok) return true
	const contentType = res.headers.get('content-type') || ''
	return contentType.includes('text/html')
}
