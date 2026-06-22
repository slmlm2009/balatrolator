import './components/ComboBox.ts'

import { getState } from '#lib/getState.ts'
import { calculateScore } from '#lib/calculateScore.ts'
import { formatCompact } from '#lib/formatScore.ts'
import type { ComboBox } from './components/ComboBox.ts'
import { HandLevelCard } from './components/HandLevelCard.ts'
import { JokerCard } from './components/JokerCard.ts'
import { PlayingCard } from './components/PlayingCard.ts'
import { debounce } from './debounce.ts'
import { readStateFromUrl, saveStateToUrl } from './Storage.ts'
import { SaveManager } from './SaveManager.ts'
import { loadSortable, type SortableOptions } from './vendor.ts'
import { animateScoreboard } from './animations.ts'
import { getBlindInfo, whenBlindInfoReady } from './blindInfo.ts'
import { getDeckInfo, whenDeckInfoReady } from './deckInfo.ts'
import type { BlindName, Card, DeckName, HandName, InitialState, Joker, State, Result, InitialJoker, InitialCard, JokerContribution } from '#lib/types.ts'

const dateTimeFormat = new Intl.DateTimeFormat(document.documentElement.lang, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	hour12: false,
	minute: 'numeric',
	second: 'numeric',
})

const saveManager = new SaveManager()

const form = document.querySelector<HTMLFormElement>('[data-form]')!
form.addEventListener('submit', (event) => {
	event.preventDefault()
	const state = readStateFromUi()
	applyState(state)
})
form.addEventListener('change', () => calculate())

// Focusing a number field selects its value so you can immediately type a replacement.
// Delegated on the document so it covers every number input, including ones added later.
document.addEventListener('focusin', (event) => {
	const el = event.target
	if (el instanceof HTMLInputElement && el.type === 'number') {
		// Defer so the browser's own focus/caret placement doesn't clear the selection (mobile).
		setTimeout(() => el.select(), 0)
	}
})

const liveRegion = document.querySelector<HTMLElement>('[aria-live="polite"]')!
function ariaNotify (message: string) {
	liveRegion.innerText = message
}

const debouncedAriaNotify = debounce(ariaNotify, 1_000)

const handsInput = form.querySelector<HTMLInputElement>('[name="hands"]')!
const discardsInput = form.querySelector<HTMLInputElement>('[name="discards"]')!
const moneyInput = form.querySelector<HTMLInputElement>('[name="money"]')!

const blindNameInput = form.querySelector<ComboBox>('[name="blindName"]')!
const blindIsActiveCheckbox = form.querySelector<HTMLInputElement>('[name="blindIsActive"]')!

const deckInput = form.querySelector<ComboBox>('[name="deck"]')!

const blindDescEl = document.querySelector<HTMLElement>('[data-blind-desc]')
const deckDescEl = document.querySelector<HTMLElement>('[data-deck-desc]')

function updateBlindDesc () {
	if (!blindDescEl) return
	const info = getBlindInfo(blindNameInput.value)
	blindDescEl.textContent = info?.effect ?? ''
}

function updateDeckDesc () {
	if (!deckDescEl) return
	const info = getDeckInfo(deckInput.value)
	deckDescEl.textContent = info?.effect ?? ''
}

blindNameInput.addEventListener('change', () => updateBlindDesc())
deckInput.addEventListener('change', () => updateDeckDesc())
whenBlindInfoReady(() => updateBlindDesc())
whenDeckInfoReady(() => updateDeckDesc())

// The observatory inputs and hand-level cards live in drawers, outside the form.
const observatoryInputs = document.querySelectorAll<HTMLInputElement>('[data-r-observatory-hand]')
const jokerSlotsInput = form.querySelector<HTMLInputElement>('[name="jokerSlots"]')!

const handLevelContainer = document.querySelector<HTMLElement>('[data-h-container]')!

// These controls live in drawers outside the form, so recalculate explicitly when they change.
handLevelContainer.addEventListener('change', () => calculate())
for (const observatoryInput of observatoryInputs) {
	observatoryInput.addEventListener('change', () => calculate())
}

