import { html } from 'lit-html'

import { JOKER_DEFINITIONS } from '#lib/data.ts'
import type { Joker, JokerEdition, JokerName, JokerContribution, Rank, Suit } from '#lib/types.ts'
import { MovableCard } from './MovableCard.ts'
import { getShortcutKey } from '../getShortcutKey.ts'
import { getJokerSprite, getEditionOverlay } from '../sprites.ts'
import { applyTilt } from '../tilt.ts'
import { animateCardEntrance } from '../animations.ts'
import { getJokerInfo, whenJokerInfoReady } from '../jokerInfo.ts'

function formatDrop (dropPercentage: number): string {
	if (!isFinite(dropPercentage)) return '—'
	// Positive drop = the score falls when this joker is disabled (shown as −X%). Negative = the joker
	// is a net drag and disabling it would raise the score (shown as +X%).
	const sign = dropPercentage >= 0 ? '−' : '+'
	return `${sign}${Math.abs(dropPercentage).toFixed(1)}%`
}

const lightCss = /*css*/`
	joker-card {
		--c-text: var(--c-black);
		--c-text-disabled: var(--c-red-dark);
		--c-border: var(--c-red-dark);
		--c-background-light: var(--c-red-light);
		--c-background-lighter: var(--c-red-lighter);

		display: block;
	}

	@media (prefers-contrast: more) {
		joker-card {
			--c-border: var(--c-black);
			--c-background-light: var(--c-grey-light);
			--c-background-lighter: var(--c-white);
		}
	}

	joker-card:where([draggable="true"]) {
		cursor: ew-resize;
	}

	.jc-name-input {
		font-weight: bold;
	}

	.jc-count-input {
		inline-size: 3.5rem;
		text-align: end;
	}

	.jc-edition-input {
		inline-size: 8.5rem;
	}

	joker-card:not(.--has-plus-chips):not(.--has-plus-multiplier):not(.--has-times-multiplier):not(.--has-is-active):not(.--has-rank):not(.--has-suit) .jc-effects {
		display: none;
	}

	joker-card:not(.--has-plus-chips) .jc-plus-chips {
		display: none;
	}

	joker-card:not(.--has-plus-multiplier) .jc-plus-multiplier {
		display: none;
	}

	joker-card:not(.--has-times-multiplier) .jc-times-multiplier {
		display: none;
	}

	joker-card:not(.--has-rank):not(.--has-suit) .jc-card {
		display: none;
	}

	.jc-is-active {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-block-start: 0.25rem;
	}

	joker-card:not(.--has-rank) .jc-rank {
		display: none;
	}

	.jc-rank-input {
		inline-size: 5rem;
	}

	.jc-card-of {
		text-align: center;
	}

	joker-card.--has-rank:not(.--has-suit) .jc-card-of,
	joker-card:not(.--has-rank).--has-suit .jc-card-of {
		display: none;
	}

	joker-card:not(.--has-suit) .jc-suit {
		display: none;
	}

	.jc-suit-input {
		inline-size: 8rem;
	}

	.jc-plus-chips-input {
		inline-size: 7rem;
		text-align: end;
	}

	.jc-plus-multiplier-input {
		inline-size: 7rem;
		text-align: end;
	}

	.jc-times-multiplier-input {
		inline-size: 7rem;
		text-align: end;
	}

	.jc-contribution {
		font-size: 0.8rem;
		text-align: center;
		padding: 0.25rem;
		background: var(--c-background-lighter);
		border-radius: 4px;
		margin-block-start: 0.5rem;
	}

	.jc-contribution-value {
		font-weight: bold;
	}

	.jc-contribution-percent {
		color: var(--c-text-secondary, #666);
	}

	.jc-toggle-wrapper {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-block-start: 0.25rem;
	}

	.jc-toggle-switch {
		appearance: none;
		width: 2.5rem;
		height: 1.25rem;
		background: var(--c-text-disabled);
		border-radius: 1rem;
		cursor: pointer;
		position: relative;
		transition: background 0.2s;
	}

	.jc-toggle-switch::before {
		content: '';
		position: absolute;
		width: 1rem;
		height: 1rem;
		background: white;
		border-radius: 50%;
		top: 0.125rem;
		left: 0.125rem;
		transition: transform 0.2s;
	}

	.jc-toggle-switch:checked {
		background: var(--c-border);
	}

	.jc-toggle-switch:checked::before {
		transform: translateX(1.25rem);
	}

	.jc-toggle-label {
		font-size: 0.75rem;
		color: var(--c-text-secondary, #666);
	}

	.jc-toggle-switch:checked + .jc-toggle-label {
		color: var(--c-text);
	}
`
const lightStyleSheet = await new CSSStyleSheet().replace(lightCss)

