/**
 * Camera in world units (1 world unit = 1 tile). Screen mapping:
 *   screen = (world − center) × zoom + viewport / 2
 * Zoom is pixels-per-tile in CSS pixels, so the camera is independent of device pixel ratio.
 */
export interface Camera {
  cx: number;
  cy: number;
  zoom: number;
}

export const ZOOM_MIN = 10;
export const ZOOM_MAX = 220;

export class CameraController {
  cam: Camera = { cx: 0, cy: 0, zoom: 48 };
  vw = 1;
  vh = 1;
  mapW = 1;
  mapH = 1;

  setViewport(w: number, h: number) {
    this.vw = Math.max(1, w);
    this.vh = Math.max(1, h);
  }

  setMap(w: number, h: number) {
    this.mapW = w;
    this.mapH = h;
  }

  fitZoom(): number {
    const pad = 0.92;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min((this.vw * pad) / this.mapW, (this.vh * pad) / this.mapH)));
  }

  fit() {
    this.cam = { cx: this.mapW / 2, cy: this.mapH / 2, zoom: this.fitZoom() };
  }

  center() {
    this.cam.cx = this.mapW / 2;
    this.cam.cy = this.mapH / 2;
  }

  reset() {
    this.cam = { cx: this.mapW / 2, cy: this.mapH / 2, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.fitZoom() * 1.4)) };
  }

  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.cam.cx) * this.cam.zoom + this.vw / 2, (wy - this.cam.cy) * this.cam.zoom + this.vh / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.vw / 2) / this.cam.zoom + this.cam.cx, (sy - this.vh / 2) / this.cam.zoom + this.cam.cy];
  }

  /** Zoom keeping the world point under (sx, sy) fixed. */
  zoomAt(factor: number, sx: number, sy: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.cam.zoom * factor));
    const [nx, ny] = this.toWorld(sx, sy);
    this.cam.cx += wx - nx;
    this.cam.cy += wy - ny;
    this.clamp();
  }

  pan(dxScreen: number, dyScreen: number) {
    this.cam.cx -= dxScreen / this.cam.zoom;
    this.cam.cy -= dyScreen / this.cam.zoom;
    this.clamp();
  }

  /** Keep part of the map in view so it can never be lost off-screen. */
  clamp() {
    const mx = this.mapW * 0.5 + this.vw / this.cam.zoom / 2 - 1;
    const my = this.mapH * 0.5 + this.vh / this.cam.zoom / 2 - 1;
    this.cam.cx = Math.max(this.mapW / 2 - mx, Math.min(this.mapW / 2 + mx, this.cam.cx));
    this.cam.cy = Math.max(this.mapH / 2 - my, Math.min(this.mapH / 2 + my, this.cam.cy));
  }

  /** Visible tile range (culling). */
  visible(): { x0: number; y0: number; x1: number; y1: number } {
    const [ax, ay] = this.toWorld(0, 0);
    const [bx, by] = this.toWorld(this.vw, this.vh);
    return {
      x0: Math.max(0, Math.floor(ax)), y0: Math.max(0, Math.floor(ay)),
      x1: Math.min(this.mapW - 1, Math.ceil(bx)), y1: Math.min(this.mapH - 1, Math.ceil(by)),
    };
  }
}
