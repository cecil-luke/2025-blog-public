import { writeFileSync } from 'node:fs'

const CDP_BASE = 'http://127.0.0.1:9222'
const PAGE_URL = 'http://localhost:2025/pictures'
const EXPECTED_IMAGES = 117
const profile = process.argv[2] || 'fast'
const TIMEOUT_MS = profile === 'fast' ? 90000 : 180000

const tabRes = await fetch(CDP_BASE + '/json/new?about:blank', { method: 'PUT' })
const tab = await tabRes.json()
const wsUrl = tab.webSocketDebuggerUrl

const ws = new WebSocket(wsUrl)
await new Promise((resolve, reject) => {
	ws.onopen = resolve
	ws.onerror = reject
})

let msgId = 0
const pending = new Map()
const events = []

ws.onmessage = e => {
	const msg = JSON.parse(e.data)
	if (msg.id && pending.has(msg.id)) {
		const { resolve, reject } = pending.get(msg.id)
		pending.delete(msg.id)
		if (msg.error) reject(new Error(msg.error.message))
		else resolve(msg.result)
	} else if (msg.method) {
		events.push(msg)
	}
}

function send(method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = ++msgId
		pending.set(id, { resolve, reject })
		ws.send(JSON.stringify({ id, method, params }))
	})
}

await send('Network.enable')
await send('Page.enable')
await send('Runtime.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

if (profile === 'slow4g') {
	await send('Network.emulateNetworkConditions', {
		offline: false,
		latency: 150,
		downloadThroughput: (4 * 1024 * 1024) / 8,
		uploadThroughput: (750 * 1024) / 8,
		connectionType: 'cellular4g'
	})
}

const imgReqs = new Map()
const t0 = Date.now()

function collectNetwork() {
	for (const ev of events) {
		if (ev.method === 'Network.requestWillBeSent' && ev.params.request.url.includes('/images/pictures/')) {
			const id = ev.params.requestId
			if (!imgReqs.has(id)) {
				imgReqs.set(id, { url: ev.params.request.url, startMs: Date.now() - t0, endMs: null, bytes: 0 })
			}
		} else if (ev.method === 'Network.loadingFinished' && imgReqs.has(ev.params.requestId)) {
			const r = imgReqs.get(ev.params.requestId)
			r.endMs = Date.now() - t0
			r.bytes = ev.params.encodedDataLength
		} else if (ev.method === 'Network.loadingFailed' && imgReqs.has(ev.params.requestId)) {
			imgReqs.get(ev.params.requestId).endMs = -1
		}
	}
	events.length = 0
}

const navStart = Date.now()
await send('Page.navigate', { url: PAGE_URL })

const samples = []
const sampleInterval = profile === 'fast' ? 150 : 500
let done = false
let prevVis = 0
let maxJump = 0

while (!done) {
	await new Promise(r => setTimeout(r, sampleInterval))
	collectNetwork()
	const finished = [...imgReqs.values()].filter(r => r.endMs !== null && r.endMs > 0)
	const elapsed = Date.now() - navStart

	let o = { imgs: 0, complete: 0, vis: 0 }
	try {
		const r = await send('Runtime.evaluate', {
			expression: "JSON.stringify((() => { const imgs = [...document.querySelectorAll('img')].filter(i => i.src.includes('/images/pictures/')); return { imgs: imgs.length, complete: imgs.filter(i => i.complete && i.naturalWidth > 0).length, vis: imgs.filter(i => i.parentElement && parseFloat(getComputedStyle(i.parentElement).opacity) > 0.9).length } })())",
			returnByValue: true
		})
		o = JSON.parse(r.result.value)
	} catch {}

	const inFlight = [...imgReqs.values()].filter(r => r.endMs === null).length
	maxJump = Math.max(maxJump, o.vis - prevVis)
	prevVis = o.vis

	samples.push({ t: elapsed, imgs: o.imgs, complete: o.complete, vis: o.vis, inFlight })

	const allDone = finished.length >= EXPECTED_IMAGES && o.vis >= EXPECTED_IMAGES
	if (allDone) done = true
	if (elapsed > TIMEOUT_MS) done = true
}

collectNetwork()
const all = [...imgReqs.values()]
const finished = all.filter(r => r.endMs !== null && r.endMs > 0)
const sortedEnd = finished.map(r => r.endMs).sort((a, b) => a - b)
const lastEnd = sortedEnd.length ? sortedEnd[sortedEnd.length - 1] : null
const lastVis = samples.filter(s => s.vis >= EXPECTED_IMAGES)
const lastReveal = lastVis.length ? lastVis[0].t : null
const totalBytes = finished.reduce((s, r) => s + r.bytes, 0)

const report = {
	profile,
	expectedImages: EXPECTED_IMAGES,
	requestCount: all.length,
	finishedCount: finished.length,
	lastImageLoadedMs: lastEnd,
	lastImageRevealedMs: lastReveal,
	firstImageLoadedMs: sortedEnd[0] ?? null,
	totalMegabytes: +(totalBytes / 1024 / 1024).toFixed(2),
	maxInFlightObserved: samples.length ? Math.max(...samples.map(s => s.inFlight)) : 0,
	maxVisJumpPerSample: maxJump,
	samples: samples.filter((_, i) => i % 4 === 0)
}

console.log(JSON.stringify(report, null, 2))
writeFileSync('.scratch/pictures-perf/post-' + profile + '.json', JSON.stringify(report, null, 2))
ws.close()
process.exit(0)
