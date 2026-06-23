/**
 * Makes the in-app / Android back gesture close an open panel before it closes the whole app.
 *
 * "Panel" covers every dismissable surface:
 *   - Popover API elements: the drawers (hand levels, planets, saves, log) and the blind/deck combo-box
 *     dropdowns.
 *   - The joker / playing-card editor sheets ("property boxes"), which are shown by toggling a
 *     `--editing` class on the card rather than via the Popover API, so they need a MutationObserver to
 *     be noticed (a class change fires no event).
 *
 * Storage.ts mirrors the live hand into the URL with replaceState, so the history stack normally stays
 * a single entry. In a Trusted Web Activity (the Android APK wrapper) the system back is delivered to
 * the page as a history navigation; with nothing to go back to it closes the app, even while a panel is
 * open.
 *
 * Fix: keep exactly one throwaway history entry while any panel is open, and on `popstate` (back) close
 * the open panel(s) instead of letting the navigation through. The entry is removed again when the last
 * panel closes by any other means (Done/X button, light-dismiss, Escape), so a later back press still
 * exits cleanly — no stale entry, no double-press.
 */

const PANEL_HISTORY_STATE = 'balatrolator-panel'
const OPEN_PANEL_SELECTOR = ':popover-open, .card.--editing'

let guardActive = false
let ignoreNextPopstate = false

function isPanelOpen (): boolean {
	return document.querySelector(OPEN_PANEL_SELECTOR) !== null
}

function closeOpenPanels (): void {
	for (const element of document.querySelectorAll<HTMLElement>(':popover-open')) {
		try {
			element.hidePopover()
		} catch {
			// Already closed / not a popover — ignore.
		}
	}
	for (const card of document.querySelectorAll('.card.--editing')) {
		card.classList.remove('--editing')
	}
}

// Push or drop the single throwaway history entry to match whether a panel is currently open.
function syncHistoryGuard (): void {
	if (isPanelOpen()) {
		if (!guardActive) {
			history.pushState({ [PANEL_HISTORY_STATE]: true }, '')
			guardActive = true
		}
	} else if (guardActive) {
		// Last panel closed by something other than back: consume our throwaway entry.
		guardActive = false
		ignoreNextPopstate = true
		history.back()
	}
}

export function setupPanelBackButton (): void {
	if (typeof window === 'undefined' || !('hidePopover' in HTMLElement.prototype)) {
		return
	}

	// Popovers fire `toggle` (which doesn't bubble — a capturing listener still receives it).
	document.addEventListener('toggle', (event) => {
		const target = event.target
		if (target instanceof HTMLElement && target.hasAttribute('popover')) {
			syncHistoryGuard()
		}
	}, true)

	// Card editor sheets open/close by toggling `--editing`; watch the trays for that class change.
	const editorObserver = new MutationObserver(syncHistoryGuard)
	for (const tray of document.querySelectorAll('[data-j-container], [data-c-container]')) {
		editorObserver.observe(tray, { subtree: true, attributes: true, attributeFilter: ['class'] })
	}

	window.addEventListener('popstate', () => {
		if (ignoreNextPopstate) {
			ignoreNextPopstate = false
			return
		}

		if (!isPanelOpen()) {
			// Nothing open: let the navigation through (closes the app in a TWA).
			return
		}

		// Back was pressed while a panel is open: our throwaway entry was just popped, so close the
		// panel(s) rather than letting the app exit. Drop the guard first so the toggle/mutation
		// callbacks triggered by closing don't queue another back navigation.
		guardActive = false
		closeOpenPanels()

		// Re-guard if something is still open (e.g. a popover nested inside another).
		if (isPanelOpen()) {
			history.pushState({ [PANEL_HISTORY_STATE]: true }, '')
			guardActive = true
		}
	})
}
