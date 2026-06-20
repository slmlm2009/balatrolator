/*
Runtime loader for SortableJS (desktop drag-and-drop only).

It's injected dynamically from a pinned ESM CDN rather than bundled, and loaded lazily/only on
fine-pointer devices, so it never adds cost to mobile first paint/interaction. If the CDN is
unreachable, drag-and-drop is simply disabled (keyboard/button reordering still works).

Animations use the native Web Animations API and the theme is hand-written CSS, so no other runtime
libraries are loaded.
*/

const SORTABLE_URL = 'https://esm.sh/sortablejs@1.15.2'

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

let sortablePromise: Promise<SortableConstructor | null> | undefined

/**
 * Dynamically imports SortableJS. Resolves to `null` if the CDN is unreachable.
 */
export function loadSortable (): Promise<SortableConstructor | null> {
	if (!sortablePromise) {
		// The URL is stored in a variable so TypeScript treats this as a dynamic `Promise<any>`
		// import rather than trying (and failing) to resolve the module at build time.
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
