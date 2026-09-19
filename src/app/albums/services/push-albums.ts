import {
	toBase64Utf8,
	getRef,
	createTree,
	createCommit,
	updateRef,
	createBlob,
	readTextFileFromRepo,
	withGitFastForwardRetry,
	type TreeItem
} from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem } from '../../projects/components/image-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { originalRepoPath, thumbRepoPath } from '../components/album-thumb'
import { toast } from 'sonner'
import type { AlbumLibrary } from '../types'
import { cloneLibrary } from '../library-utils'

export type PushAlbumsProgress = {
	phase: 'prepare' | 'upload' | 'commit'
	current: number
	total: number
	message: string
}

export type PushAlbumsParams = {
	library: AlbumLibrary
	imageItems?: Map<string, ImageItem>
	onProgress?: (progress: PushAlbumsProgress) => void
}

function assertNoBlobMediaUrls(urls: string[]): void {
	if (urls.some(url => url.startsWith('blob:'))) {
		throw new Error('保存中止：仍有未上传的本地预览地址（blob:）')
	}
}

export async function pushAlbums(params: PushAlbumsParams): Promise<AlbumLibrary> {
	return withGitFastForwardRetry(() => pushAlbumsOnce(params), {
		onRetry: attempt => toast.info(`仓库刚有更新，正在重试保存（${attempt}/3）...`)
	})
}

async function pushAlbumsOnce(params: PushAlbumsParams): Promise<AlbumLibrary> {
	const { imageItems, onProgress } = params
	const library = cloneLibrary(params.library)

	const report = (progress: PushAlbumsProgress) => {
		onProgress?.(progress)
	}

	const token = await getAuthToken()

	report({ phase: 'prepare', current: 0, total: 1, message: '正在获取分支信息...' })
	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const commitMessage = `更新相册`

	const treeItems: TreeItem[] = []
	const uploadedHashes = new Set<string>()

	const fileEntries = [...(imageItems?.entries() ?? [])].filter(
		([photoId, imageItem]) => imageItem.type === 'file' && library.photos.some(photo => photo.id === photoId)
	)

	if (fileEntries.length > 0) {
		let uploaded = 0
		for (const [photoId, imageItem] of fileEntries) {
			if (imageItem.type !== 'file') continue
			uploaded += 1
			report({
				phase: 'upload',
				current: uploaded,
				total: fileEntries.length,
				message: `正在上传图片 ${uploaded} / ${fileEntries.length}`
			})

			const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
			const ext = getFileExt(imageItem.file.name)
			const filename = `${hash}${ext}`
			const publicPath = `/images/albums/${filename}`

			if (!uploadedHashes.has(hash)) {
				const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
				const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
				treeItems.push({
					path: `public/images/albums/${filename}`,
					mode: '100644',
					type: 'blob',
					sha: blobData.sha
				})
				uploadedHashes.add(hash)

				if (imageItem.thumbFile) {
					const thumbBase64 = await fileToBase64NoPrefix(imageItem.thumbFile)
					const thumbBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, thumbBase64, 'base64')
					treeItems.push({
						path: `public/images/albums/sm/${hash}.webp`,
						mode: '100644',
						type: 'blob',
						sha: thumbBlob.sha
					})
				}
			}

			library.photos = library.photos.map(photo => (photo.id === photoId ? { ...photo, url: publicPath } : photo))
		}
	}

	assertNoBlobMediaUrls(library.photos.map(photo => photo.url))

	report({ phase: 'commit', current: 0, total: 3, message: '正在检查需要删除的文件...' })
	const currentImageUrls = new Set(library.photos.map(photo => photo.url).filter(url => url.startsWith('/images/albums/')))
	const previousLibraryJson = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'src/app/albums/library.json', GITHUB_CONFIG.BRANCH)

	if (previousLibraryJson) {
		try {
			const previousLibrary: AlbumLibrary = JSON.parse(previousLibraryJson)
			for (const photo of previousLibrary.photos || []) {
				if (!photo.url?.startsWith('/images/albums/') || currentImageUrls.has(photo.url)) continue
				const originalPath = originalRepoPath(photo.url)
				if (originalPath) {
					treeItems.push({
						path: originalPath,
						mode: '100644',
						type: 'blob',
						sha: null
					})
				}
				const thumbPath = thumbRepoPath(photo.url)
				if (thumbPath) {
					treeItems.push({
						path: thumbPath,
						mode: '100644',
						type: 'blob',
						sha: null
					})
				}
			}
		} catch (error) {
			console.error('Failed to parse previous library.json:', error)
		}
	}

	const libraryJson = JSON.stringify(library, null, '\t') + '\n'
	const libraryBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(libraryJson), 'base64')
	treeItems.push({
		path: 'src/app/albums/library.json',
		mode: '100644',
		type: 'blob',
		sha: libraryBlob.sha
	})

	report({ phase: 'commit', current: 1, total: 3, message: '正在创建文件树...' })
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	report({ phase: 'commit', current: 2, total: 3, message: '正在创建提交...' })
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	report({ phase: 'commit', current: 3, total: 3, message: '正在更新分支...' })
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('发布成功！')
	return library
}
