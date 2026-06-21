/*
Loads the Balatro joker reference data (assets/joker_data.json) so joker cards can show their
real in-game properties (rarity, cost, effect) — like the game's hover tooltip.

Fetched once and cached. Lookups are case-insensitive so minor name-casing differences between the
calculator's JokerName values and the wiki data still match. Purely presentational.
*/

export interface JokerInfo {
	name: string
	rarity: string
	cost: string
	effect: string
}

let infoByName: Map<string, JokerInfo> | null = null
let loadPromise: Promise<void> | undefined

interface RawJoker {
	Name?: string
	Rarity?: string
	Cost?: string
	Effect?: string
}

function load (): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetch('assets/joker_data.json')
			.then((response) => response.json())
			.then((data: RawJoker[]) => {
				infoByName = new Map()
				for (const entry of data) {
					if (!entry.Name) {
						continue
					}
					infoByName.set(entry.Name.toLowerCase(), {
						name: entry.Name,
						rarity: entry.Rarity ?? '',
						cost: entry.Cost ?? '',
						effect: entry.Effect ?? '',
					})
				}
			})
			.catch((error) => {
				console.warn('Could not load joker reference data.', error)
				infoByName = new Map()
			})
	}

	return loadPromise
}

/** Returns the joker's reference info if loaded, otherwise `undefined`. */
export function getJokerInfo (name: string): JokerInfo | undefined {
	return infoByName?.get(name.toLowerCase())
}

/** Ensures the data is loaded, then invokes `callback` (e.g. to re-render once available). */
export function whenJokerInfoReady (callback: () => void): void {
	void load().then(callback)
}
