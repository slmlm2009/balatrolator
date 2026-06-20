import { init } from './UiState.ts'
import { initAnimations } from './animations.ts'
import { loadTailwind } from './vendor.ts'

// Kick off the additive runtime libraries. None of these block the calculator: if a CDN is
// unreachable the core app still works, just without the animation/utility-class flourishes.
initAnimations()
void loadTailwind()

init()
