import type { AlbumLibrary, AlbumPhoto, NamedAlbum } from './types'

export function photoTime(photo: AlbumPhoto): string {
	return photo.takenAt || photo.uploadedAt
}

export function sortRecents(photos: AlbumPhoto[]): AlbumPhoto[] {
	return [...photos].sort((a, b) => {
		const delta = photoTime(b).localeCompare(photoTime(a))
		if (delta !== 0) return delta
		return b.id.localeCompare(a.id)
	})
}

export function monthLabel(iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return '未知时间'
	return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function groupByMonth(photos: AlbumPhoto[]): { key: string; label: string; photos: AlbumPhoto[] }[] {
	const groups: { key: string; label: string; photos: AlbumPhoto[] }[] = []
	for (const photo of sortRecents(photos)) {
		const date = new Date(photoTime(photo))
		const key = Number.isNaN(date.getTime()) ? 'unknown' : `${date.getFullYear()}-${date.getMonth()}`
		const last = groups[groups.length - 1]
		if (last?.key === key) last.photos.push(photo)
		else groups.push({ key, label: monthLabel(photoTime(photo)), photos: [photo] })
	}
	return groups
}

export function slugifyAlbumTitle(title: string): string {
	const ascii = title
		.trim()
		.toLowerCase()
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return ascii || `album-${Date.now().toString(36)}`
}

export function uniqueSlug(title: string, albums: NamedAlbum[], excludeId?: string): string {
	const base = slugifyAlbumTitle(title)
	let slug = base
	let n = 2
	const taken = (value: string) => albums.some(album => album.slug === value && album.id !== excludeId)
	while (taken(slug)) slug = `${base}-${n++}`
	return slug
}

export function cloneLibrary(library: AlbumLibrary): AlbumLibrary {
	return {
		photos: library.photos.map(photo => ({ ...photo })),
		albums: library.albums.map(album => ({ ...album, photoIds: [...album.photoIds] }))
	}
}

export function albumPhotos(album: NamedAlbum, photos: AlbumPhoto[]): AlbumPhoto[] {
	const byId = new Map(photos.map(photo => [photo.id, photo]))
	return sortRecents(album.photoIds.map(id => byId.get(id)).filter((photo): photo is AlbumPhoto => Boolean(photo)))
}

export function resolveCoverUrl(album: NamedAlbum, photos: AlbumPhoto[]): string | undefined {
	const byId = new Map(photos.map(photo => [photo.id, photo]))
	if (album.coverPhotoId) {
		const cover = byId.get(album.coverPhotoId)
		if (cover) return cover.url
	}
	const members = albumPhotos(album, photos)
	return members[0]?.url
}

export function newPhotoId(): string {
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