const jokerContainer = form.querySelector<HTMLElement>('[data-j-container]')!
const addJokerButton = form.querySelector<HTMLButtonElement>('[data-j-add-button]')!
addJokerButton.addEventListener('click', () => addJoker())
const duplicateJokerButton = document.querySelector<HTMLButtonElement>('[data-j-duplicate-button]')!
duplicateJokerButton.addEventListener('click', (event) => duplicate(event))

const playingCardContainer = form.querySelector<HTMLElement>('[data-c-container]')!
const addCardButton = form.querySelector<HTMLButtonElement>('[data-c-add-button]')!
addCardButton.addEventListener('click', () => addPlayingCard())
const duplicateCardButton = document.querySelector<HTMLButtonElement>('[data-c-duplicate-button]')!
duplicateCardButton.addEventListener('click', (event) => duplicate(event))

const playedHandEl = form.querySelector<HTMLElement>('[data-sc-played-hand]')!
// The reset button lives in the top bar, outside the form.
document.querySelector<HTMLButtonElement>('[data-sc-reset-button]')!.addEventListener('click', () => {
	populateUiWithState(getState({}))
})

// Scoreboard (Balatro-style chips × mult = score) elements.
const scoreboardEl = document.querySelector<HTMLElement>('.scoreboard')!
const sbHandEl = document.querySelector<HTMLElement>('[data-sb-hand]')!
const sbLevelEl = document.querySelector<HTMLElement>('[data-sb-level]')!
const sbChipsEl = document.querySelector<HTMLElement>('[data-sb-chips]')!
const sbMultEl = document.querySelector<HTMLElement>('[data-sb-mult]')!
const sbScoreEl = document.querySelector<HTMLElement>('[data-sb-score]')!
const luckButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sb-luck]'))

type Luck = 'none' | 'average' | 'all'
let selectedLuck: Luck = 'average'
let latestResults: Result[] = []
let latestHand: HandName = 'High Card'
let latestLevel = 1

for (const button of luckButtons) {
	button.addEventListener('click', () => {
		selectedLuck = button.getAttribute('data-sb-luck') as Luck
		renderScoreboard()
	})
}

const saveRowTemplate = document.querySelector<HTMLTemplateElement>('template#save-row')!
const saveForm = document.querySelector<HTMLFormElement>('[data-s-form]')!
saveForm.addEventListener('submit', (event) => handleSaveSubmit(event))
const importForm = document.querySelector<HTMLFormElement>('[data-s-import-form]')!
importForm.addEventListener('submit', (event) => handleImportSubmit(event))

for (const dialog of document.querySelectorAll('dialog')) {
	for (const button of dialog.querySelectorAll('button[data-modal-close-button]')) {
		if (button instanceof HTMLButtonElement) {
			button.addEventListener('click', () => {
				dialog.removeAttribute('data-duplicate-target-id')
				dialog.close()
			})
		}
	}
}

// Re-calculate score after re-ordering cards
const handleMutation: MutationCallback = (mutationList) => {
	if (mutationList.some(({ type }) => type === 'childList')) {
		calculate()
	}
}

const mutationObserver = new MutationObserver(handleMutation)
mutationObserver.observe(jokerContainer, { childList: true })
mutationObserver.observe(playingCardContainer, { childList: true })

export function init () {
	saveManager.retrieveStoredSaves()

	// Read the state from the URL first, then read it from web storage, and finally, fall back to the default/initial state.
	const state = readStateFromUrl() ?? saveManager.getAutoSave()?.state ?? getState({})
	populateUiWithState(state)

	populateSavesUi()

	setupDragAndDrop()
	setupTrayScrollbars()
}

/**
 * Adds an always-visible custom scrollbar under each tray so it's clear when there are more than 5
 * cards/jokers (native overlay scrollbars are hidden until scrolling on mobile). The thumb tracks
 * scroll position and the bar hides itself when there's nothing to scroll.
 */
