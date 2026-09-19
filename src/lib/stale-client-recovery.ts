import {
	documentPathFromRequest,
	isFailedRscResponse,
	isInternalHtmlLink,
	isPendingRedeploy,
	isRscPrefetch,
	isRscRequest,
	isStaleBuildError
} from '@/lib/stale-client'

let lastIntentHref = ''
let navigating = false

function assign(href: string): void {
	if (typeof window === 'undefined' || navigating) return
	navigating = true
	window.location.assign(href)
}

function recover(href?: string): void {
	assign(href || lastIntentHref || window.location.href)
}

export function installStaleClientRecovery(): () => void {
	lastIntentHref = window.location.href
	navigating = false
	const originalFetch = window.fetch.bind(window)

	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const rsc = isRscRequest(input, init)
		const prefetch = isRscPrefetch(input, init)
		const dest = `${window.location.origin}${documentPathFromRequest(input, window.location.origin)}`

		if (rsc && !prefetch && isPendingRedeploy()) {
			recover(dest)
			return new Promise<Response>(() => {})
		}

		try {
			const res = await originalFetch(input, init)
			if (rsc && !prefetch && isFailedRscResponse(res)) {
				recover(dest)
				return new Promise<Response>(() => {})
			}
			return res
		} catch (error) {
			if (rsc && !prefetch) recover(dest)
			throw error
		}
	}

	const onClick = (event: MouseEvent) => {
		if (event.defaultPrevented || event.button !== 0) return
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
		const target = event.target
		if (!(target instanceof Element)) return
		const anchor = target.closest('a[href]')
		if (!(anchor instanceof HTMLAnchorElement)) return
		const url = isInternalHtmlLink(anchor, window.location)
		if (!url) return
		lastIntentHref = url.href
		if (!isPendingRedeploy()) return
		event.preventDefault()
		event.stopPropagation()
		recover(url.href)
	}

	const onError = (event: Event) => {
		if (event instanceof ErrorEvent && isStaleBuildError(event.error || event.message)) {
			recover()
			return
		}
		const el = event.target
		if (el instanceof HTMLScriptElement && /\/_next\//.test(el.src)) recover()
		if (el instanceof HTMLLinkElement && el.rel === 'stylesheet' && /\/_next\//.test(el.href)) recover()
	}

	const onRejection = (event: PromiseRejectionEvent) => {
		if (isStaleBuildError(event.reason)) {
			event.preventDefault()
			recover()
		}
	}

	document.addEventListener('click', onClick, true)
	window.addEventListener('error', onError, true)
	window.addEventListener('unhandledrejection', onRejection)

	return () => {
		window.fetch = originalFetch
		document.removeEventListener('click', onClick, true)
		window.removeEventListener('error', onError, true)
		window.removeEventListener('unhandledrejection', onRejection)
	}
}
