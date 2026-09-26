import { project } from './projection.js';

export function createPainter(ctx, view) {
  const scale = view.scale;
  const p = (x, y, z = 0) => project(view, x, y, z);
  function polygon(points, fill, stroke, width = .7) {
    ctx.beginPath();
    points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width * scale; ctx.stroke(); }
  }
  function line(a, b, color, width = 1) {
    ctx.beginPath();ctx.moveTo(a.x, a.y);ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;ctx.lineWidth = width * scale;ctx.stroke();
  }
  function tile(x, y, fill, stroke, inset = 0, z = 0, width = .7) {
    polygon([[x + inset, y + inset], [x + 1 - inset, y + inset],
      [x + 1 - inset, y + 1 - inset], [x + inset, y + 1 - inset]].map(([a, b]) => p(a, b, z)), fill, stroke, width);
  }
  return { ctx, view, scale, p, polygon, line, tile };
}
