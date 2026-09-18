'use client'

import { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

interface RangeSliderProps {
	id?: string
	min: number
	max: number
	step: number
	value: number
	disabled?: boolean
	'aria-label'?: string
	className?: string
	onValueChange: (value: number) => void
}

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n))
}

export function RangeSlider({ id, min, max, step, value, disabled, className, onValueChange, 'aria-label': ariaLabel }: RangeSliderProps) {
	const trackRef = useRef<HTMLDivElement>(null)

	const valueFromClientX = useCallback(
		(clientX: number) => {
			const track = trackRef.current
			if (!track) return value
			const rect = track.getBoundingClientRect()
			const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
			const raw = min + clamp(ratio, 0, 1) * (max - min)
			const snapped = min + Math.round((raw - min) / step) * step
			return clamp(Number(snapped.toFixed(4)), min, max)
		},
		[min, max, step, value]
	)

	const setFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		if (disabled) return
		onValueChange(valueFromClientX(event.clientX))
	}

	const percent = max === min ? 0 : ((value - min) / (max - min)) * 100

	return (
		<div
			ref={trackRef}
			id={id}
			role='slider'
			aria-label={ariaLabel}
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuenow={value}
			aria-disabled={disabled || undefined}
			tabIndex={disabled ? -1 : 0}
			className={cn('relative h-5 w-full cursor-pointer touch-none select-none', disabled && 'pointer-events-none opacity-50', className)}
			onPointerDown={event => {
				event.preventDefault()
				event.stopPropagation()
				setFromPointer(event)
				try {
					event.currentTarget.setPointerCapture(event.pointerId)
				} catch {
					/* synthetic / automation pointers may not support capture */
				}
			}}
			onPointerMove={event => {
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
				event.preventDefault()
				setFromPointer(event)
			}}
			onPointerUp={event => {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId)
				}
			}}
			onKeyDown={event => {
				if (disabled) return
				if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
					event.preventDefault()
					onValueChange(clamp(Number((value - step).toFixed(4)), min, max))
				}
				if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
					event.preventDefault()
					onValueChange(clamp(Number((value + step).toFixed(4)), min, max))
				}
			}}>
			<div
				className='absolute inset-x-0 top-[7px] h-1.5 rounded-full'
				style={{
					background: 'linear-gradient(90deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-brand) 50%, transparent) 100%)'
				}}
			/>
			<div
				className='absolute top-[2px] h-4 w-4 rounded-full border-2 border-white'
				style={{
					left: `calc(${percent}% - 8px)`,
					background: 'var(--color-brand)',
					boxShadow: '0 5px 12px color-mix(in srgb, var(--color-brand) 50%, transparent)'
				}}
			/>
		</div>
	)
}
