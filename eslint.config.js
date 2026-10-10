// Flat config. The game is plain browser scripts (no modules), so this lints for real mistakes only:
// undefined names, duplicate keys, unreachable code, bad regexes. Style is not enforced.
const browser = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'console', 'location', 'history', 'screen', 'fetch', 'Image', 'Audio', 'AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'Event', 'CustomEvent',
  'DOMMatrix', 'DOMParser', 'URL', 'URLSearchParams', 'Blob', 'FileReader', 'XMLHttpRequest', 'speechSynthesis', 'SpeechSynthesisUtterance', 'matchMedia', 'getComputedStyle', 'addEventListener', 'removeEventListener',
  'innerWidth', 'innerHeight', 'devicePixelRatio', 'alert', 'ResizeObserver', 'MutationObserver', 'IntersectionObserver', 'HTMLElement', 'HTMLCanvasElement', 'WebGLRenderingContext', 'WebGL2RenderingContext',
  'Path2D', 'ImageData', 'OffscreenCanvas', 'createImageBitmap', 'AbortController', 'TextEncoder', 'TextDecoder', 'structuredClone', 'queueMicrotask', 'Uint8Array', 'Float32Array', 'Float64Array', 'Int16Array', 'Uint16Array', 'Uint32Array', 'Int32Array', 'Uint8ClampedArray', 'ArrayBuffer', 'DataView'];
const g = o => Object.fromEntries(o.map(n => [n, 'readonly']));
module.exports = [
  { ignores: ['legacy/**', 'assets/**', 'docs/**', 'node_modules/**', 'tools/**', 'tests/**'] },
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: g(browser) },
    rules: { 'no-undef': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-unreachable': 'error', 'no-invalid-regexp': 'error', 'no-redeclare': 'error', 'no-const-assign': 'error', 'no-func-assign': 'error', 'no-self-assign': 'warn', 'no-cond-assign': ['error', 'except-parens'], 'no-unsafe-negation': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-sparse-arrays': 'error', 'no-dupe-else-if': 'error', 'no-loss-of-precision': 'error' }
  },
];
