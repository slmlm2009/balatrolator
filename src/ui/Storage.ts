import { deminify, minify } from './minifier.ts'
import type { State } from '#lib/types.ts'

export const WebStorage = {
	get (key: string): string | null {
		try {
			return window.localStorage.getItem(key)
		} catch (error) {
			console.error(`Failed to read “${key}” from storage.`, error)
			return null
		}
	},

	set (key: string, value: string) {
		try {
			window.localStorage.setItem(key, value)
		} catch (error) {
			console.error(`Failed to store “${key}”.`, error)
		}
	},

	remove (key: string) {
		try {
			window.localStorage.removeItem(key)
		} catch (error) {
			console.error(`Failed to remove “${key}” from storage.`, error)
		}
	},
}

export function readStateFromUrl (): State | null {
	const urlParams = new URLSearchParams(window.location.search)
	const minified = urlParams.get('state')

	return minified ? deminify(minified) : null
}

export function saveStateToUrl (state: State) {
	const urlParams = new URLSearchParams(window.location.search)
	const minified = minify(state)
	urlParams.set('state', minified)

	// Use replaceState (not pushState): the URL mirrors the live hand, so each edit should update the
	// current entry rather than pushing a new one. pushState here grows the history stack unbounded,
	// which progressively slows the page and breaks the back button.
	window.history.replaceState({}, '', `?${urlParams.toString()}`)
}
