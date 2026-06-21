import type { TestCase } from '#lib/calculateScore.test.ts'

export default (message: string): TestCase => {
	return {
		message,
		initialState: {
			cards: [
				{ played: true, rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ played: true, rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ played: true, rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ played: true, rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ played: true, rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
			],
			jokers: [
				{ name: 'Sock and Buskin' },
				{ name: 'Sock and Buskin' },
				{ name: 'Bloodstone' },
				{ name: 'Bloodstone' },
				{ name: 'Oops! All 6s' },
			],
			handLevels: {
				'Flush Five': {
					level: 11,
					plays: 0,
				},
			},
		},
		expected: {
			hand: 'Flush Five',
			scoringCards: [
				{ rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
				{ rank: 'Jack', suit: 'Hearts', edition: 'Holographic', enhancement: 'Lucky', seal: 'Red' },
			],
			results: [
				{ chips: '860', multiplier: '707669250.5401607771054841578006744384765625', score: '608595555464', formattedScore: '608,595,555,464', luck: 'none' },
				{ chips: '860', multiplier: '866894821.5616969519542180933058261871337890625', score: '745529546543', formattedScore: '745,529,546,543', luck: 'average' },
				{ chips: '860', multiplier: '1105733178.09400121422731899656355381011962890625', score: '950930533160', formattedScore: '950,930,533,160', luck: 'all' },
			],
		},
	}
}
