/**
 * Makes the in-app / Android back gesture close an open panel before it closes the whole app.
 *
 * "Panel" covers every dismissable surface, each of which opens a different way:
 *   - Popover API elements (`:popover-open`): the drawers (hand levels, planets, saves, log) and the
 *     blind/deck combo-box dropdowns. These fire a `toggle` event.
 *   - The joker / playing-card editor sheets ("property boxes"), shown by toggling a `--editing` class
 *     on the card. A class change fires no event, so a MutationObserver notices it.
 *   - The duplicate-card modals (`dialog[open]`), shown via `dialog.showModal()`. Setting the `open`
 *     attribute fires no event either, so the same MutationObserver watches for it.
 *
 * Storage.ts mirrors the live hand into the URL with replaceState, so the history stack normally stays
 * a single entry. In a Trusted Web Activity (the Android APK wrapper) the system back is delivered to
 * the page as a history navigation; with nothing to go back to it closes the app, even while a panel is
 * open.
 *
 * Fix: keep exactly one throwaway history entry while any panel is open, and on `popstate` (back) close
 * the open panel(s) instead of letting the navigation through. The entry is removed again when the last
 * panel closes by any other means (Done/X/Duplicate button, light-dismiss, Escape), so a later back
 * press still exits cleanly — no stale entry, no double-press.
 */

const PANEL_HISTORY_STATE = 'balatrolator-panel'
const OPEN_PANEL_SELECTOR = ':popover-open, .card.--editing, dialog[open]'

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
	for (const dialog of document.querySelectorAll('dialog')) {
		if (dialog.open) {
			dialog.close()
		}
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

	// Editor sheets toggle a `--editing` class; modal dialogs toggle their `open` attribute. Neither
	// fires an event a listener can catch, so observe those attribute changes directly.
	const panelObserver = new MutationObserver(syncHistoryGuard)
	for (const tray of document.querySelectorAll('[data-j-container], [data-c-container]')) {
		panelObserver.observe(tray, { subtree: true, attributes: true, attributeFilter: ['class'] })
	}
	for (const dialog of document.querySelectorAll('dialog')) {
		panelObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] })
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
