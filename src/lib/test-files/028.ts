import type { TestCase } from '#lib/calculateScore.test.ts'

export default (message: string): TestCase => {
	return {
		message,
		initialState: {
			hands: 1,
			cards: [
				{ played: true, rank: 'King', suit: 'Hearts', enhancement: 'Lucky' },
				{ played: true, rank: 'King', suit: 'Hearts', enhancement: 'Lucky' },
				{ played: true, rank: 'Jack', suit: 'Hearts', enhancement: 'Lucky' },
				{ played: true, rank: 'Ace', suit: 'Hearts', enhancement: 'Lucky' },
				{ played: true, rank: '6', suit: 'Hearts', enhancement: 'Lucky' },
			],
			jokers: [
				{ name: 'Sock and Buskin' },
				{ name: 'Dusk' },
				{ name: 'Lusty Joker' },
				{ name: 'Blueprint' },
				{ name: 'Bloodstone' },
			],
		},
		expected: {
			hand: 'Flush',
			scoringCards: [
				{ rank: 'King', suit: 'Hearts', enhancement: 'Lucky' },
				{ rank: 'King', suit: 'Hearts', enhancement: 'Lucky' },
				{ rank: 'Jack', suit: 'Hearts', enhancement: 'Lucky' },
				{ rank: 'Ace', suit: 'Hearts', enhancement: 'Lucky' },
				{ rank: '6', suit: 'Hearts', enhancement: 'Lucky' },
			],
			results: [
				{ chips: '159', multiplier: '43', score: '6837', formattedScore: '6,837', luck: 'none' },
				{ chips: '159', multiplier: '7737.6715221639484176829881789672072045505046844482421875', score: '1230289', formattedScore: '1,230,289', luck: 'average' },
				{ chips: '159', multiplier: '1719563.16082428395748138427734375', score: '273410542', formattedScore: '273,410,542', luck: 'all' },
			],
		},
	}
}
