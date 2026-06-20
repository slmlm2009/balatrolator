import { init } from './UiState.ts'

// No runtime libraries are loaded at startup: animations use the native Web Animations API and the
// theme is hand-written CSS. SortableJS (desktop drag-reorder only) is loaded lazily from within
// init(). This keeps first paint and first interaction free of CDN load/parse/init cost.
init()
