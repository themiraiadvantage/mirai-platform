import { useEffect, useRef } from "react";

/** Drifting topographic contours that deform away from the pointer. Pauses offscreen. */
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(c);
    const contour = css.getPropertyValue("--primary-bright").trim();
    const gold = css.getPropertyValue("--brand-gold").trim();
    let w = 0,
      h = 0,
      raf = 0,
      visible = true;
    const mouse = { x: -999, y: -999, tx: -999, ty: -999 };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      mouse.tx = e.clientX - r.left;
      mouse.ty = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.tx = -999;
      mouse.ty = -999;
    };
    addEventListener("resize", resize);
    c.parentElement!.addEventListener("pointermove", onMove);
    c.parentElement!.addEventListener("pointerleave", onLeave);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) loop();
    });
    io.observe(c);

    const noise = (x: number, t: number, k: number) =>
      Math.sin(x * 0.004 + t * 0.21 + k) * 22 +
      Math.sin(x * 0.011 - t * 0.13 + k * 1.7) * 9 +
      Math.sin(x * 0.0021 + t * 0.07 + k * 0.4) * 30;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      const lines = Math.ceil(h / 26) + 4;
      for (let i = 0; i < lines; i++) {
        const baseY = i * 26 - 40;
        ctx.beginPath();
        for (let x = -10; x <= w + 10; x += 8) {
          let y = baseY + noise(x, t, i * 0.6);
          const dx = x - mouse.x,
            dy = y - mouse.y,
            d = Math.hypot(dx, dy);
          if (d < 180) {
            const f = (1 - d / 180) ** 2 * 40;
            y += (dy / (d || 1)) * f;
          }
          if (x === -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i % 5 === 0 ? gold : contour;
        ctx.globalAlpha = i % 5 === 0 ? 0.22 : 0.1;
        ctx.lineWidth = i % 5 === 0 ? 1.1 : 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const loop = () => {
      if (!visible) return;
      cancelAnimationFrame(raf);
      draw(reduce ? 0 : performance.now() / 1000);
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener("resize", resize);
      c.parentElement?.removeEventListener("pointermove", onMove);
      c.parentElement?.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}