function setupTrayScrollbars () {
	for (const tray of document.querySelectorAll<HTMLElement>('.tray')) {
		const bar = document.createElement('div')
		bar.className = 'tray-scroll'
		const thumb = document.createElement('div')
		thumb.className = 'tray-scroll-thumb'
		bar.append(thumb)
		tray.after(bar)

		const update = () => {
			const { clientWidth, scrollWidth, scrollLeft } = tray
			if (scrollWidth - clientWidth <= 1) {
				bar.style.display = 'none'
				return
			}
			bar.style.display = 'block'
			thumb.style.inlineSize = `${(clientWidth / scrollWidth) * 100}%`
			thumb.style.marginInlineStart = `${(scrollLeft / scrollWidth) * 100}%`
		}

		tray.addEventListener('scroll', update, { passive: true })
		new ResizeObserver(update).observe(tray)
		new MutationObserver(update).observe(tray, { childList: true })
		update()
	}
}

/**
 * Enables SortableJS pointer drag-and-drop for reordering jokers and playing cards (desktop only).
 *
 * On touch devices SortableJS is intentionally NOT loaded: its non-passive touch listeners fight the
 * horizontal tray scroll (causing a first-scroll hang) and dragging within a scroller is awkward —
 * mobile reorders via the on-card move buttons instead. Skipping it also avoids a CDN load on phones.
 * Interactive controls are excluded from dragging via the `filter`; reordering triggers a recalc.
 */