export class JokerCard extends MovableCard {
	static {
		if (window.customElements.get('joker-card') === undefined) {
			window.customElements.define('joker-card', JokerCard)
			document.adoptedStyleSheets.push(lightStyleSheet)
		}
	}

	#jokerName: JokerName = '8 Ball'
	#count = 1
	#edition: JokerEdition = 'Base'
	#plusChips = 0
	#plusMultiplier = 0
	#timesMultiplier = 1
	#active = true
	#rank: Rank = 'Ace'
	#suit: Suit = 'Clubs'
	#contribution: JokerContribution | null = null

	#commands: Record<string, { action: (event: KeyboardEvent) => void }> = {
		ArrowLeft: {
			action: () => this.swapLeft(),
		},
		'Ctrl+ArrowLeft': {
			action: () => this.moveToStart(),
		},
		ArrowRight: {
			action: () => this.swapRight(),
		},
		'Ctrl+ArrowRight': {
			action: () => this.moveToEnd(),
		},
		Backspace: {
			action: (event) => {
				if (event.target === this) {
					this.remove()
				}
			},
		},
		Delete: {
			action: (event) => {
				if (event.target === this) {
					this.remove()
				}
			},
		},
	}

	constructor (joker?: Omit<Joker, 'index' | 'rarity'>) {
		super()

		if (!this.id) {
			this.id = `${this.tagName.toLowerCase()}-${this.uniqueId}`
		}
		this.classList.add('card')
		// Native HTML5 drag is disabled: SortableJS handles pointer dragging. Keyboard/button
		// reordering (via MovableCard) still works.
		this.draggable = false
		this.tabIndex = 0
		this.role = 'group'
		this.setAttribute('aria-labelledby', `${this.tagName.toLowerCase()}-${this.uniqueId}-title`)

		if (joker) {
			this.jokerName = joker.name
			this.count = joker.count
			this.edition = joker.edition
			this.plusChips = joker.plusChips
			this.plusMultiplier = joker.plusMultiplier
			this.timesMultiplier = joker.timesMultiplier
			this.active = joker.active
			if (joker.rank) {
				this.rank = joker.rank
			}
			if (joker.suit) {
				this.suit = joker.suit
			}
		}

		this.addEventListener('keydown', (event) => {
			const key = getShortcutKey(event)
			const command = this.#commands[key]
			if (command) {
				command.action(event)
			}
		})
	}

	get index () {
		return Array.from(this.parentElement!.children).indexOf(this)
	}

	get jokerName () {
		return this.#jokerName
	}

	set jokerName (jokerName) {
		this.#jokerName = jokerName

		const definition = JOKER_DEFINITIONS[this.jokerName]
		this.classList[definition.hasPlusChipsInput ? 'add' : 'remove']('--has-plus-chips')
		this.classList[definition.hasPlusMultiplierInput ? 'add' : 'remove']('--has-plus-multiplier')
		this.classList[definition.hasTimesMultiplierInput ? 'add' : 'remove']('--has-times-multiplier')
		this.classList.add('--has-is-active')
		this.classList[definition.hasRankInput ? 'add' : 'remove']('--has-rank')
		this.classList[definition.hasSuitInput ? 'add' : 'remove']('--has-suit')

		this.queueRender()
	}

	get count () {
		return this.#count
	}

	set count (count) {
		this.#count = count

		this.queueRender()
	}

	get edition () {
		return this.#edition
	}

	set edition (edition) {
		this.#edition = edition

		for (const name of ['base', 'foil', 'holographic', 'polychrome', 'negative']) {
			this.classList.toggle(`--edition-${name}`, edition.toLowerCase() === name)
		}

		this.queueRender()
	}

	get plusChips () {
		return this.#plusChips
	}

	set plusChips (plusChips) {
		this.#plusChips = plusChips

		this.queueRender()
	}

	get plusMultiplier () {
		return this.#plusMultiplier
	}

	set plusMultiplier (plusMultiplier) {
		this.#plusMultiplier = plusMultiplier

		this.queueRender()
	}

	get timesMultiplier () {
		return this.#timesMultiplier
	}

	set timesMultiplier (timesMultiplier) {
		this.#timesMultiplier = timesMultiplier

		this.queueRender()
	}

	get rank () {
		return this.#rank
	}

	set rank (rank) {
		this.#rank = rank

		this.queueRender()
	}

	get suit () {
		return this.#suit
	}

	set suit (suit) {
		this.#suit = suit

		this.queueRender()
	}

	get active () {
		return this.#active
	}

	set active (active) {
		this.#active = active

		this.queueRender()
	}

	get contribution () {
		return this.#contribution
	}

	set contribution (contribution: JokerContribution | null) {
		this.#contribution = contribution

		this.queueRender()
	}

	toString () {
		const modifiers = [this.edition !== 'Base' ? this.edition : undefined].filter((modifier) => modifier !== undefined)

		return `Joker ${this.index + 1}: ${this.jokerName}` + (modifiers.length > 0 ? ` (${modifiers.join(', ')})` : '')
	}

	#tiltCleanup: (() => void) | undefined

	connectedCallback () {
		super.connectedCallback()

		if (!this.isConnected) {
			return
		}

		this.render()

		if (!this.#tiltCleanup) {
			this.#tiltCleanup = applyTilt(this)
			animateCardEntrance(this)
		}

		// Re-render once the joker reference data has loaded so the info panel/tooltip populate.
		whenJokerInfoReady(() => this.queueRender())
	}

	disconnectedCallback () {
		super.disconnectedCallback()
		this.#tiltCleanup?.()
		this.#tiltCleanup = undefined
	}

	#artTemplate () {
		const sprite = getJokerSprite(this.jokerName)
		const editionOverlay = getEditionOverlay(this.edition)
		const info = getJokerInfo(this.jokerName)
		const tooltip = info ? `${info.name} — ${info.effect}` : this.jokerName

		return html`
			<div class="card-art ${this.active ? '' : '--inactive'}" aria-hidden="true" title="${tooltip}" @click="${this.toggleEditor}">
				<img class="card-art-img" src="${sprite}" alt="" draggable="false" decoding="async">
				${editionOverlay !== null ? html`<div class="card-edition" style="background:${editionOverlay}"></div>` : ''}
				<div class="card-glare"></div>
			</div>
		`
	}

	// Balatro-style reference panel (rarity / cost / effect) shown at the top of the editor sheet.
	#infoTemplate () {
		const info = getJokerInfo(this.jokerName)
		if (!info) {
			return ''
		}

		return html`
			<div class="joker-info">
				<div class="joker-info-meta">
					${info.rarity ? html`<span class="joker-rarity --${info.rarity.toLowerCase()}">${info.rarity}</span>` : ''}
					${info.cost ? html`<span class="joker-cost">${info.cost}</span>` : ''}
				</div>
				${info.effect ? html`<p class="joker-info-effect">${info.effect}</p>` : ''}
			</div>
		`
	}

	template () {
		return html`
			<div class="stack">
				${this.#artTemplate()}

				<div class="card-face-actions">
					<button
						class="face-btn"
						?disabled="${this.previousElementSibling === null}"
						type="button"
						@click="${this.swapLeft}"
					>
						<span class="visually-hidden">Move joker left</span>
						<svg class="icon"><use xlink:href="#arrow-left-icon"></use></svg>
					</button>

					<button
						class="face-btn"
						?disabled="${this.nextElementSibling === null}"
						type="button"
						@click="${this.swapRight}"
					>
						<span class="visually-hidden">Move joker right</span>
						<svg class="icon"><use xlink:href="#arrow-right-icon"></use></svg>
					</button>

					<label class="card-toggle ${this.active ? '--on' : ''}" title="Active">
						<input
							type="checkbox"
							.checked="${this.active}"
							@change="${(event: Event) => {
								const input = event.target as HTMLInputElement
								this.active = input.checked
							}}"
						>
						<span class="visually-hidden">Active</span>
						<svg class="icon"><use xlink:href="#check-icon"></use></svg>
					</label>

					<button
						class="face-btn --danger"
						type="button"
						@click="${() => this.remove()}"
					>
						<span class="visually-hidden">Delete joker</span>
						<svg class="icon"><use xlink:href="#trash-icon"></use></svg>
					</button>
				</div>

				<span id="${this.tagName.toLowerCase()}-${this.uniqueId}-title" class="visually-hidden">${this.toString()}</span>

				<div class="card-editor" @click="${(event: Event) => { if (event.target === event.currentTarget) this.classList.remove('--editing') }}">
				<div class="editor-sheet">
				<div class="editor-head">
					<span class="editor-title">Edit joker</span>
					<button class="button --primary" type="button" @click="${() => this.classList.remove('--editing')}">Done</button>
				</div>

				${this.#infoTemplate()}
				<label>
					<span class="visually-hidden">Joker name</span>

					<combo-box
						id="joker-name-${this.uniqueId}"
						name="joker-name-${this.uniqueId}"
						class="jc-name-input"
						value="8 Ball"
						.value="${this.jokerName}"
						options-json="jokersJson"
						button-label="Show joker options"
						input-label="Filter jokers"
						listbox-label="Jokers"
						@change="${(event: Event) => {
							const input = event.target as HTMLInputElement
							this.jokerName = input.value as JokerName
						}}"
					></combo-box>
				</label>

				<div class="action-list">
					<label class="control-box --flat --grow">
						<span class="label truncate">Count</span>
						<input
							id="joker-count-${this.uniqueId}"
							class="jc-count-input text-input"
							type="number"
							value="1"
							.value="${this.count}"
							min="0"
							@change="${(event: Event) => {
								const input = event.target as HTMLInputElement
								this.count = Number(input.value)
							}}"
						>
						<span class="label truncate" aria-hidden="true">×</span>
					</label>

					<button
						class="button --icon"
						type="button"
						popovertarget="jc-duplicate-modal"
						@click="${(event: Event) => this.showDuplicateModal(event)}"
					>
						<span class="visually-hidden">Duplicate joker</span>

						<svg class="icon">
							<use xlink:href="#copy-icon"></use>
						</svg>
					</button>
				</div>

				<label class="control-box --flat --grow">
					<span class="label truncate">Edition</span>

					<select
						id="joker-edition-${this.uniqueId}"
						name="joker-edition-${this.uniqueId}"
						.value="${this.edition}"
						class="jc-edition-input select"
						@change="${(event: Event) => {
							const input = event.target as HTMLInputElement
							this.edition = input.value as JokerEdition
						}}"
					>
						<option value="Base" selected>Base</option>
						<option value="Foil">Foil</option>
						<option value="Holographic">Holographic</option>
						<option value="Polychrome">Polychrome</option>
						<option value="Negative">Negative</option>
					</select>
				</label>

				<div class="jc-effects stack">
					<label class="jc-plus-chips control-box --flat --grow">
						<span class="label truncate">+Chips</span>

						<input
							name="joker-plusChips-${this.uniqueId}"
							class="jc-plus-chips-input text-input"
							type="number"
							value="0"
							.value="${this.plusChips}"
							min="0"
							@change="${(event: Event) => {
								const input = event.target as HTMLInputElement
								this.plusChips = Number(input.value)
							}}"
						>
					</label>

					<label class="jc-plus-multiplier control-box --flat --grow">
						<span class="label truncate">+Mult</span>

						<input
							name="joker-plusMultiplier-${this.uniqueId}"
							class="jc-plus-multiplier-input text-input"
							type="number"
							value="0"
							.value="${this.plusMultiplier}"
							min="0"
							@change="${(event: Event) => {
								const input = event.target as HTMLInputElement
								this.plusMultiplier = Number(input.value)
							}}"
						>
					</label>

					<label class="jc-times-multiplier control-box --flat --grow">
						<span class="label truncate">xMult</span>

						<input
							name="joker-timesMultiplier-${this.uniqueId}"
							class="jc-times-multiplier-input text-input"
							type="number"
							value="1"
							.value="${this.timesMultiplier}"
							min="1"
							step="0.05"
							@change="${(event: Event) => {
								const input = event.target as HTMLInputElement
								this.timesMultiplier = Number(input.value)
							}}"
						>
					</label>

					<label class="jc-is-active">
						<input
							name="joker-active-${this.uniqueId}"
							class="jc-toggle-switch"
							type="checkbox"
							value="is-active"
							.checked="${this.active}"
							@change="${(event: Event) => {
								const input = event.target as HTMLInputElement
								this.active = input.checked
							}}"
						>
						<span class="jc-toggle-label">${this.active ? 'Active' : 'Inactive'}</span>
					</label>

					<div class="jc-card input-list">
						<label class="jc-rank">
							<span class="visually-hidden">Rank</span>

							<select
								id="joker-rank-${this.uniqueId}"
								name="joker-rank-${this.uniqueId}"
								class="jc-rank-input select"
								.value="${this.rank}"
								@change="${(event: Event) => {
									const input = event.target as HTMLInputElement
									this.rank = input.value as Rank
								}}"
							>
								<option value="Ace" selected>Ace</option>
								<option value="King">King</option>
								<option value="Queen">Queen</option>
								<option value="Jack">Jack</option>
								<option value="10">10</option>
								<option value="9">9</option>
								<option value="8">8</option>
								<option value="7">7</option>
								<option value="6">6</option>
								<option value="5">5</option>
								<option value="4">4</option>
								<option value="3">3</option>
								<option value="2">2</option>
							</select>
						</label>

						<span class="jc-card-of">of</span>

						<label class="jc-suit">
							<span class="visually-hidden">Suit</span>

							<select
								id="joker-suit-${this.uniqueId}"
								name="joker-suit-${this.uniqueId}"
								class="jc-suit-input select"
								.value="${this.suit}"
								@change="${(event: Event) => {
									const input = event.target as HTMLInputElement
									this.suit = input.value as Suit
								}}"
							>
								<button><selectedcontent></selectedcontent></button>
								<option value="Clubs" selected>
									<svg aria-hidden="true" class="icon --small">
										<use xlink:href="#clubs-icon"></use>
									</svg>
									Clubs
								</option>
								<option value="Spades">
									<svg aria-hidden="true" class="icon --small">
										<use xlink:href="#spades-icon"></use>
									</svg>
									Spades
								</option>
								<option value="Hearts">
									<svg aria-hidden="true" class="icon --small">
										<use xlink:href="#hearts-icon"></use>
									</svg>
									Hearts
								</option>
								<option value="Diamonds">
									<svg aria-hidden="true" class="icon --small">
										<use xlink:href="#diamonds-icon"></use>
									</svg>
									Diamonds
								</option>
							</select>
						</label>
					</div>
				</div>
				</div>
				</div>

				${this.contribution !== null ? html`
					<div class="jc-contribution">
						<span class="jc-contribution-value">${formatDrop(this.contribution.dropPercentage)}</span>
						<span class="jc-contribution-percent">${this.contribution.sharePercentage.toFixed(1)}% share</span>
					</div>
				` : ''}
			</div>
		`
	}

	// Opens this joker's editor sheet, closing any other card's open editor first (one at a time).
	toggleEditor = () => {
		const willOpen = !this.classList.contains('--editing')
		if (willOpen) {
			for (const el of document.querySelectorAll('.card.--editing')) {
				el.classList.remove('--editing')
			}
		}
		this.classList.toggle('--editing', willOpen)
	}

	showDuplicateModal = (event: Event) => {
		const button = event.currentTarget as HTMLButtonElement
		const dialog = document.querySelector(`dialog[id="${button.getAttribute('popovertarget')}"]`)
		if (dialog instanceof HTMLDialogElement) {
			dialog.setAttribute('data-duplicate-target-id', this.id)
			dialog.showModal()
		}
	}

	clone () {
		return new JokerCard({
			name: this.jokerName,
			edition: this.edition,
			plusChips: this.plusChips,
			plusMultiplier: this.plusMultiplier,
			timesMultiplier: this.timesMultiplier,
			active: this.active,
			count: this.count,
			rank: this.rank,
			suit: this.suit,
		})
	}
}
