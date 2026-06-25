import { html } from 'lit-html'

import { DEFAULT_HAND_SCORE_SETS, PLANET_SCORE_SETS } from '#lib/data.ts'
import type { HandLevel, HandName } from '#lib/types.ts'
import { BaseElement } from './BaseElement.ts'

const lightCss = /*css*/`
	hand-level-card {
		display: block;
		inline-size: initial;
	}

	@media (prefers-contrast: more) {
		hand-level-card {
			--c-text: var(--c-black);
			--c-text-disabled: var(--c-grey-dark);
			--c-border: var(--c-black);
			--c-background-light: var(--c-grey-light);
			--c-background-lighter: var(--c-white);
		}
	}

	.hlc-level-input,
	.hlc-plays-input {
		text-align: end;
		inline-size: 2.5rem;
	}

	.hlc-base {
		margin-block-start: -0.25rem;
		font-size: 0.68rem;
		font-style: italic;
		font-weight: 500;
		color: var(--ink-dim, #8a93a6);
		font-variant-numeric: tabular-nums;
	}
	.hlc-score {
		margin-block-end: 0.45rem;
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.hlc-score .hlc-mult { color: var(--c-red, #d4423a); }
	.hlc-score .hlc-chips { color: var(--c-blue, #3a8fd4); }
	.hlc-score .hlc-x { color: var(--ink-dim, currentColor); margin-inline: 0.25rem; }
`
const lightStyleSheet = await new CSSStyleSheet().replace(lightCss)

export class HandLevelCard extends BaseElement {
	static {
		if (window.customElements.get('hand-level-card') === undefined) {
			window.customElements.define('hand-level-card', HandLevelCard)
			document.adoptedStyleSheets.push(lightStyleSheet)
		}
	}

	#handName
	#level
	#plays

	constructor (
		handName?: HandName,
		handLevel?: HandLevel,
	) {
		super()

		this.#handName = handName ?? 'High Card'
		this.#level = handLevel?.level ?? 1
		this.#plays = handLevel?.plays ?? 0
	}

	get handName () {
		return this.#handName
	}

	set handName (handName) {
		this.#handName = handName

		this.queueRender()
	}

	get level () {
		return this.#level
	}

	set level (level) {
		this.#level = level

		this.queueRender()
	}

	get plays () {
		return this.#plays
	}

	set plays (plays) {
		this.#plays = plays

		this.queueRender()
	}

	#score () {
		const defaultScore = DEFAULT_HAND_SCORE_SETS[this.#handName]
		const levelBasedScore = PLANET_SCORE_SETS[this.#handName]

		// Mirrors getHandBaseScores in getState.ts: level 1 applies the default
		// score set; each level beyond adds the planet (per-level) increment;
		// level 0 scores nothing.
		const level = this.#level
		const chips = level === 0 ? 0 : defaultScore.chips + (level - 1) * levelBasedScore.chips
		const multiplier = level === 0 ? 0 : defaultScore.multiplier + (level - 1) * levelBasedScore.multiplier

		return { chips, multiplier, baseChips: defaultScore.chips, baseMultiplier: defaultScore.multiplier }
	}

	template () {
		const { chips, multiplier, baseChips, baseMultiplier } = this.#score()

		return html`
			<fieldset class="stack">
				<legend>${this.handName}</legend>

				<div class="hlc-base">base ${baseChips} Chips × ${baseMultiplier} Mult</div>

				<div class="hlc-score">
					<span class="hlc-chips">${chips} Chips</span>
					<span class="hlc-x">×</span>
					<span class="hlc-mult">${multiplier} Mult</span>
				</div>

				<div class="stack">
					<div class="input-list">
						<label class="control-box --flat --grow">
							<span class="label">
								<span aria-hidden="true">lvl</span>
								<span class="visually-hidden">Level</span>
							</span>

							<input
								class="hlc-level-input text-input"
								type="number"
								value="1"
								.value="${this.level}"
								min="1"
								@change="${(event: Event) => {
									const input = event.target as HTMLInputElement
									this.level = Number(input.value)
								}}"
							>
						</label>

						<label class="hlc-plays control-box --flat --grow">
							<span class="label">
								<span aria-hidden="true">#</span>
								<span class="visually-hidden">Number of plays</span>
							</span>

							<input
								class="hlc-plays-input text-input"
								type="number"
								value="0"
								.value="${this.plays}"
								min="0"
								@change="${(event: Event) => {
									const input = event.target as HTMLInputElement
									this.plays = Number(input.value)
								}}"
							>
						</label>
					</div>
				</div>
			</fieldset>
		`
	}
}
