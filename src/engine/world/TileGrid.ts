/** Grid index helpers. Tiles are stored row-major: index = y * w + x. */
export const idx = (x: number, y: number, w: number) => y * w + x;
export const xy = (i: number, w: number): [number, number] => [i % w, Math.floor(i / w)];
export const inBounds = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x < w && y < h;

export function neighbors4(i: number, w: number, h: number): number[] {
  const [x, y] = xy(i, w);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < w - 1) out.push(i + 1);
  if (y > 0) out.push(i - w);
  if (y < h - 1) out.push(i + w);
  return out;
}

export function rectTiles(x: number, y: number, rw: number, rh: number, w: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) out.push(idx(x + i, y + j, w));
  return out;
}

/** Tiles orthogonally adjacent to a rectangle (excluding the rectangle itself). */
export function rectBorder(x: number, y: number, rw: number, rh: number, w: number, h: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < rw; i++) {
    if (y > 0) out.push(idx(x + i, y - 1, w));
    if (y + rh < h) out.push(idx(x + i, y + rh, w));
  }
  for (let j = 0; j < rh; j++) {
    if (x > 0) out.push(idx(x - 1, y + j, w));
    if (x + rw < w) out.push(idx(x + rw, y + j, w));
  }
  return out;
}
