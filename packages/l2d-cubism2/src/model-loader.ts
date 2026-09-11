import type { ModelState } from './motion-controller'
import type { Options } from './types'
import logger from './logger'
import { checkModelVersion } from './utils/model'
import Cubism2Model from './vendor/cubism2/index'

export interface LoadContext {
	canvas: HTMLCanvasElement
	state: ModelState
	resize: () => void
	emit: (event: 'loaded') => void
}

async function loadCubism2(ctx: LoadContext, canvas: HTMLCanvasElement, options: Options, result: unknown): Promise<void> {
	const model = new Cubism2Model(canvas)
	ctx.state.l2d2Model = model
	try {
		await model.init(canvas, options.path, result)
	} catch (e) {
		logger.error('Failed to initialize Cubism2 model.', e)
		return
	}
	if (options.position) model.setPosition(options.position[0], options.position[1])
	ctx.resize()
	if (typeof options.scale === 'number') model.setScale(options.scale)
	if (typeof options.volume === 'number') model.setVolume(options.volume)
	ctx.emit('loaded')
}

export async function loadModel(ctx: LoadContext, options: Options): Promise<void> {
	const { state } = ctx

	if (state.l2d2Model) {
		state.l2d2Model.destroy()
		state.l2d2Model = null
	}

	let res: Response
	try {
		res = await fetch(options.path)
	} catch (e) {
		logger.error(`Failed to fetch model config: ${options.path}`, e)
		return
	}
	if (!res.ok) {
		logger.error(`Failed to load model config: ${res.status} ${res.statusText} (${options.path})`)
		return
	}
	const result = await res.json()
	const version = checkModelVersion(result)

	if (version !== 2) {
		logger.error(`Only Cubism 2 models are supported: ${options.path}`)
		return
	}

	await loadCubism2(ctx, ctx.canvas, options, result)
}
