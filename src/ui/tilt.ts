/*
High-frequency 3D tilt interaction.

Per the GPU-optimization guardrail, continuous pointer movement updates **inline CSS custom
properties** only (`--tilt-rx`, `--tilt-ry`, and a `--pointer-x/--pointer-y` glare position). The
actual transform/glare lives in CSS, so the browser stays on the compositor and we never trigger a
JS-driven layout/paint loop. The element's bounding rect is read once on pointer-enter and cached for
the duration of the interaction, avoiding layout reads on every move.

This module is purely visual and does not interact with the scoring engine.
*/

const MAX_TILT_DEGREES = 10

const prefersReducedMotion = typeof window.matchMedia === 'function'
	&& window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Wires pointer-driven 3D tilt onto `element`. Returns a cleanup function that removes the
 * listeners. No-ops (returns a cleanup that does nothing) when reduced motion is preferred.
 */
export function applyTilt (element: HTMLElement): () => void {
	if (prefersReducedMotion) {
		return () => {}
	}

	let rect: DOMRect | null = null
	let frame = 0
	let nextX = 0
	let nextY = 0

	const commit = () => {
		frame = 0
		// Rotate around the axis perpendicular to the pointer offset.
		const rotateY = (nextX - 0.5) * 2 * MAX_TILT_DEGREES
		const rotateX = -(nextY - 0.5) * 2 * MAX_TILT_DEGREES
		element.style.setProperty('--tilt-ry', `${rotateY.toFixed(2)}deg`)
		element.style.setProperty('--tilt-rx', `${rotateX.toFixed(2)}deg`)
		element.style.setProperty('--pointer-x', `${(nextX * 100).toFixed(1)}%`)
		element.style.setProperty('--pointer-y', `${(nextY * 100).toFixed(1)}%`)
	}

	const handlePointerEnter = () => {
		// Cache the rect once so per-move handling never forces a layout read.
		rect = element.getBoundingClientRect()
		element.style.setProperty('--tilt-active', '1')
	}

	const handlePointerMove = (event: PointerEvent) => {
		if (!rect) {
			rect = element.getBoundingClientRect()
		}

		nextX = clamp((event.clientX - rect.left) / rect.width)
		nextY = clamp((event.clientY - rect.top) / rect.height)

		// Coalesce updates to one write per animation frame.
		if (frame === 0) {
			frame = requestAnimationFrame(commit)
		}
	}

	const handlePointerLeave = () => {
		rect = null
		if (frame !== 0) {
			cancelAnimationFrame(frame)
			frame = 0
		}
		element.style.setProperty('--tilt-active', '0')
		element.style.setProperty('--tilt-rx', '0deg')
		element.style.setProperty('--tilt-ry', '0deg')
	}

	element.addEventListener('pointerenter', handlePointerEnter)
	element.addEventListener('pointermove', handlePointerMove)
	element.addEventListener('pointerleave', handlePointerLeave)
	element.addEventListener('pointercancel', handlePointerLeave)

	return () => {
		element.removeEventListener('pointerenter', handlePointerEnter)
		element.removeEventListener('pointermove', handlePointerMove)
		element.removeEventListener('pointerleave', handlePointerLeave)
		element.removeEventListener('pointercancel', handlePointerLeave)
	}
}

function clamp (value: number): number {
	return Math.min(1, Math.max(0, value))
}