function setupDragAndDrop () {
	const isFinePointer = typeof window.matchMedia === 'function'
		&& window.matchMedia('(hover: hover) and (pointer: fine)').matches
	if (!isFinePointer) {
		return
	}

	// Loaded lazily and after first paint so it never competes with initial render/interaction.
	const start = () => void loadSortable().then((Sortable) => {
		if (!Sortable) {
			return
		}

		const options: SortableOptions = {
			animation: 180,
			easing: 'cubic-bezier(0.2, 0, 0, 1)',
			filter: 'input, select, button, label, combo-box, .checkbox-control, .control-box',
			preventOnFilter: false,
			ghostClass: 'sortable-ghost',
			chosenClass: 'sortable-chosen',
			dragClass: 'sortable-drag',
			delay: 60,
			delayOnTouchOnly: true,
			onEnd: () => calculate(),
		}

		Sortable.create(jokerContainer, options)
		Sortable.create(playingCardContainer, options)
	})

	if ('requestIdleCallback' in window) {
		;(window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(start)
	} else {
		setTimeout(start, 500)
	}
}

function calculate () {
	form.requestSubmit()
	if (form.checkValidity()) {
		for (const el of playingCardContainer.children) {
			if (el instanceof PlayingCard) {
				el.toggleBlindEffects(blindNameInput.value as BlindName, blindIsActiveCheckbox.checked)
			}
		}
	}
}

/**
 * Read saved hands from web storage and populate them in the UI.
 */
function populateSavesUi () {
	saveManager.retrieveStoredSaves()

	const savesContainer = document.querySelector<HTMLElement>('[data-s-saves]')!
	savesContainer.innerHTML = ''
	for (const save of saveManager.saves) {
		const fragment = saveRowTemplate.content.cloneNode(true) as Element

		const nameCell = fragment.querySelector<HTMLTableCellElement>('[data-s-name]')!
		nameCell.innerHTML = `<b>${save.name}</b>${save.autoSave ? ' <i>(autosave)</>' : ''}`

		const handCell = fragment.querySelector<HTMLTableCellElement>('[data-s-hand]')!
		handCell.innerHTML = save.hand

		const scoreCell = fragment.querySelector<HTMLTableCellElement>('[data-s-score]')!
		const averageResult = save.results.find(({ luck }) => luck === 'average')
		scoreCell.innerHTML = averageResult!.formattedScore

		const timeCell = fragment.querySelector<HTMLTableCellElement>('[data-s-time]')!
		timeCell.innerText = dateTimeFormat.format(new Date(save.time))

		const loadButton = fragment.querySelector<HTMLButtonElement>('[data-s-load-button]')!
		loadButton.setAttribute('data-save-name', save.name)
		loadButton.addEventListener('click', (event) => loadSave(event))

		const deleteButton = fragment.querySelector<HTMLButtonElement>('[data-s-delete-button]')!
		deleteButton.setAttribute('data-save-name', save.name)
		deleteButton.addEventListener('click', (event) => deleteSave(event))

		const exportButton = fragment.querySelector<HTMLButtonElement>('[data-s-export-button]')!
		exportButton.setAttribute('data-save-name', save.name)
		exportButton.addEventListener('click', (event) => exportSave(event))

		savesContainer.appendChild(fragment)
	}
}

function loadSave (event: Event) {
	const button = event.currentTarget as HTMLButtonElement
	const name = button.getAttribute('data-save-name')!

	const { state } = saveManager.getSave(name)!
	populateUiWithState(state)
}

function handleSaveSubmit (event: SubmitEvent) {
	event.preventDefault()

	const state = readStateFromUi()
	const form = event.currentTarget as HTMLFormElement
	const formData = new FormData(form)
	const name = formData.get('name') as Exclude<FormDataEntryValue, File> | null ?? `Save ${saveManager.saves.length - 1}`

	const { hand, results } = calculateScore(state)
	saveManager.save(name, state, hand, results)
	storeSaves()
}

/**
 * Delete a save.
 */
function deleteSave (event: Event) {
	const button = event.currentTarget as HTMLButtonElement
	const name = button.getAttribute('data-save-name')!
	saveManager.deleteSave(name)
	storeSaves()
}

function exportSave (event: Event) {
	const button = event.currentTarget as HTMLButtonElement
	const name = button.getAttribute('data-save-name')!
	const save = saveManager.getSave(name)!

	const blob = new Blob([JSON.stringify(save.state)], { type: 'application/json' })
	const objectUrl = window.URL.createObjectURL(blob)
	const link = Object.assign(document.createElement('a'), {
		download: `${save.name}.json`,
		href: objectUrl,
	})
	link.click()
	link.remove()
	window.URL.revokeObjectURL(objectUrl)
}

/**
 * Stores all saves in web storage and populates saves UI.
 */
function storeSaves () {
	saveManager.storeSaves()
	populateSavesUi()
}

function handleImportSubmit (event: SubmitEvent) {
	event.preventDefault()

	const form = event.currentTarget as HTMLFormElement
	const formData = new FormData(form)
	const file = formData.get('import') as File
	const fileReader = new FileReader()
	fileReader.addEventListener('load', () => {
		if (typeof fileReader.result === 'string') {
			const name = file.name.replace('.json', '')
			const state = JSON.parse(fileReader.result) as State
			state.jokerSet = new Set(state.jokers.map((joker) => joker.name))
			const { hand, results } = calculateScore(state)
			saveManager.save(name, state, hand, results)
			storeSaves()
			populateUiWithState(state)
		}
	})
	fileReader.readAsText(file)
}

// The interaction path is kept cheap: the scoreboard updates immediately from a score-only recalc
// (no per-joker contributions — those need ~N+2 extra full scorings per luck and would freeze the
// page on every keystroke). The expensive work — contributions, persistence (URL + localStorage +
// saves-table rebuild + log) — is debounced and runs once the user pauses. It's also flushed on page
// hide/visibility change so nothing is lost if the user leaves within the window.
let pendingPersist: State | null = null

function flushPersist () {
	if (!pendingPersist) {
		return
	}
	const state = pendingPersist
	pendingPersist = null

	// Full recompute including per-joker contributions — debounced, off the interaction path.
	const { hand, results } = calculateScore(state)
	updateJokerContributions(results)

	saveStateToUrl(state)
	// Save the current state as a special auto save overwriting the previous auto save.
	saveManager.autoSave(state, hand, results)
	storeSaves()
	updateLog(results)
}

const schedulePersist = debounce(flushPersist, 350)

window.addEventListener('pagehide', flushPersist)
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') {
		flushPersist()
	}
})

function applyState (state: State) {
	// Fast, contribution-free recalc for the immediate scoreboard update.
	const { hand, results } = calculateScore(state, { includeContributions: false })
	const level = state.handLevels[hand]?.level ?? 1
	updateScore(hand, results, level)

	pendingPersist = state
	schedulePersist()
}

