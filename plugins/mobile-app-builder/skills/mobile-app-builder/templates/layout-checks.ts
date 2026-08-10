/**
 * layout-checks.ts — assertions that need no baseline screenshot.
 *
 * This is what makes the loop useful on a brand-new app. `toMatchScreenshot`
 * can only compare against a previous run, so on version 1 of an app it has
 * nothing to say. These checks read the real geometry the browser computed
 * and catch the failures that actually reach users: content pushed off the
 * screen, containers that collapsed to nothing, buttons too small to hit,
 * text clipped mid-word, controls stacked on top of each other.
 *
 * Every rule here is a near-certain defect, not a preference. A check that
 * fires on healthy layouts costs one of the agent's three retries and pushes
 * a working design toward a needlessly simpler one, which is a far worse
 * outcome than missing a subtle bug.
 *
 * Subtrees marked `data-native-stub` (see expo-stubs.tsx) are exempt from
 * content checks — they are placeholders for native controls that don't
 * exist on web — but their boxes still participate in overflow and overlap,
 * so the layout *around* them is fully checked.
 */

export type Violation = {
  check: string;
  message: string;
  element: string;
  rect: { x: number; y: number; width: number; height: number };
};

const MIN_TAP = 44; // Apple HIG / Material minimum touch target, in px.
const EPS = 1;      // sub-pixel rounding slack.

/** A stable, human- and agent-readable handle for an element. */
function describe(el: Element): string {
  const testId = el.getAttribute('data-testid') || el.getAttribute('testID');
  if (testId) return `testID="${testId}"`;
  const role = el.getAttribute('role');
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const parts = [el.tagName.toLowerCase()];
  if (role) parts.push(`role=${role}`);
  if (text) parts.push(`"${text}"`);
  return parts.join(' ');
}

function rectOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) };
}

function inNativeStub(el: Element, root: Element): boolean {
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    if (n.hasAttribute('data-native-stub')) return true;
  }
  return false;
}

/** Does anything between el and root scroll horizontally on purpose? */
function hasHorizontalScroller(el: Element, root: Element): boolean {
  for (let n: Element | null = el.parentElement; n && n !== root.parentElement; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX;
    if (ox === 'auto' || ox === 'scroll') return true;
  }
  return false;
}

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;
  const role = el.getAttribute('role');
  if (role === 'button' || role === 'link' || role === 'switch' || role === 'checkbox') return true;
  // react-native-web renders Pressable/TouchableOpacity as a focusable div.
  return el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';
}

function isVisible(el: Element): boolean {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  return true;
}

function intersects(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > EPS && h > EPS ? w * h : 0;
}

/**
 * Inspect a rendered subtree and return every layout defect found.
 * Empty array means the layout is structurally sound.
 */
export function checkLayout(root: HTMLElement): Violation[] {
  const v: Violation[] = [];
  const push = (check: string, el: Element, message: string) =>
    v.push({ check, message, element: describe(el), rect: rectOf(el) });

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rootRect = root.getBoundingClientRect();

  // 1. Did it render at all? Everything downstream is meaningless otherwise,
  //    so this short-circuits rather than emitting a cascade of noise.
  if (rootRect.width < EPS || rootRect.height < EPS) {
    push('empty-render', root,
      `Root rendered with no size (${rootRect.width}x${rootRect.height}). The screen would appear blank.`);
    return v;
  }

  const all = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(isVisible);

  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < EPS && r.height < EPS) continue; // genuinely empty, not a defect

    const stubbed = inNativeStub(el, root);

    // 2. Horizontal overflow — the classic "half the button is off the edge".
    //    Ignored inside a deliberate horizontal scroller (carousels).
    if (!hasHorizontalScroller(el, root)) {
      if (r.right > vw + EPS) {
        push('overflow-right', el,
          `Extends ${Math.round(r.right - vw)}px past the right edge of a ${vw}px screen.`);
      }
      if (r.left < -EPS) {
        push('overflow-left', el,
          `Starts ${Math.round(-r.left)}px off the left edge of the screen.`);
      }
    }

    // 3. Text that is present in the DOM but occupies no space — a collapsed
    //    parent, almost always position:absolute or a missing flex dimension.
    if (!stubbed) {
      const ownText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => (n.textContent || '').trim())
        .join('');
      if (ownText && (r.width < EPS || r.height < EPS)) {
        push('collapsed-text', el,
          `Has text ("${ownText.slice(0, 30)}") but renders ${r.width}x${r.height} — invisible to the user.`);
      }
      // 4. Text clipped by its container rather than wrapping.
      if (ownText && el.scrollWidth > el.clientWidth + EPS) {
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') {
          push('clipped-text', el,
            `Text is ${el.scrollWidth - el.clientWidth}px wider than its container and is being cut off.`);
        }
      }
    }

    // 5. Tap targets too small to reliably hit with a thumb.
    if (isInteractive(el) && !stubbed) {
      if (r.width < MIN_TAP - EPS || r.height < MIN_TAP - EPS) {
        push('small-tap-target', el,
          `Tappable but only ${Math.round(r.width)}x${Math.round(r.height)}px; needs at least ${MIN_TAP}x${MIN_TAP}.`);
      }
    }
  }

  // 6. Content taller than the screen with nothing to scroll it — the bottom
  //    of the page is simply unreachable on a phone.
  const scrollable = Array.from(root.querySelectorAll<HTMLElement>('*')).some(el => {
    const oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll';
  }) || ['auto', 'scroll'].includes(getComputedStyle(root).overflowY);
  if (!scrollable && root.scrollHeight > vh + EPS) {
    push('unreachable-content', root,
      `Content is ${Math.round(root.scrollHeight)}px tall on a ${vh}px screen with no scroll view — ` +
      `${Math.round(root.scrollHeight - vh)}px is unreachable.`);
  }

  // 7. Two controls on top of each other: whichever is painted second wins
  //    every tap, so one of them is dead.
  const targets = all.filter(el => isInteractive(el) && !inNativeStub(el, root));
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      if (targets[i].contains(targets[j]) || targets[j].contains(targets[i])) continue;
      const a = targets[i].getBoundingClientRect();
      const b = targets[j].getBoundingClientRect();
      const area = intersects(a, b);
      // >25% of the smaller control covered — brushing corners is fine.
      if (area > 0.25 * Math.min(a.width * a.height, b.width * b.height)) {
        v.push({
          check: 'overlapping-controls',
          message: `Overlaps ${describe(targets[j])} — one of the two cannot be tapped.`,
          element: describe(targets[i]),
          rect: rectOf(targets[i]),
        });
      }
    }
  }

  return v;
}

/**
 * Throw a readable, actionable error if the layout is broken.
 * The thrown message is what lands in .claude/visual/last-run.json, so it is
 * written to be acted on directly — element handle, what is wrong, by how much.
 */
export function expectSaneLayout(root: HTMLElement, label: string): void {
  const violations = checkLayout(root);
  if (violations.length === 0) return;
  const lines = violations.map(x => `  [${x.check}] ${x.element} — ${x.message}`);
  throw new Error(
    `LAYOUT_VIOLATIONS in ${label} (${violations.length}):\n${lines.join('\n')}\n` +
    `JSON: ${JSON.stringify(violations)}`,
  );
}
