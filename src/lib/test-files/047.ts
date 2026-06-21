import type { TestCase } from '#lib/calculateScore.test.ts'

export default (message: string): TestCase => {
	return {
		message,
		initialState: {
			cards: [
				{ played: true, rank: '7', suit: 'Spades' },
				{ played: true, rank: '7', suit: 'Hearts' },
				{ played: true, rank: '5', suit: 'Spades' },
				{ played: true, rank: '5', suit: 'Clubs' },
				{ played: true, rank: '2', suit: 'Diamonds' },
			],
			jokers: [
				{ name: 'Mad Joker' },
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
				{ chips: '44', multiplier: '12', score: '528', formattedScore: '528', luck: 'none' },
				{ chips: '44', multiplier: '12', score: '528', formattedScore: '528', luck: 'average' },
				{ chips: '44', multiplier: '12', score: '528', formattedScore: '528', luck: 'all' },
			],
		},
	}
}