function updateJokerContributions (results: Result[]) {
	const contributionMap = new Map<number, JokerContribution>()
	for (const result of results) {
		for (const contrib of result.jokerContributions ?? []) {
			contributionMap.set(contrib.jokerIndex, contrib)
		}
	}

	for (const jokerCard of jokerContainer.children) {
		if (!(jokerCard instanceof JokerCard)) {
			continue
		}
		jokerCard.contribution = contributionMap.get(jokerCard.index) ?? null
	}
}

function updateLog (results: Result[]) {
	const seen = new Set<string>()
	const lines: string[] = []
	for (const result of results) {
		if (seen.has(result.score)) {
			continue
		}
		seen.add(result.score)
		lines.push(result.log.join('\n'))
	}

	// The log lives in the log drawer (outside the form).
	const scoreLog = document.querySelector<HTMLPreElement>('[data-sc-log]')!
	scoreLog.innerHTML = lines.join('\n')
}

function updateScore (hand: HandName, results: Result[], level: number) {
	latestResults = results
	latestHand = hand
	latestLevel = level

	playedHandEl.textContent = hand
	renderScoreboard()

	const resultsByScore = new Map<string, Result>()
	for (const result of results) {
		if (!resultsByScore.has(result.score)) {
			resultsByScore.set(result.score, result)
		}
	}
	const resultArray = Array.from(resultsByScore.values())

	let scoreAnnouncement
	if (resultArray.length === 3) {
		const scoreLuckNone = resultArray.at(0)!.formattedScore
		const scoreLuckAverage = resultArray.at(1)!.formattedScore
		const scoreLuckAll = resultArray.at(2)!.formattedScore
		scoreAnnouncement = `${hand} scoring ${scoreLuckAverage} on average, ${scoreLuckAll} in the best case, and ${scoreLuckNone} in the worst case.`
	} else {
		scoreAnnouncement = `${hand} scoring ${resultArray.at(0)!.formattedScore}.`
	}
	debouncedAriaNotify(scoreAnnouncement)
}

/**
 * Renders the Balatro-style scoreboard (chips × mult = score) from the latest results, reflecting
 * the currently selected luck mode. Re-runnable without recalculating (e.g. when toggling luck).
 */
function renderScoreboard () {
	const byLuck = new Map(latestResults.map((result) => [result.luck, result]))
	const selected = byLuck.get(selectedLuck) ?? latestResults.at(0)

	sbHandEl.textContent = latestHand
	sbLevelEl.textContent = `lvl.${latestLevel}`

	if (!selected) {
		sbChipsEl.textContent = '0'
		sbMultEl.textContent = '0'
		sbScoreEl.textContent = '0'
		return
	}

	sbChipsEl.textContent = formatCompact(selected.chips)
	sbMultEl.textContent = formatCompact(selected.multiplier)
	sbScoreEl.textContent = selected.formattedScore

	for (const button of luckButtons) {
		const luck = button.getAttribute('data-sb-luck')
		button.classList.toggle('--active', luck === selectedLuck)
		const scoreSpan = button.querySelector<HTMLElement>('[data-sb-luck-score]')
		if (scoreSpan && luck) {
			scoreSpan.textContent = byLuck.get(luck as Luck)?.formattedScore ?? '—'
		}
	}

	// Collapse the luck row when every mode yields the same score (no probabilistic effects in play).
	const distinctScores = new Set(latestResults.map((result) => result.score))
	scoreboardEl.classList.toggle('--no-luck-variance', distinctScores.size <= 1)

	animateScoreboard(scoreboardEl)
}

/**
 * Assembles a `State` object from the various form elements in the UI.
 *
 * Inverse operation of `populateUiWithState`.
 */
