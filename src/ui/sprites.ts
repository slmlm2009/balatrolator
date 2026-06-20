/*
Pure data → sprite-URL helpers.

This module is presentation-only and DOM-free: every function maps plain data values (a rank, a
suit, a joker name, …) to the URL of the matching Balatro pixel-art asset. It never reads the DOM
and never touches the scoring engine, preserving the strict data/UI separation.

Asset URLs are returned relative to the document so they resolve correctly whether the app is served
from the domain root (balatrolator.com) or a project sub-path (GitHub Pages). Folder/file names with
spaces are URL-encoded; the card art is meant to be rendered with `image-rendering: pixelated`.
*/

import type { DeckName, Edition, Enhancement, JokerName, Rank, Seal, Suit } from '#lib/types.ts'

const CARD_SPRITES = 'assets/1 - Card Sprites'
const OTHER_SPRITES = 'assets/2 - Other Sprites'
// Playing-card art is served from down-scaled copies (see assets/optimized): the originals are
// ~1-megapixel upscaled pixel art, which is huge GPU-texture memory for an ~80px display and causes
// scroll/interaction jank on phones. The optimized copies are ~193×256 and visually identical.
const OPTIMIZED_CARDS = 'assets/optimized/DECK CARDS'

/** Maps a rank to the token used in playing-card sprite filenames (e.g. `Ace` → `A`). */
const RANK_FILE_TOKEN: Record<Rank, string> = {
	'Ace': 'A',
	'King': 'K',
	'Queen': 'Q',
	'Jack': 'J',
	'10': '10',
	'9': '9',
	'8': '8',
	'7': '7',
	'6': '6',
	'5': '5',
	'4': '4',
	'3': '3',
	'2': '2',
}

/**
 * Maps an enhancement to its sprite sub-folder. `Stone` has no rank/suit art (handled separately by
 * the caller), and `None` falls back to the plain `BASIC` card face.
 */
const ENHANCEMENT_FOLDER: Record<Exclude<Enhancement, 'Stone'>, string> = {
	'None': 'BASIC',
	'Bonus': 'BONUS',
	'Mult': 'MULT',
	'Wild': 'WILD',
	'Glass': 'GLASS',
	'Steel': 'STEEL',
	'Gold': 'GOLD',
	'Lucky': 'LUCKY',
}

/** Joker names whose sprite filename differs from the canonical name (casing/spelling). */
const JOKER_FILE_OVERRIDES: Partial<Record<JokerName, string>> = {
	'Driver\'s license': 'Driver\'s License',
	'Mail-in Rebate': 'Mail-In Rebate',
	'Troubador': 'Troubadour',
}

/** The deck back filename differs from the deck name only for the Challenge Deck. */
const DECK_FILE_OVERRIDES: Partial<Record<DeckName, string>> = {
	'Challenge Deck': 'Challenge Decks',
}

function encode (path: string): string {
	return encodeURI(path)
}

/**
 * Returns the sprite URL for a playing card, or `null` when there is no rank/suit art to show
 * (e.g. `Stone` cards, which the UI renders with a styled fallback instead).
 */
export function getPlayingCardSprite (rank: Rank, suit: Suit, enhancement: Enhancement): string | null {
	if (enhancement === 'Stone') {
		return null
	}

	const folder = ENHANCEMENT_FOLDER[enhancement]
	const token = RANK_FILE_TOKEN[rank]
	return encode(`${OPTIMIZED_CARDS}/${folder}/${folder}-${suit.toUpperCase()}-${token}.png`)
}

/** Returns the sprite URL for a joker's art. */
export function getJokerSprite (name: JokerName): string {
	const file = JOKER_FILE_OVERRIDES[name] ?? name
	return encode(`${CARD_SPRITES}/JOKERS/${file}.png`)
}

/** Returns the seal overlay sprite URL, or `null` for `None`. */
export function getSealSprite (seal: Seal): string | null {
	if (seal === 'None') {
		return null
	}

	// "Unscaled" seals are ~73×97 vs the ~949×1261 "Scaled" ones — far cheaper to composite.
	return encode(`${OTHER_SPRITES}/CARD SEALS/Unscaled/${seal.toLowerCase()}_seal.png`)
}

/** Returns the deck back sprite URL. */
export function getDeckSprite (deck: DeckName): string {
	const file = DECK_FILE_OVERRIDES[deck] ?? deck
	return encode(`${CARD_SPRITES}/DECK BACKS/${file}.png`)
}

/**
 * Returns a CSS overlay (gradient/filter) approximating a card or joker edition's shine, applied on
 * top of the base pixel art. `Base` returns `null` (no overlay).
 */
export function getEditionOverlay (edition: Edition | 'Negative'): string | null {
	switch (edition) {
		case 'Foil':
			return 'linear-gradient(120deg, hsl(210 90% 70% / 0.55), hsl(280 90% 70% / 0.25) 40%, transparent 60%, hsl(190 90% 70% / 0.45))'
		case 'Holographic':
			return 'linear-gradient(120deg, hsl(0 90% 70% / 0.4), hsl(60 90% 70% / 0.4) 25%, hsl(140 90% 70% / 0.4) 50%, hsl(220 90% 70% / 0.4) 75%, hsl(300 90% 70% / 0.4))'
		case 'Polychrome':
			return 'linear-gradient(120deg, hsl(0 95% 65% / 0.5), hsl(45 95% 65% / 0.5) 20%, hsl(140 95% 60% / 0.5) 45%, hsl(200 95% 65% / 0.5) 70%, hsl(320 95% 65% / 0.5))'
		case 'Negative':
			return 'linear-gradient(120deg, hsl(260 90% 30% / 0.7), hsl(190 90% 30% / 0.7))'
		default:
			return null
	}
}
