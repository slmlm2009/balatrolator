import { Decimal } from 'decimal.js'

import { RANK_TO_CHIP_MAP, LUCKS } from './data.ts'
import { balanceMultWithLuck } from './balanceMultWithLuck.ts'
import { formatScore } from './formatScore.ts'
import { isFaceCard, isRank } from './cards.ts'
import { resolveJoker } from './resolveJokers.ts'
import { doBigMath } from './doBigMath.ts'
import { getHand } from './getHand.ts'
import type { Card, HandName, Joker, Luck, Result, ScoreValue, State, JokerContribution } from './types.ts'

export function calculateScore (unresolvedState: State, options: { includeContributions?: boolean } = {}): {
	hand: HandName
	scoringCards: Card[]
	results: Result[]
} {
	// Per-joker contributions require a leave-one-out re-scoring of every joker (≈ N+2 full scoring
	// passes per luck mode), which is far more expensive than the score itself. Callers that only need
	// the score (e.g. the live UI on every keystroke) can skip it and compute it separately/later.
	const includeContributions = options.includeContributions ?? true
	// Create copies of jokers and cards based on their count.
	const state = {
		...unresolvedState,
		jokers: unresolvedState.jokers.flatMap((joker) => {
			return Array.from({ length: joker.count ?? 1 }, () => joker)
		}),
		cards: unresolvedState.cards.flatMap((card) => {
			return Array.from({ length: card.count ?? 1 }, () => card)
		}),
	}

	const playedCards = state.cards.filter((card) => card.played)
	const { playedHand, scoringCards: preliminaryScoringCards } = getHand(playedCards, state.jokerSet)
	const scoringCards = state.jokerSet.has('Splash') ? playedCards : preliminaryScoringCards

	const results = LUCKS.map<Result>((luck) => {
		const scoreValues = getScore(state, playedHand, scoringCards, luck)
		const { chips, multiplier, score, log } = doBigMath(scoreValues, state.deck)

		const jokerContributions = includeContributions ? calculateJokerContributions(state, playedHand, scoringCards, luck) : []

		return {
			chips,
			multiplier,
			score,
			formattedScore: formatScore(score),
			luck,
			log,
			jokerContributions,
		}
	})

	return {
		hand: playedHand,
		scoringCards,
		results,
	}
}

function calculateJokerContributions (state: State, playedHand: HandName, scoringCards: Card[], luck: Luck): JokerContribution[] {
	const activeJokers = state.jokers.filter((j) => j.active)
	if (activeJokers.length === 0) {
		return []
	}

	// `state.jokers` is already expanded by `count`, so a stacked joker shows up as several entries
	// sharing one `index`. Attribute the whole stack to a single distinct joker — removing it by index
	// drops every copy at once. Otherwise the stack would be counted once per copy and skew the shares.
	const seenIndices = new Set<number>()
	const distinctJokers = activeJokers.filter((joker) => {
		if (seenIndices.has(joker.index)) return false
		seenIndices.add(joker.index)
		return true
	})

	// All arithmetic stays in Decimal: endless-mode scores overflow JS floats, so a `parseFloat` on the
	// score strings would yield Infinity and the leave-one-out deltas would collapse to NaN. Only the
	// bounded 0–100 percentages are converted to Number.
	// playedHand/scoringCards are held fixed (computed with the full board), so a joker that changes
	// hand shape — Four Fingers, Splash — is measured only through its direct score effects.
	const scoreWith = (jokers: Joker[]) => new Decimal(doBigMath(getScore({ ...state, jokers }, playedHand, scoringCards, luck), state.deck).score)

	const totalScore = scoreWith(activeJokers)
	const deltas = distinctJokers.map((joker) => ({
		joker,
		scoreDelta: totalScore.minus(scoreWith(activeJokers.filter((j) => j.index !== joker.index))),
	}))
	const totalDelta = deltas.reduce((sum, d) => sum.plus(d.scoreDelta), new Decimal(0))

	const contributions: JokerContribution[] = deltas.map(({ joker, scoreDelta }) => ({
		jokerIndex: joker.index,
		jokerName: joker.name,
		dropPercentage: totalScore.isZero() ? 0 : scoreDelta.div(totalScore).times(100).toNumber(),
		// scoreDelta / Σ scoreDelta sums to 1, so the shares sum to ~100 (modulo per-value display
		// rounding) without any rescaling pass.
		sharePercentage: totalDelta.lessThanOrEqualTo(0) ? 0 : scoreDelta.div(totalDelta).times(100).toNumber(),
	}))

	return contributions.sort((a, b) => b.sharePercentage - a.sharePercentage)
}

