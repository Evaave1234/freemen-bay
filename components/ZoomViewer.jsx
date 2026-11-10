"use client";
import { useEffect, useRef } from "react";

/** Full-screen picture that can be pinched, scrolled, dragged and double-tapped to zoom. */
export default function ZoomViewer({ src, alt, onClose }) {
  const viewer = useRef(null);
  const img = useRef(null);
  const st = useRef({ s: 1, x: 0, y: 0, last: null, pinch: null, lastTap: 0, pts: new Map() });

  const apply = () => {
    const { s, x, y } = st.current;
    if (img.current) img.current.style.transform = `translate(${x}px,${y}px) scale(${s})`;
  };
  const zoomAt = (ns, cx, cy) => {
    const c = st.current, r = viewer.current.getBoundingClientRect();
    const px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
    ns = Math.min(6, Math.max(1, ns));
    const ix = (px - c.x) / c.s, iy = (py - c.y) / c.s;
    c.s = ns; c.x = px - ix * ns; c.y = py - iy * ns;
    if (ns === 1) { c.x = 0; c.y = 0; }
    apply();
  };
  const center = () => {
    const r = viewer.current.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const reset = () => { Object.assign(st.current, { s: 1, x: 0, y: 0 }); apply(); };

  useEffect(() => {
    const v = viewer.current, c = st.current;
    const down = (e) => {
      try { v.setPointerCapture(e.pointerId); } catch (_) {}
      c.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.last = { x: e.clientX, y: e.clientY };
      if (c.pts.size === 2) {
        const [a, b] = [...c.pts.values()];
        c.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: c.s };
      } else if (c.pts.size === 1) {
        const now = Date.now();
        if (now - c.lastTap < 300) { zoomAt(c.s > 1.05 ? 1 : 2.5, e.clientX, e.clientY); c.lastTap = 0; }
        else c.lastTap = now;
      }
    };
    const move = (e) => {
      if (!c.pts.has(e.pointerId)) return;
      c.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (c.pts.size >= 2 && c.pinch) {
        const [a, b] = [...c.pts.values()];
        zoomAt((c.pinch.s * Math.hypot(a.x - b.x, a.y - b.y)) / c.pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      } else if (c.pts.size === 1 && c.s > 1 && c.last) {
        c.x += e.clientX - c.last.x; c.y += e.clientY - c.last.y; apply();
      }
      c.last = { x: e.clientX, y: e.clientY };
    };
    const up = (e) => {
      c.pts.delete(e.pointerId);
      if (c.pts.size < 2) c.pinch = null;
      c.last = c.pts.size ? [...c.pts.values()][0] : null;
    };
    const wheel = (e) => { e.preventDefault(); zoomAt(c.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    v.addEventListener("pointerdown", down);
    v.addEventListener("pointermove", move);
    v.addEventListener("pointerup", up);
    v.addEventListener("pointercancel", up);
    v.addEventListener("wheel", wheel, { passive: false });
    document.addEventListener("keydown", key);
    return () => {
      v.removeEventListener("pointerdown", down);
      v.removeEventListener("pointermove", move);
      v.removeEventListener("pointerup", up);
      v.removeEventListener("pointercancel", up);
      v.removeEventListener("wheel", wheel);
      document.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mapov" role="dialog" aria-modal="true" aria-label="How to find the stadium">
      <div className="mapbar">
        <span>How to find the stadium<span className="zh-i">怎么找到球馆</span></span>
        <button className="mapclose" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="viewer" ref={viewer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={src} alt={alt} />
      </div>
      <div className="hint">Pinch or scroll to zoom · drag to move · double-tap to zoom<span className="zh-i">双指或滚轮缩放 · 拖动移动 · 双击放大</span></div>
      <div className="zoombar">
        <button onClick={() => zoomAt(st.current.s / 1.5, ...center())} aria-label="Zoom out">−</button>
        <button onClick={reset} aria-label="Reset">1:1</button>
        <button onClick={() => zoomAt(st.current.s * 1.5, ...center())} aria-label="Zoom in">+</button>
      </div>
    </div>
  );
}
