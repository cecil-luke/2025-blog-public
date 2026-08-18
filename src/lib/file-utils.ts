'use client'

export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result || ''))
		reader.onerror = reject
		reader.readAsText(file)
	})
}

export function fileToBase64NoPrefix(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const dataUrl = String(reader.result || '')
			resolve(dataUrl.replace(/^data:[^;]+;base64,/, ''))
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

/** 把图片缩放到 maxWidth 宽(保持比例)并转成 webp File,供图床上传时自动生成缩略图用 */
export async function makeThumbFile(file: File, maxWidth = 600, quality = 0.8): Promise<File> {
	const bitmap = await createImageBitmap(file)
	let width = bitmap.width
	let height = bitmap.height
	if (width > maxWidth) {
		const ratio = maxWidth / width
		width = maxWidth
		height = Math.round(height * ratio)
	}
	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('无法初始化画布')
	ctx.drawImage(bitmap, 0, 0, width, height)
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			result => {
				if (result) resolve(result)
				else reject(new Error('无法生成 WEBP 文件'))
			},
			'image/webp',
			quality
		)
	})
	return new File([blob], 'thumb.webp', { type: 'image/webp' })
}

export async function hashFileSHA256(file: File): Promise<string> {
	const buf = await file.arrayBuffer()
	const digest = await crypto.subtle.digest('SHA-256', buf)
	const bytes = new Uint8Array(digest)
	let hex = ''
	for (let i = 0; i < bytes.length; i++) {
		const h = bytes[i].toString(16).padStart(2, '0')
		hex += h
	}
	return hex.slice(0, 16)
}
