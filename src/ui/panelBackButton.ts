/**
 * Makes the in-app / Android back gesture close an open panel (drawer, combo-box dropdown, or modal)
 * before it closes the whole app.
 *
 * Every dismissable surface here uses the Popover API, and Storage.ts mirrors the live hand into the
 * URL with replaceState — so the history stack normally stays a single entry. In a Trusted Web Activity
 * (the Android APK wrapper) the system back is delivered to the page as a history navigation; with
 * nothing to go back to it closes the app, even while a panel is open.
 *
 * Fix: push one throwaway history entry while any popover is open, and on `popstate` (back) close the
 * open popover(s) instead of letting the navigation through. When the last popover closes by any other
 * means (the X button, light-dismiss, Escape) the throwaway entry is removed again, so a later back
 * press still exits cleanly — no stale entry, no double-press.
 */

const PANEL_HISTORY_STATE = 'balatrolator-panel'

let guardActive = false
let ignoreNextPopstate = false

function anyPopoverOpen (): boolean {
	return document.querySelector(':popover-open') !== null
}

function closeOpenPopovers (): void {
	for (const element of document.querySelectorAll<HTMLElement>(':popover-open')) {
		try {
			element.hidePopover()
		} catch {
			// Element was already closed (or isn't a popover) — nothing to do.
		}
	}
}

export function setupPanelBackButton (): void {
	if (typeof window === 'undefined' || !('hidePopover' in HTMLElement.prototype)) {
		return
	}

	// `toggle` doesn't bubble, but a capturing listener still receives it on the way down to the target.
	document.addEventListener('toggle', (event) => {
		const target = event.target
		if (!(target instanceof HTMLElement) || !target.hasAttribute('popover')) {
			return
		}

		if ((event as ToggleEvent).newState === 'open') {
			if (!guardActive) {
				history.pushState({ [PANEL_HISTORY_STATE]: true }, '')
				guardActive = true
			}
		} else if (guardActive && !anyPopoverOpen()) {
			// Last panel closed by something other than back: consume our throwaway history entry.
			guardActive = false
			ignoreNextPopstate = true
			history.back()
		}
	}, true)

	window.addEventListener('popstate', () => {
		if (ignoreNextPopstate) {
			ignoreNextPopstate = false
			return
		}

		if (!anyPopoverOpen()) {
			// Nothing open: let the navigation through (closes the app in a TWA).
			return
		}

		// Back was pressed while a panel is open: our throwaway entry was just popped, so close the
		// panel rather than letting the app exit.
		guardActive = false
		closeOpenPopovers()

		// Re-guard if something is still open (e.g. a popover nested inside another).
		if (anyPopoverOpen()) {
			history.pushState({ [PANEL_HISTORY_STATE]: true }, '')
			guardActive = true
		}
	})
}