function readStateFromUi (): State {
	const formData = new FormData(form)

	const hands = Number(formData.get('hands'))
	const discards = Number(formData.get('discards'))
	const money = Number(formData.get('money'))
	const blindName = formData.get('blindName') as BlindName
	const blindIsActive = formData.get('blindIsActive') === 'is-active'
	const deck = formData.get('deck') as DeckName
	const jokerSlots = Number(formData.get('jokerSlots'))

	const initialState: Required<InitialState> = {
		hands,
		discards,
		money,
		blind: {
			name: blindName,
			active: blindIsActive,
		},
		deck,
		observatory: {},
		handLevels: {},
		jokers: [],
		jokerSlots,
		cards: [],
	}

	for (const observatoryInput of observatoryInputs) {
		const handName = observatoryInput.getAttribute('data-r-observatory-hand') as HandName
		initialState.observatory[handName] = Number(observatoryInput.value)
	}

	for (const handLevel of handLevelContainer.children) {
		if (!(handLevel instanceof HandLevelCard)) continue

		initialState.handLevels[handLevel.handName] = {
			level: handLevel.level,
			plays: handLevel.plays,
		}
	}

	for (const jokerCard of jokerContainer.children) {
		if (!(jokerCard instanceof JokerCard)) continue

		initialState.jokers.push({
			name: jokerCard.jokerName,
			edition: jokerCard.edition,
			plusChips: jokerCard.plusChips,
			plusMultiplier: jokerCard.plusMultiplier,
			timesMultiplier: jokerCard.timesMultiplier,
			rank: jokerCard.rank,
			suit: jokerCard.suit,
			active: jokerCard.active,
			count: jokerCard.count,
		} satisfies Omit<Required<InitialJoker>, 'index'>)
	}

	for (const playingCard of playingCardContainer.children) {
		if (!(playingCard instanceof PlayingCard)) continue

		initialState.cards.push({
			rank: playingCard.rank,
			suit: playingCard.suit,
			edition: playingCard.edition,
			enhancement: playingCard.enhancement,
			seal: playingCard.seal,
			debuffed: playingCard.debuffed,
			played: playingCard.played,
			count: playingCard.count,
		} satisfies Omit<Required<InitialCard>, 'index'>)
	}

	return getState(initialState)
}

/**
 * Populates the UI using a `State` object. Tries to retrieve this object from the URL or local storage.
 */
function populateUiWithState (state: State) {
	handsInput.value = String(state.hands)
	discardsInput.value = String(state.discards)
	moneyInput.value = String(state.money)
	blindNameInput.value = state.blind.name
	blindIsActiveCheckbox.checked = state.blind.active
	deckInput.value = state.deck
	jokerSlotsInput.value = String(state.jokerSlots)

	for (const observatoryInput of observatoryInputs) {
		const handName = observatoryInput.getAttribute('data-r-observatory-hand') as HandName
		observatoryInput.value = String(state.observatory[handName] ?? 0)
	}

	handLevelContainer.innerHTML = ''
	for (const [handName, handLevel] of Object.entries(state.handLevels)) {
		handLevelContainer.append(
			new HandLevelCard(handName as HandName, handLevel),
		)
	}

	jokerContainer.innerHTML = ''
	for (const joker of state.jokers) {
		addJoker(joker)
	}

	playingCardContainer.innerHTML = ''
	for (const card of state.cards) {
		addPlayingCard(card)
	}

	applyState(state)
}

function addJoker (joker?: Joker) {
	const el = new JokerCard(joker)
	jokerContainer.append(el)
}

function addPlayingCard (card?: Card) {
	const el = new PlayingCard(card)
	playingCardContainer.append(el)
	el.toggleBlindEffects(blindNameInput.value as BlindName, blindIsActiveCheckbox.checked)
}

function duplicate (event: Event) {
	const button = event.currentTarget as HTMLButtonElement
	const dialog = button.closest('dialog')!
	const id = dialog.getAttribute('data-duplicate-target-id') ?? ''
	const card = document.getElementById(id)

	if (card instanceof JokerCard || card instanceof PlayingCard) {
		const input = dialog.querySelector('input')!
		let numberOfCopies = Number(input.value)
		while (numberOfCopies--) {
			const copy = card.clone()
			card.insertAdjacentElement('afterend', copy)
			if (copy instanceof PlayingCard) {
				copy.toggleBlindEffects(blindNameInput.value as BlindName, blindIsActiveCheckbox.checked)
			}
		}
	}

	dialog.close()
	calculate()
}
