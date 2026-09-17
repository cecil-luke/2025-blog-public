export interface AlbumPhoto {
	id: string
	url: string
	uploadedAt: string
	takenAt?: string
	caption?: string
}

export interface NamedAlbum {
	id: string
	slug: string
	title: string
	description?: string
	coverPhotoId?: string
	createdAt: string
	photoIds: string[]
}

export interface AlbumLibrary {
	photos: AlbumPhoto[]
	albums: NamedAlbum[]
}
