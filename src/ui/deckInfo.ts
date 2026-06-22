/*
Loads Balatro deck reference data (assets/decks_balatrowiki.json) so the round-bar can show what
each deck does when selected. Fetched once and cached. Lookup is case-insensitive.
*/

export interface DeckInfo {
	name: string
	effect: string
}

let infoByName: Map<string, DeckInfo> | null = null
let loadPromise: Promise<void> | undefined

interface RawDeck {
	name?: string
	effect?: string
}

function load (): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetch('assets/decks_balatrowiki.json')
			.then((response) => response.json())
			.then((data: RawDeck[]) => {
				infoByName = new Map()
				for (const entry of data) {
					if (!entry.name) continue
					infoByName.set(entry.name.toLowerCase(), {
						name: entry.name,
						effect: entry.effect ?? '',
					})
				}
			})
			.catch((error) => {
				console.warn('Could not load deck reference data.', error)
				infoByName = new Map()
			})
	}

	return loadPromise
}

/** Returns the deck's reference info if loaded, otherwise `undefined`. */
export function getDeckInfo (name: string): DeckInfo | undefined {
	return infoByName?.get(name.toLowerCase())
}

/** Ensures the data is loaded, then invokes `callback` (e.g. to update the description panel). */
export function whenDeckInfoReady (callback: () => void): void {
	void load().then(callback)
}
