import type { TestCase } from '#lib/calculateScore.test.ts'

// Regression: Baseball Card gives X1.5 Mult per Uncommon joker. Bootstraps must be Uncommon for
// this to apply. If Bootstraps' rarity regresses to Common, Baseball Card stops multiplying and the
// multiplier drops from 18 to 12.
export default (message: string): TestCase => {
	return {
		message,
		initialState: {
			money: 25,
			cards: [
				{ played: true, rank: '7', suit: 'Spades' },
				{ played: true, rank: '7', suit: 'Hearts' },
				{ played: true, rank: '5', suit: 'Spades' },
				{ played: true, rank: '5', suit: 'Clubs' },
				{ played: true, rank: '2', suit: 'Diamonds' },
			],
			jokers: [
				{ name: 'Bootstraps' },
				{ name: 'Baseball Card' },
			],
		},
		expected: {
			hand: 'Two Pair',
			scoringCards: [
				{ rank: '7', suit: 'Spades' },
				{ rank: '7', suit: 'Hearts' },
				{ rank: '5', suit: 'Spades' },
				{ rank: '5', suit: 'Clubs' },
			],
			results: [
				{ chips: '44', multiplier: '18', score: '792', formattedScore: '792', luck: 'none' },
				{ chips: '44', multiplier: '18', score: '792', formattedScore: '792', luck: 'average' },
				{ chips: '44', multiplier: '18', score: '792', formattedScore: '792', luck: 'all' },
			],
		},
	}
}
