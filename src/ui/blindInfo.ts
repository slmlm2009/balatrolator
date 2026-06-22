/*
Loads Balatro boss blind reference data (assets/blinds_balatrowiki.json) so the round-bar can show
what each blind does when selected. Fetched once and cached. Lookup is case-insensitive.
*/

export interface BlindInfo {
	name: string
	effect: string
}

let infoByName: Map<string, BlindInfo> | null = null
let loadPromise: Promise<void> | undefined

interface RawBlind {
	name?: string
	effect?: string
}

function load (): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetch('assets/blinds_balatrowiki.json')
			.then((response) => response.json())
			.then((data: RawBlind[]) => {
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
				console.warn('Could not load blind reference data.', error)
				infoByName = new Map()
			})
	}

	return loadPromise
}

/** Returns the blind's reference info if loaded, otherwise `undefined`. */
export function getBlindInfo (name: string): BlindInfo | undefined {
	return infoByName?.get(name.toLowerCase())
}

/** Ensures the data is loaded, then invokes `callback` (e.g. to update the description panel). */
export function whenBlindInfoReady (callback: () => void): void {
	void load().then(callback)
}
