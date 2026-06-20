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

/** Reveals the score result cards with a staggered pop and flashes the headline score values. */
export function animateScoreReveal (container: HTMLElement): void {
	if (!gsap) {
		return
	}

	const cards = container.querySelectorAll('.score-card')
	if (cards.length === 0) {
		return
	}

	gsap.fromTo(cards,
		{ opacity: 0, scale: 0.8, y: 12 },
		{ opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2)', stagger: 0.08, clearProps: 'opacity,scale' },
	)

	const headlineScores = container.querySelectorAll('[data-sc-formatted-score]')
	gsap.fromTo(headlineScores,
		{ '--score-flash': 1, scale: 1.18 },
		{ '--score-flash': 0, scale: 1, duration: 0.6, ease: 'power2.out', stagger: 0.08, clearProps: 'scale' },
	)
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
