/*
Runtime loaders for the third-party UI libraries used by the modernized interface.

These are injected dynamically at runtime (rather than bundled) so that:
- The vanilla TypeScript core stays framework-free and the Vite single-file build is unaffected.
- The calculator core keeps working even if a library fails to load (graceful degradation).

Everything here is presentation-only. None of it touches the scoring engine in `src/lib`.
*/

// Tilt/animation libraries are pulled from a pinned ESM CDN. Tailwind uses its Play CDN script.
const GSAP_URL = 'https://esm.sh/gsap@3.12.5'
const SORTABLE_URL = 'https://esm.sh/sortablejs@1.15.2'
const TAILWIND_URL = 'https://cdn.tailwindcss.com?plugins='

/**
 * Minimal structural type for the slice of the GSAP API the UI uses.
 * Hand-written so we don't need the npm package available at type-check time.
 */
export interface Gsap {
	to (targets: unknown, vars: Record<string, unknown>): unknown
	from (targets: unknown, vars: Record<string, unknown>): unknown
	fromTo (targets: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>): unknown
	set (targets: unknown, vars: Record<string, unknown>): unknown
	timeline (vars?: Record<string, unknown>): GsapTimeline
}

export interface GsapTimeline {
	to (targets: unknown, vars: Record<string, unknown>, position?: number | string): GsapTimeline
	from (targets: unknown, vars: Record<string, unknown>, position?: number | string): GsapTimeline
	fromTo (targets: unknown, fromVars: Record<string, unknown>, toVars: Record<string, unknown>, position?: number | string): GsapTimeline
}

export interface SortableOptions {
	animation?: number
	handle?: string
	filter?: string
	preventOnFilter?: boolean
	draggable?: string
	ghostClass?: string
	chosenClass?: string
	dragClass?: string
	easing?: string
	delay?: number
	delayOnTouchOnly?: boolean
	forceFallback?: boolean
	onEnd?: (event: { oldIndex?: number, newIndex?: number }) => void
	onStart?: (event: unknown) => void
}

export interface SortableConstructor {
	new (element: HTMLElement, options?: SortableOptions): unknown
	create (element: HTMLElement, options?: SortableOptions): unknown
}

let gsapPromise: Promise<Gsap | null> | undefined
let sortablePromise: Promise<SortableConstructor | null> | undefined
let tailwindPromise: Promise<void> | undefined

/**
 * Dynamically imports GSAP. Resolves to `null` if the CDN is unreachable so callers can no-op.
 */
export function loadGsap (): Promise<Gsap | null> {
	if (!gsapPromise) {
		// The URL is stored in a variable so TypeScript treats this as a dynamic `Promise<any>`
		// import rather than trying (and failing) to resolve the module at build time.
		const url = GSAP_URL
		gsapPromise = import(/* @vite-ignore */ url)
			.then((module) => (module.gsap ?? module.default ?? module) as Gsap)
			.catch((error) => {
				console.warn('Could not load GSAP; animations are disabled.', error)
				return null
			})
	}

	return gsapPromise
}

/**
 * Dynamically imports SortableJS. Resolves to `null` if the CDN is unreachable.
 * Drag-and-drop then falls back to the built-in keyboard/button reordering.
 */
export function loadSortable (): Promise<SortableConstructor | null> {
	if (!sortablePromise) {
		const url = SORTABLE_URL
		sortablePromise = import(/* @vite-ignore */ url)
			.then((module) => (module.default ?? module) as SortableConstructor)
			.catch((error) => {
				console.warn('Could not load SortableJS; drag-and-drop is disabled.', error)
				return null
			})
	}

	return sortablePromise
}

/**
 * Injects the Tailwind Play CDN script. Tailwind is additive: the app is fully laid out by its
 * own CSS, so a failure here only removes a few utility-class flourishes.
 */
export function loadTailwind (): Promise<void> {
	if (!tailwindPromise) {
		tailwindPromise = new Promise<void>((resolve) => {
			// Provide the config before the script runs so it's picked up on initialization.
			;(window as unknown as { tailwind?: { config?: unknown } }).tailwind = {
				config: {
					corePlugins: { preflight: false },
					theme: {
						extend: {
							fontFamily: {
								mono: ['Fira Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
							},
						},
					},
				},
			}

			const script = document.createElement('script')
			script.src = TAILWIND_URL
			script.addEventListener('load', () => resolve())
			script.addEventListener('error', () => {
				console.warn('Could not load Tailwind CDN; utility classes are disabled.')
				resolve()
			})
			document.head.appendChild(script)
		})
	}

	return tailwindPromise
}
