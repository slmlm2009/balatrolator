/*
GSAP-powered presentation animations.

GSAP is loaded lazily via the runtime CDN loader. Until it resolves (or if it fails to load), every
helper here is a no-op, so animations never block or break the calculator. These functions only
animate transform/opacity/CSS-variable properties — they never read or mutate scoring data.
*/

import { loadGsap, type Gsap } from './vendor.ts'

let gsap: Gsap | null = null

const prefersReducedMotion = typeof window.matchMedia === 'function'
	&& window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Kicks off loading GSAP and caches the instance for synchronous use by the helpers below. */
export function initAnimations (): void {
	if (prefersReducedMotion) {
		return
	}

	void loadGsap().then((instance) => {
		gsap = instance
	})
}

/** Pops a freshly added joker/playing card into place. */
export function animateCardEntrance (element: HTMLElement): void {
	if (!gsap) {
		return
	}

	gsap.fromTo(element,
		{ opacity: 0, y: 24, scale: 0.85 },
		{ opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.7)', clearProps: 'opacity,scale' },
	)
}

/** Lifts/drops a playing card as its “played” state toggles. */
export function animatePlayToggle (element: HTMLElement, played: boolean): void {
	if (!gsap) {
		return
	}

	gsap.fromTo(element,
		{ scale: played ? 0.96 : 1.04 },
		{ scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.6)', clearProps: 'scale' },
	)
}

/** Pulses the Balatro scoreboard: the chips/mult boxes pop and the total flashes on each update. */
export function animateScoreboard (scoreboard: HTMLElement): void {
	if (!gsap) {
		return
	}

	const boxes = scoreboard.querySelectorAll('.sb-box')
	gsap.fromTo(boxes,
		{ scale: 0.82 },
		{ scale: 1, duration: 0.4, ease: 'back.out(2.4)', stagger: 0.06, clearProps: 'scale' },
	)

	const total = scoreboard.querySelector('.sb-total-value')
	if (total) {
		gsap.fromTo(total,
			{ '--score-flash': 1, scale: 1.16 },
			{ '--score-flash': 0, scale: 1, duration: 0.55, ease: 'power2.out', clearProps: 'scale' },
		)
	}
}

/** Subtle shake to signal an invalid input / failed calculation. */
export function animateInvalid (element: HTMLElement): void {
	if (!gsap) {
		return
	}

	gsap.fromTo(element,
		{ x: -6 },
		{ x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)', clearProps: 'x' },
	)
}
