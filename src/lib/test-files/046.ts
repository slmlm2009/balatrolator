import type { TestCase } from '#lib/calculateScore.test.ts'

export default (message: string): TestCase => {
	return {
		message,
		initialState: {
			cards: [
				{ played: true, rank: '7', suit: 'Spades' },
				{ played: true, rank: '7', suit: 'Hearts' },
				{ played: true, rank: '7', suit: 'Clubs' },
				{ played: true, rank: '5', suit: 'Spades' },
				{ played: true, rank: '2', suit: 'Diamonds' },
			],
			jokers: [
				{ name: 'Zany Joker' },
			],
		},
		expected: {
			hand: 'Three of a Kind',
			scoringCards: [
				{ rank: '7', suit: 'Spades' },
				{ rank: '7', suit: 'Hearts' },
				{ rank: '7', suit: 'Clubs' },
			],
			results: [
				{ chips: '51', multiplier: '15', score: '765', formattedScore: '765', luck: 'none' },
				{ chips: '51', multiplier: '15', score: '765', formattedScore: '765', luck: 'average' },
				{ chips: '51', multiplier: '15', score: '765', formattedScore: '765', luck: 'all' },
			],
		},
	}
}
