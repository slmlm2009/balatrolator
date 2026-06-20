/*
Lightweight presentation animations using the native Web Animations API.

Previously these used GSAP loaded from a CDN, which added network + parse + init cost (felt as a
first-interaction hang on mobile) for a few simple pops/flashes the browser can do natively.
`element.animate()` has zero load cost and runs on the compositor. These are purely visual and never
touch the scoring engine.
*/

const prefersReducedMotion = typeof window.matchMedia === 'function'
	&& window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Kept for API compatibility with main.ts; WAAPI needs no setup.
export function initAnimations (): void {}

/** Pops a freshly added joker/playing card into place. */
export function animateCardEntrance (element: HTMLElement): void {
	if (prefersReducedMotion) {
		return
	}

	element.animate(
		[
			{ opacity: 0, transform: 'translateY(16px) scale(0.9)' },
			{ opacity: 1, transform: 'none' },
		],
		{ duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
	)
}

/** Lifts/drops a playing card as its “played” state toggles. */
export function animatePlayToggle (element: HTMLElement, played: boolean): void {
	if (prefersReducedMotion) {
		return
	}

	element.animate(
		[
			{ transform: `scale(${played ? 0.95 : 1.04})` },
			{ transform: 'scale(1)' },
		],
		{ duration: 280, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
	)
}

/** Pulses the scoreboard's chips/mult boxes and flashes the total on each update. */
export function animateScoreboard (scoreboard: HTMLElement): void {
	if (prefersReducedMotion) {
		return
	}

	for (const box of scoreboard.querySelectorAll<HTMLElement>('.sb-box')) {
		box.animate(
			[{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }],
			{ duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
		)
	}

	const total = scoreboard.querySelector<HTMLElement>('.sb-total-value')
	total?.animate(
		[{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }],
		{ duration: 300, easing: 'ease-out' },
	)
}
