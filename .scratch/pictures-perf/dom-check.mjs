import { writeFileSync } from 'node:fs'

const CDP_BASE = 'http://127.0.0.1:9222'
const tabRes = await fetch(CDP_BASE + '/json/new?about:blank', { method: 'PUT' })
const tab = await tabRes.json()
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let msgId = 0
const pending = new Map()
ws.onmessage = e => {
	const msg = JSON.parse(e.data)
	if (msg.id && pending.has(msg.id)) {
		const { resolve, reject } = pending.get(msg.id)
		pending.delete(msg.id)
		if (msg.error) reject(new Error(msg.error.message))
		else resolve(msg.result)
	}
}
function send(method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = ++msgId
		pending.set(id, { resolve, reject })
		ws.send(JSON.stringify({ id, method, params }))
	})
}
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://localhost:2025/pictures' })
const wait = ms => new Promise(r => setTimeout(r, ms))

// 等全部图片展示完(约 26s),期间每 3s 采样可见数量,验证逐张展示
const visSeries = []
for (let i = 0; i < 10; i++) {
	await wait(2600)
	const r = await send('Runtime.evaluate', {
		expression: "JSON.stringify([...document.querySelectorAll('img')].filter(i => i.src.includes('/images/pictures/') && i.parentElement && parseFloat(getComputedStyle(i.parentElement).opacity) > 0.9).length)",
		returnByValue: true
	})
	visSeries.push(Number(r.result.value))
}
console.log('visSeries(每2.6s):', JSON.stringify(visSeries))

// 点击第一张已展示的图片,验证放大
const rectRes = await send('Runtime.evaluate', {
	expression: "JSON.stringify((() => { const imgs = [...document.querySelectorAll('img')].filter(i => i.src.includes('/images/pictures/') && i.complete && i.getBoundingClientRect().width > 0); if (!imgs.length) return { found: false }; const r = imgs[0].getBoundingClientRect(); return { found: true, x: r.left + r.width / 2, y: r.top + r.height / 2 } })())",
	returnByValue: true
})
const target = JSON.parse(rectRes.result.value)
if (target.found) {
	await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 })
	await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 })
	await wait(1200)
	const zoomCheck = await send('Runtime.evaluate', {
		expression: "JSON.stringify((() => { const backdrops = [...document.querySelectorAll('div')].filter(d => String(d.className).includes('backdrop-blur-xl') && getComputedStyle(d).position === 'fixed'); const big = Math.max(...[...document.querySelectorAll('img')].filter(i => i.src.includes('/images/pictures/')).map(i => i.getBoundingClientRect().width)); return { backdrops: backdrops.length, largestImgWidth: Math.round(big) } })())",
		returnByValue: true
	})
	console.log('zoom state:', zoomCheck.result.value)
}
ws.close()
process.exit(0)
