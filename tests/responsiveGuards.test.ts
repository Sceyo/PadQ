/**
 * PadQ responsive guards (ported from Watch Cebu's responsiveGuards.test.ts, then hardened).
 * Static checks read the CSS and TSX; they are cheap guards, not proof of how the page looks.
 * "TARGET" guards describe the remodel and are it.fails until the remodel makes them true:
 * flip each to it() in the commit that makes it pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..');
const walk = (dir: string, ext: string[]): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n === '.next') return [];
    return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : [];
  });

type Rule = { selector: string; body: string; media: string };
function parse(css: string, media = ''): Rule[] {
  const out: Rule[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const selector = src.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < src.length && depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
    const body = src.slice(open + 1, j - 1);
    if (selector.startsWith('@media') || selector.startsWith('@supports')) out.push(...parse(body, selector));
    else if (!selector.startsWith('@')) out.push({ selector, body, media });
    i = j;
  }
  return out;
}
const decls = (body: string) =>
  body.split(';').map((d) => d.split(':')).filter((p) => p.length >= 2)
    .map((p) => [p[0].trim().toLowerCase(), p.slice(1).join(':').trim().toLowerCase()] as const);
const px = (v: string, rootPx = 16) => {
  const m = v.match(/^(-?[\d.]+)(px|rem)\b/);
  return m ? parseFloat(m[1]) * (m[2] === 'rem' ? rootPx : 1) : null;
};

const cssFiles = walk(join(ROOT, 'app/queue'), ['.css']);
const css = cssFiles.map((f) => readFileSync(f, 'utf-8')).join('\n');
const rules = parse(css);

function luminance(hex: string) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe('CURRENT guards (pass today, must keep passing)', () => {
  it('score player names on the main scoreboard never use nowrap + ellipsis', () => {
    const bad = rules.filter((r) => /score-player-name/.test(r.selector) && !/viewer/.test(r.selector))
      .filter((r) => { const d = decls(r.body); return d.some(([k, v]) => k === 'white-space' && v.startsWith('nowrap')) && d.some(([k, v]) => k === 'text-overflow' && v.startsWith('ellipsis')); })
      .map((r) => r.selector);
    expect(bad).toEqual([]);
  });
  it('contrast is computed, not assumed (WCAG 4.5:1 for normal text)', () => {
    const pairs: Array<[string, string, string]> = [
      ['white on accent', '#ffffff', '#5457e0'], ['muted on card', '#94a3b8', '#131726'],
      ['team A on card', '#4ade80', '#131726'], ['team B on card', '#60a5fa', '#131726'],
    ];
    const low = pairs.filter(([, f, b]) => contrast(f, b) < 4.5).map(([n]) => n);
    expect(low).toEqual([]);
    expect(contrast('#ffffff', '#6366f1')).toBeLessThan(4.5); // why the old accent was replaced
  });
});

describe('TARGET guards (it.fails until the remodel; offenders are printed on failure)', () => {
  it.fails('spectator scoreboard names also wrap (no nowrap + ellipsis on .scoreboard--viewer)', () => {
    const bad = rules.filter((r) => /score-player-name/.test(r.selector) && /viewer/.test(r.selector))
      .filter((r) => { const d = decls(r.body); return d.some(([k, v]) => k === 'white-space' && v.startsWith('nowrap')) && d.some(([k, v]) => k === 'text-overflow' && v.startsWith('ellipsis')); })
      .map((r) => r.selector);
    expect(bad).toEqual([]);
  });
  it.fails('prefers-reduced-motion is honoured', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
  it.fails('one breakpoint family: only 768 and 1024 media widths', () => {
    const widths = [...new Set([...css.matchAll(/@media[^{]*?(?:min|max)-width:\s*(\d+)px/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    expect(widths.filter((w) => w !== 768 && w !== 1024)).toEqual([]);
  });
  it.fails('no 100vh without a dvh declaration in the same rule', () => {
    const bad = rules.filter((r) => /100vh/.test(r.body) && !/dvh/.test(r.body)).map((r) => r.selector);
    expect(bad).toEqual([]);
  });
  it.fails('text inputs are at least 16px (stops iOS zoom)', () => {
    const bad = rules.filter((r) => /(^|[\s,>])(input|textarea|select)\b|input/.test(r.selector))
      .filter((r) => { const f = decls(r.body).find(([k]) => k === 'font-size'); const v = f ? px(f[1]) : null; return v !== null && v < 16; })
      .map((r) => r.selector);
    expect(bad).toEqual([]);
  });
  it.fails('z-index values come from the scale (0, 100, 200, 1000, 1100, 1200; local stacking <= 10)', () => {
    const allowed = new Set([0, 100, 200, 1000, 1100, 1200]);
    const bad = rules.flatMap((r) => decls(r.body).filter(([k, v]) => k === 'z-index' && /^-?\d+$/.test(v) && Math.abs(Number(v)) > 10 && !allowed.has(Number(v))).map(([, v]) => `${r.selector} z-index:${v}`));
    expect(bad).toEqual([]);
  });
  it.fails('button-like classes are at least 44px tall and wide', () => {
    const bad = rules.filter((r) => /btn|button/.test(r.selector) && !/:hover|:active|::|\.icon\b/.test(r.selector))
      .flatMap((r) => {
        const d = decls(r.body); const out: string[] = [];
        for (const key of ['height', 'width', 'min-height', 'min-width']) {
          const f = d.find(([k]) => k === key); const v = f ? px(f[1]) : null;
          if (v !== null && v < 44 && !(key.startsWith('min') ? false : d.some(([k, x]) => k === `min-${key}` && (px(x) ?? 0) >= 44))) out.push(`${r.selector} ${key}:${v}`);
        }
        return out;
      });
    expect(bad).toEqual([]);
  });
  it.fails('app declares viewport-fit=cover and a theme color', () => {
    const layout = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf-8');
    expect(layout).toMatch(/viewportFit:\s*['"]cover['"]/);
    expect(layout).toMatch(/themeColor/);
  });
  it.fails('banned vocabulary does not appear in player-facing strings', () => {
    const banned = /(Sit Out|Sit out|Mark absent|Sit Next|Form Teams)/;
    const files = walk(join(ROOT, 'app'), ['.tsx']).filter((f) => !f.endsWith('.test.tsx'));
    const bad = files.flatMap((f) => readFileSync(f, 'utf-8').split('\n').map((l, i) => ({ l, i }))
      .filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/^\s*(import|const|let|function|export)\b/.test(l)
        && (/(>[^<>{}]*|aria-label="[^"]*|title="[^"]*)(Sit Out|Sit out|Mark absent|Sit Next|Form Teams)/.test(l)))
      .map(({ i }) => `${f.replace(ROOT, '')}:${i + 1}`));
    expect(bad).toEqual([]);
  });
});
