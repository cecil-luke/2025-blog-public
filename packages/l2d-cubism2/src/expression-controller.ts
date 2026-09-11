import type { ModelState } from './motion-controller'
import logger from './logger'

export class ExpressionController {
	constructor(private state: ModelState) {}

	private isReady(method: string): boolean {
		if (!this.state.l2d2Model) {
			logger.warn(`${method}: model not loaded yet, call this after the loaded event.`)
			return false
		}
		return true
	}

	getExpressions(): string[] {
		if (!this.isReady('getExpressions')) return []
		return this.state.l2d2Model!.getExpressions()
	}

	setExpression(id?: string) {
		if (!this.isReady('setExpression')) return
		this.state.l2d2Model!.setExpression(id)
	}
}
