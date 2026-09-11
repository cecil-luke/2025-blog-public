import type Cubism2Model from './vendor/cubism2/index'
import logger from './logger'

export interface ModelState {
	l2d2Model: Cubism2Model | null
}

export class MotionController {
	constructor(private state: ModelState) {}

	private isReady(method: string): boolean {
		if (!this.state.l2d2Model) {
			logger.warn(`${method}: model not loaded yet, call this after the loaded event.`)
			return false
		}
		return true
	}

	playMotion(group: string, index?: number, priority?: number) {
		if (!this.isReady('playMotion')) return
		const groups = this.getMotionGroups()
		const count = groups[group]
		if (typeof count !== 'number') {
			logger.warn(`playMotion: motion group "${group}" not found.`)
			return
		}
		if (typeof index === 'number' && (index < 0 || index >= count)) {
			logger.warn(`playMotion: motion index ${index} out of range for group "${group}" (0-${count - 1}).`)
			return
		}
		this.state.l2d2Model!.playMotion(group, index, priority)
	}

	getMotionGroups(): Record<string, number> {
		if (!this.isReady('getMotionGroups')) return {}
		return this.state.l2d2Model!.getMotionGroups()
	}

	getMotions(): Record<string, string[]> {
		if (!this.isReady('getMotions')) return {}
		return this.state.l2d2Model!.getMotionFiles()
	}

	playMotionByFile(file: string, priority?: number) {
		const motionFiles = this.getMotions()
		for (const [group, files] of Object.entries(motionFiles)) {
			const index = files.findIndex(f => f === file || f.startsWith(`${file}.`))
			if (index !== -1) {
				this.playMotion(group, index, priority)
				return
			}
		}
		logger.warn(`playMotionByFile: motion file "${file}" not found.`)
	}
}
