/**
 * Test bootstrap. Runs before every visual check file.
 *
 * Its whole job is removing sources of run-to-run difference, so a failed
 * screenshot comparison means "the layout changed", never "the machine was
 * busy" or "a font arrived late". Flaky failures are worse than no checks
 * here: each one burns one of the agent's three retries and pushes a working
 * design toward a needlessly simpler one.
 */
import { beforeEach, afterEach } from 'vitest';
import { cleanup } from 'vitest-browser-react';

// Kill animation and transition time. Playwright also freezes animations for
// screenshots, but the layout assertions read geometry *before* the
// screenshot, and a mid-flight transition would give them wrong numbers.
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html, body, #root { margin: 0; padding: 0; }
  body { background: #fff; }
`;
document.head.appendChild(style);

beforeEach(async () => {
  // A screenshot taken before webfonts land measures fallback-font metrics,
  // which differ enough to fail a comparison against a run where they landed.
  if (document.fonts?.ready) await document.fonts.ready;
});

afterEach(() => {
  cleanup();
});
