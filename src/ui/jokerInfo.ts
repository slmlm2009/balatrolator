/*
Loads the Balatro joker reference data (assets/jokers_balatrowiki.json) so joker cards can show
their real in-game properties (rarity, cost, effect) — like the game's hover tooltip.

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

/*
The scoring engine's JokerName values occasionally differ from the wiki data's spelling. Map those
engine names (lowercased) to their wiki-data equivalents so tooltips still resolve. We alias here
rather than renaming in data.ts because JokerName is baked into saved `?state=` URLs (the minifier
is name/order-sensitive), so renaming would break old saved hands. Keep in sync with data.ts.
*/
const NAME_ALIASES: Record<string, string> = {
	troubador: 'troubadour',
}

interface RawJoker {
	name?: string
	rarity?: string
	cost?: string
	effect?: string
}

function load (): Promise<void> {
	if (!loadPromise) {
		loadPromise = fetch('assets/jokers_balatrowiki.json')
			.then((response) => response.json())
			.then((data: RawJoker[]) => {
				infoByName = new Map()
				for (const entry of data) {
					if (!entry.name) {
						continue
					}
					infoByName.set(entry.name.toLowerCase(), {
						name: entry.name,
						rarity: entry.rarity ?? '',
						cost: entry.cost ?? '',
						effect: entry.effect ?? '',
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
	const key = name.toLowerCase()
	return infoByName?.get(NAME_ALIASES[key] ?? key)
}

/** Ensures the data is loaded, then invokes `callback` (e.g. to re-render once available). */
export function whenJokerInfoReady (callback: () => void): void {
	void load().then(callback)
}