function getScore (state: State, playedHand: HandName, scoringCards: Card[], luck: Luck): ScoreValue[] {
	const baseScore = state.handBaseScores[playedHand]

	const baseFactor = (state.blind.name === 'The Flint' && state.blind.active ? 0.5 : 1)
	const score: ScoreValue[] = []
	score.push(
		{
			chips: ['+', Math.round(baseScore.chips * baseFactor)],
			phase: 'base',
		},
		{
			multiplier: ['+', Math.round(baseScore.multiplier * baseFactor)],
			phase: 'base',
		},
	)

	for (const [index, card] of scoringCards.entries()) {
		for (const trigger of getPlayedCardTriggers({ state, card, index })) {
			if (card.enhancement === 'Stone') {
				score.push({
					chips: ['+', 50],
					phase: 'played-cards',
					card,
					type: 'enhancement',
					trigger,
				})
			}

			if (card.debuffed) {
				continue
			}

			if (card.enhancement !== 'Stone') {
				score.push({
					chips: ['+', RANK_TO_CHIP_MAP[card.rank]],
					phase: 'played-cards',
					card,
					type: 'rank',
					trigger,
				})
			}

			switch (card.enhancement) {
				case 'Bonus': {
					score.push({
						chips: ['+', 30],
						phase: 'played-cards',
						card,
						type: 'enhancement',
						trigger,
					})
					break
				}
				case 'Mult': {
					score.push({
						multiplier: ['+', 4],
						phase: 'played-cards',
						card,
						type: 'enhancement',
						trigger,
					})
					break
				}
				case 'Lucky': {
					const denominator = 5
					const plusMult = 20
					const oopses = state.jokers.filter(({ name }) => name === 'Oops! All 6s')
					const mult = balanceMultWithLuck(plusMult, oopses.length, denominator, luck, 'plus')

					score.push({
						multiplier: ['+', mult],
						phase: 'played-cards',
						card,
						type: 'enhancement',
						trigger,
					})
					break
				}
				case 'Glass': {
					score.push({
						multiplier: ['*', 2],
						phase: 'played-cards',
						card,
						type: 'enhancement',
						trigger,
					})
					break
				}
			}

			switch (card.edition) {
				case 'Foil': {
					score.push({
						chips: ['+', 50],
						phase: 'played-cards',
						card,
						type: 'edition',
						trigger,
					})
					break
				}
				case 'Holographic': {
					score.push({
						multiplier: ['+', 10],
						phase: 'played-cards',
						card,
						type: 'edition',
						trigger,
					})
					break
				}
				case 'Polychrome': {
					score.push({
						multiplier: ['*', 1.5],
						phase: 'played-cards',
						card,
						type: 'edition',
						trigger,
					})
					break
				}
			}

			for (const joker of state.jokers) {
				if (!joker.active) continue
				if (joker.playedCardEffect) {
					for (const trigger of getJokerTriggers({ state, joker })) {
						joker.playedCardEffect({ state, playedHand, scoringCards, score, card, luck, trigger })
					}
				}
			}
		}
	}

	for (const card of state.cards.filter(({ played }) => !played)) {
		if (card.debuffed) {
			continue
		}

		for (const trigger of getHeldCardTriggers({ state, card })) {
			switch (card.enhancement) {
				case 'Steel': {
					score.push({
						multiplier: ['*', 1.5],
						phase: 'held-cards',
						card,
						type: 'enhancement',
						trigger,
					})
					break
				}
			}

			for (const joker of state.jokers) {
				if (!joker.active) continue
				if (joker.heldCardEffect) {
					for (const trigger of getJokerTriggers({ state, joker })) {
						joker.heldCardEffect({ state, playedHand, scoringCards, score, card, luck, trigger })
					}
				}
			}
		}
	}

	for (const joker of state.jokers) {
		if (!joker.active) continue

		switch (joker.edition) {
			case 'Foil': {
				score.push({
					chips: ['+', 50],
					phase: 'jokers',
					joker,
					type: 'edition',
				})
				break
			}
			case 'Holographic': {
				score.push({
					multiplier: ['+', 10],
					phase: 'jokers', joker,
					type: 'edition',
				})
				break
			}
		}

		if (joker.effect) {
			joker.effect({ state, playedHand, scoringCards, score, luck, trigger: 'Regular' })
		}

		if (joker.indirectEffect) {
			for (const dependentJoker of state.jokers) {
				joker.indirectEffect({ state, playedHand, scoringCards, score, joker: dependentJoker, luck, trigger: 'Regular' })
			}
		}

		switch (joker.edition) {
			case 'Polychrome': {
				score.push({
					multiplier: ['*', 1.5],
					phase: 'jokers', joker,
					type: 'edition',
				})
				break
			}
		}
	}

	const planetCount = state.observatory[playedHand] ?? 0
	if (planetCount > 0) {
		score.push({
			multiplier: ['*', Math.pow(1.5, planetCount)],
			phase: 'consumables',
		})
	}

	return score
}

