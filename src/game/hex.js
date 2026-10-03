// Axial coordinates keep terrain[y][x] and mission positions integral.
// The six directions correspond to the six edges returned by hexCorners.
export const HEX_DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const VERTICES = [[2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2]];
export const hexDistance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.y - b.x - b.y));
export const hexNeighbors = ({ x, y }) => HEX_DIRECTIONS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));

export function roundHex(x, y) {
  let q = Math.round(x), r = Math.round(y);
  const s = Math.round(-x - y);
  const dq = Math.abs(q - x), dr = Math.abs(r - y), ds = Math.abs(s + x + y);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { x: q === 0 ? 0 : q, y: r === 0 ? 0 : r };
}

// World coordinates retain the existing +.5 convention for cell centers.
// Integer numerators make shared vertices identical, including negative cells.
export function hexCorners(x, y, inset = 0) {
  return VERTICES.map(([a, b]) => inset === 0
    ? [(6 * x + 3 + 2 * a) / 6, (6 * y + 3 + 2 * b) / 6]
    : [x + .5 + a / 3 * (1 - 2 * inset), y + .5 + b / 3 * (1 - 2 * inset)]);
}

export const hexToPlane = ({ x, y }) => ({ x: x * Math.sqrt(3) / 2, y: y + x / 2 });
export const planeToHex = ({ x, y }) => ({ x: x * 2 / Math.sqrt(3), y: y - x / Math.sqrt(3) });

export function hexContains(x, y, cell) {
  const q = x - cell.x - .5, r = y - cell.y - .5;
  return Math.max(Math.abs(2 * q + r), Math.abs(q + 2 * r), Math.abs(q - r)) <= 1 + 1e-9;
}
