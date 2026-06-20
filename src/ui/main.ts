import { init } from './UiState.ts'
import { initAnimations } from './animations.ts'

// Kick off GSAP loading (fire-and-forget; the calculator works even if it never loads). The arcade
// theme is entirely hand-written CSS, so no utility-class framework is loaded at runtime — that
// keeps interaction snappy (no global DOM-mutation observer re-scanning the page on every edit).
initAnimations()

init()