function getPlayedCardTriggers ({ state, card, index }: { state: State, card: Card, index: number }): string[] {
	const triggers = ['Regular']

	if (card.seal === 'Red') {
		triggers.push('Red Seal')
	}

	for (const joker of state.jokers) {
		if (!joker.active) continue
		const resolvedJoker = resolveJoker(state.jokers, joker)
		if (resolvedJoker === undefined) {
			continue
		}

		switch (resolvedJoker.name) {
			case 'Dusk': {
				if (state.hands === 1) triggers.push(resolvedJoker.name)
				break
			}
			case 'Hack': {
				if (isRank(card, ['2', '3', '4', '5'])) triggers.push(resolvedJoker.name)
				break
			}
			case 'Hanging Chad': {
				if (index === 0) {
					triggers.push(resolvedJoker.name, resolvedJoker.name)
				}
				break
			}
			case 'Seltzer': {
				triggers.push(resolvedJoker.name)
				break
			}
			case 'Sock and Buskin': {
				if (isFaceCard(card, state.jokerSet)) triggers.push(resolvedJoker.name)
				break
			}
		}
	}

	return triggers
}

function getHeldCardTriggers ({ state, card }: { state: State, card: Card }): string[] {
	const triggers = ['Regular']

	if (card.seal === 'Red') {
		triggers.push('Red Seal')
	}

	for (const joker of state.jokers) {
		if (!joker.active) continue
		const resolvedJoker = resolveJoker(state.jokers, joker)
		if (resolvedJoker === undefined) {
			continue
		}

		switch (resolvedJoker.name) {
			case 'Mime': {
				triggers.push(resolvedJoker.name)
				break
			}
		}
	}

	return triggers
}

function getJokerTriggers (options: { state: State, joker: Joker }) {
	const triggers = ['Regular']

	for (const joker of options.state.jokers) {
		if (!joker.active) continue
		if (['Blueprint', 'Brainstorm'].includes(joker.name)) {
			const resolvedJoker = resolveJoker(options.state.jokers, joker)
			if (resolvedJoker !== undefined && resolvedJoker.index === options.joker.index) {
				triggers.push(joker.name)
			}
		}
	}

	return triggers
}
