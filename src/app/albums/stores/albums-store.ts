'use client'

import { create } from 'zustand'
import initialLibrary from '../library.json'
import type { AlbumLibrary, AlbumPhoto, NamedAlbum } from '../types'
import { cloneLibrary, uniqueSlug } from '../library-utils'
import type { ImageItem } from '../../projects/components/image-upload-dialog'

type AlbumsState = {
	library: AlbumLibrary
	originalLibrary: AlbumLibrary
	imageItems: Map<string, ImageItem>
	isEditMode: boolean
	setEditMode: (value: boolean) => void
	addPhotos: (photos: AlbumPhoto[], items: Map<string, ImageItem>, albumIds?: string[]) => void
	deletePhoto: (id: string) => void
	createAlbum: (input: { title: string; description?: string; photoIds?: string[]; coverPhotoId?: string }) => NamedAlbum
	updateAlbum: (id: string, patch: { title: string; description?: string; coverPhotoId?: string }) => void
	deleteAlbum: (id: string) => void
	setAlbumPhotos: (albumId: string, photoIds: string[]) => void
	removeFromAlbum: (albumId: string, photoId: string) => void
	setCover: (albumId: string, photoId?: string) => void
	cancelEdits: () => void
	markSaved: (saved: AlbumLibrary) => void
}

const emptyLibrary = cloneLibrary(initialLibrary as AlbumLibrary)

function revokeItems(items: Map<string, ImageItem>) {
	for (const item of items.values()) {
		if (item.type === 'file') URL.revokeObjectURL(item.previewUrl)
	}
}

export const useAlbumsStore = create<AlbumsState>((set, get) => ({
	library: cloneLibrary(emptyLibrary),
	originalLibrary: cloneLibrary(emptyLibrary),
	imageItems: new Map(),
	isEditMode: false,
	setEditMode: value => set({ isEditMode: value }),
	addPhotos: (photos, items, albumIds) => {
		set(state => {
			const nextItems = new Map(state.imageItems)
			for (const [id, item] of items) nextItems.set(id, item)
			const photoIds = photos.map(photo => photo.id)
			return {
				imageItems: nextItems,
				library: {
					photos: [...photos, ...state.library.photos],
					albums: state.library.albums.map(album => {
						if (!albumIds?.includes(album.id)) return album
						const nextIds = [...photoIds.filter(id => !album.photoIds.includes(id)), ...album.photoIds]
						const coverStillValid = album.coverPhotoId && nextIds.includes(album.coverPhotoId)
						return {
							...album,
							photoIds: nextIds,
							coverPhotoId: coverStillValid ? album.coverPhotoId : nextIds[0]
						}
					})
				}
			}
		})
	},
	deletePhoto: id => {
		const item = get().imageItems.get(id)
		if (item?.type === 'file') URL.revokeObjectURL(item.previewUrl)
		set(state => {
			const nextItems = new Map(state.imageItems)
			nextItems.delete(id)
			return {
				imageItems: nextItems,
				library: {
					photos: state.library.photos.filter(photo => photo.id !== id),
					albums: state.library.albums.map(album => ({
						...album,
						photoIds: album.photoIds.filter(photoId => photoId !== id),
						coverPhotoId: album.coverPhotoId === id ? undefined : album.coverPhotoId
					}))
				}
			}
		})
	},
	createAlbum: input => {
		const photoIds = input.photoIds ? [...new Set(input.photoIds)] : []
		if (input.coverPhotoId && !photoIds.includes(input.coverPhotoId)) photoIds.unshift(input.coverPhotoId)
		const coverPhotoId = input.coverPhotoId && photoIds.includes(input.coverPhotoId) ? input.coverPhotoId : photoIds[0]
		const album: NamedAlbum = {
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			slug: uniqueSlug(input.title, get().library.albums),
			title: input.title.trim(),
			description: input.description?.trim() || undefined,
			coverPhotoId,
			createdAt: new Date().toISOString(),
			photoIds
		}
		set(state => ({
			library: {
				...state.library,
				albums: [album, ...state.library.albums]
			}
		}))
		return album
	},
	updateAlbum: (id, patch) => {
		set(state => ({
			library: {
				...state.library,
				albums: state.library.albums.map(album =>
					album.id === id
						? {
								...album,
								title: patch.title.trim(),
								description: patch.description?.trim() || undefined,
								coverPhotoId:
									patch.coverPhotoId && album.photoIds.includes(patch.coverPhotoId) ? patch.coverPhotoId : album.coverPhotoId
							}
						: album
				)
			}
		}))
	},
	deleteAlbum: id => {
		set(state => ({
			library: {
				...state.library,
				albums: state.library.albums.filter(album => album.id !== id)
			}
		}))
	},
	setAlbumPhotos: (albumId, photoIds) => {
		set(state => ({
			library: {
				...state.library,
				albums: state.library.albums.map(album => {
					if (album.id !== albumId) return album
					const nextIds = [...new Set(photoIds)]
					const coverStillValid = album.coverPhotoId && nextIds.includes(album.coverPhotoId)
					return {
						...album,
						photoIds: nextIds,
						coverPhotoId: coverStillValid ? album.coverPhotoId : nextIds[0]
					}
				})
			}
		}))
	},
	removeFromAlbum: (albumId, photoId) => {
		set(state => ({
			library: {
				...state.library,
				albums: state.library.albums.map(album => {
					if (album.id !== albumId) return album
					const nextIds = album.photoIds.filter(id => id !== photoId)
					const coverStillValid = album.coverPhotoId && nextIds.includes(album.coverPhotoId)
					return {
						...album,
						photoIds: nextIds,
						coverPhotoId: coverStillValid ? album.coverPhotoId : nextIds[0]
					}
				})
			}
		}))
	},
	setCover: (albumId, photoId) => {
		set(state => ({
			library: {
				...state.library,
				albums: state.library.albums.map(album => (album.id === albumId ? { ...album, coverPhotoId: photoId } : album))
			}
		}))
	},
	cancelEdits: () => {
		const { imageItems, originalLibrary } = get()
		revokeItems(imageItems)
		set({
			library: cloneLibrary(originalLibrary),
			imageItems: new Map(),
			isEditMode: false
		})
	},
	markSaved: saved => {
		const { imageItems } = get()
		const next = cloneLibrary(saved)
		set({
			library: next,
			originalLibrary: cloneLibrary(next),
			imageItems: new Map(),
			isEditMode: false
		})
		revokeItems(imageItems)
	}
}))
