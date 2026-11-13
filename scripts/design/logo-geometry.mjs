// Construction of the Bidfolio mark, so the path data in src/components/logo.tsx and
// src/app/icon.svg can be regenerated or tuned instead of edited by hand.
//
//   node scripts/design/logo-geometry.mjs
//
// The idea: a folio sheet whose top-left corner is folded over. The corner K is reflected
// across the fold line L–T onto the sheet at V. Because the corner is a right angle, the two
// free edges of the folded flap (V–L short, V–T long) meet at a right angle too — and with the
// long edge twice the short one they are exactly a tick. The tick is left as a gap between the
// flap and the body, so the mark is a single colour.
//
//   K ····T────────╮      sheet: x0..x1 × y0..y1, corner radius r
//   ·   ╱ ╲        │      a = |KL| (down the left edge), b = |KT| (along the top edge)
//   L ╱    ╲       │      g = half the width of the tick gap
//   │╲     ╱       │
//   │  ╲ V         │
//   ╰──────────────╯

const round = (n) => Math.round(n * 1000) / 1000;
const point = (p) => `${round(p[0])} ${round(p[1])}`;
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];

export function mark({ x0, y0, x1, y1, r, a, b, g }) {
  const h2 = a * a + b * b;
  const L = [x0, y0 + a];
  const T = [x0 + b, y0];
  const V = [x0 + (2 * a * a * b) / h2, y0 + (2 * a * b * b) / h2]; // K reflected across L–T
  const u1 = mul(sub(V, L), 1 / a); // along the short arm
  const u2 = mul(sub(T, V), 1 / b); // along the long arm
  const n1 = mul(u2, -1); // normals pointing into the sheet body
  const n2 = u1;

  // Body: the sheet, cut along the tick offset by +g.
  const bodyCorner = add(V, mul(add(n1, n2), g));
  const onLeftEdge = add(add(L, mul(n1, g)), mul(u1, (-g * n1[0]) / u1[0]));
  const onTopEdge = add(add(V, mul(n2, g)), mul(u2, (y0 - V[1] - g * n2[1]) / u2[1]));
  const body =
    `M${point(onTopEdge)}H${round(x1 - r)}a${r} ${r} 0 0 1 ${r} ${r}V${round(y1 - r)}a${r} ${r} 0 0 1-${r} ${r}` +
    `H${round(x0 + r)}a${r} ${r} 0 0 1-${r}-${r}V${round(onLeftEdge[1])}L${point(bodyCorner)}Z`;

  // Flap: the triangle between the fold line and the tick offset by -g.
  const h = Math.sqrt(h2);
  const fold = [b / h, -a / h];
  const meetFold = (p, u) => {
    const det = u[0] * -fold[1] - u[1] * -fold[0];
    const rhs = sub(L, p);
    return add(p, mul(u, (rhs[0] * -fold[1] - rhs[1] * -fold[0]) / det));
  };
  const flapCorner = sub(V, mul(add(n1, n2), g));
  const flap = `M${point(meetFold(sub(L, mul(n1, g)), u1))}L${point(flapCorner)} ${point(meetFold(sub(V, mul(n2, g)), u2))}Z`;

  return body + flap;
}

/** Standard mark on a 24 × 24 grid: use from 20 px upwards. */
export const MARK_24 = mark({ x0: 4, y0: 1, x1: 20, y1: 23, r: 1.5, a: 5, b: 10, g: 1.1 });

/** Small mark on a 16 × 16 grid: edges on whole pixels and a wider tick, for 16–19 px. */
export const MARK_16 = mark({ x0: 3, y0: 1, x1: 13, y1: 15, r: 1, a: 3.75, b: 7.5, g: 0.85 });

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("24 × 24:", MARK_24);
  console.log("16 × 16:", MARK_16);
}
