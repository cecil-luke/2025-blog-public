type ModelConfig = {
	model?: string
	textures?: string[]
	physics?: string
	pose?: string
	motions?: Record<string, Array<{ file?: string }>>
}

const preloadCache = new Map<string, Promise<void>>()

function collectModelFiles(config: ModelConfig): string[] {
	const idleFiles = config.motions?.idle?.map(motion => motion.file).filter((file): file is string => typeof file === 'string') ?? []
	return [config.model, ...(config.textures ?? []), config.physics, config.pose, ...idleFiles].filter((file): file is string => typeof file === 'string')
}

/** 预加载模型首帧所需资源，后续切换可优先命中浏览器缓存。 */
export function preloadModel(path: string): Promise<void> {
	const cached = preloadCache.get(path)
	if (cached) return cached

	const task = fetch(path)
		.then(response => {
			if (!response.ok) throw new Error(`Failed to preload model config: ${response.status} ${path}`)
			return response.json() as Promise<ModelConfig>
		})
		.then(config => {
			const basePath = path.slice(0, path.lastIndexOf('/') + 1)
			return Promise.all(collectModelFiles(config).map(file => fetch(`${basePath}${file}`)))
		})
		.then(() => undefined)
		.catch(error => {
			preloadCache.delete(path)
			throw error
		})

	preloadCache.set(path, task)
	return task
}
