import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { SpinResult, Wheel, WheelSection } from '@/types/game';
import { SECTION_TYPE_LABELS } from '@/types/game';
import { sectionAngle, sectionAtPointer, sectionBounds, spinEasing, START_ANGLE, TAU } from '@/utils/wheelMath';
import { readableText, shade, withAlpha } from '@/utils/color';

export interface WheelCanvasHandle {
  /** Анимирует барабан до result.targetRotation. Промис резолвится после полной остановки */
  spinTo(result: SpinResult): Promise<void>;
  getRotation(): number;
  isSpinning(): boolean;
}

interface Props {
  wheel: Wheel;
  /** Вызывается, когда штырёк проходит стрелку. speed — рад/с */
  onTick?: (sectionIndex: number, speed: number) => void;
  /** Клик по центральной кнопке барабана */
  onHubClick?: () => void;
  hubLabel?: string;
  /** Подсветить выпавший сектор */
  highlightIndex?: number | null;
  className?: string;
}

/** Размеры в стиле барабана заданы для диаметра 500px и масштабируются */
const REF_SIZE = 500;

type ImageMap = Map<string, HTMLImageElement>;

function useSectionImages(wheel: Wheel): ImageMap {
  const urls = useMemo(() => {
    const set = new Set<string>();
    wheel.sections.forEach((s) => s.image?.url && set.add(s.image.url));
    if (wheel.style.hubImage) set.add(wheel.style.hubImage);
    return [...set];
  }, [wheel]);

  const [images, setImages] = useState<ImageMap>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    urls.forEach((url) => {
      if (images.has(url)) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        if (!cancelled) setImages((prev) => new Map(prev).set(url, img));
      };
      img.src = url;
    });
    return () => {
      cancelled = true;
    };
    // images намеренно не в зависимостях: грузим только новые url
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);

  return images;
}

/* ------------------------------------------------------------------ рисование диска */

function fillFor(ctx: CanvasRenderingContext2D, s: WheelSection, r: number): string | CanvasGradient {
  if (s.fill.kind === 'solid') return s.fill.color;
  const g = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
  g.addColorStop(0, s.fill.from);
  g.addColorStop(1, s.fill.to);
  return g;
}

function baseColor(s: WheelSection) {
  return s.fill.kind === 'solid' ? s.fill.color : s.fill.to;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: number, w: number, center: number) {
  // Система координат: ось -Y направлена от центра к ободу через середину сектора
  ctx.save();
  ctx.rotate(center + Math.PI / 2);
  const hw = w < Math.PI ? r * Math.sin(w / 2) : r;
  const boxW = hw * 2;
  const boxH = r;
  const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, -dw / 2, -r + (boxH - dh) / 2, dw, dh);
  ctx.restore();
}

function renderDisc(wheel: Wheel, radius: number, dpr: number, images: ImageMap): HTMLCanvasElement {
  const { sections, style } = wheel;
  const n = sections.length;
  const w = sectionAngle(n);
  const scale = (radius * 2) / REF_SIZE;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(radius * 2 * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, radius * dpr, radius * dpr);

  const r = radius;

  sections.forEach((s, i) => {
    const { start, end, center } = sectionBounds(i, n);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, end);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = fillFor(ctx, s, r);
    ctx.fillRect(-r, -r, r * 2, r * 2);

    const img = s.image ? images.get(s.image.url) : undefined;
    if (s.image?.mode === 'cover' && img) {
      ctx.globalAlpha = s.image.opacity ?? 1;
      drawCover(ctx, img, r, w, center);
      ctx.globalAlpha = 1;
      // затемнение у обода, чтобы подпись читалась поверх картинки
      const g = ctx.createRadialGradient(0, 0, r * 0.45, 0, 0, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
  });

  // Объём: тень к ободу + мягкий блик сверху
  const depth = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  depth.addColorStop(0, 'rgba(255,255,255,0.10)');
  depth.addColorStop(0.7, 'rgba(0,0,0,0)');
  depth.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = depth;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  // Разделители
  ctx.strokeStyle = style.dividerColor;
  ctx.lineWidth = style.dividerWidth * scale;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = START_ANGLE + i * w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }

  // Подписи и иконки
  sections.forEach((s, i) => {
    const { center } = sectionBounds(i, n);
    const img = s.image ? images.get(s.image.url) : undefined;
    const hasIcon = s.image?.mode === 'icon' && !!img;
    const color = s.textColor ?? readableText(baseColor(s));
    const arcAt = (k: number) => 2 * r * k * Math.sin(Math.min(w, Math.PI) / 2); // хорда на радиусе k·r

    ctx.save();
    if (style.labelOrientation === 'tangential') {
      ctx.rotate(center + Math.PI / 2);
      let y = -r * 0.8;
      if (hasIcon) {
        const sz = Math.min(arcAt(0.84) * 0.55, r * 0.16);
        ctx.drawImage(img!, -sz / 2, -r * 0.92, sz, sz);
        y = -r * 0.62;
      }
      const fs = Math.min(arcAt(0.75) / Math.max(2, s.label.length * 0.62), r * 0.13);
      drawLabel(ctx, s.label, 0, y, fs, style.fontFamily, color, 'center', arcAt(0.7) * 0.9);
    } else {
      ctx.rotate(center);
      let x = r * 0.9;
      if (hasIcon) {
        const sz = Math.min(arcAt(0.8) * 0.6, r * 0.15);
        ctx.save();
        ctx.translate(r * 0.84 - sz / 2, 0);
        ctx.rotate(Math.PI / 2); // верх иконки смотрит наружу
        ctx.drawImage(img!, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
        x = r * 0.84 - sz - r * 0.03;
      }
      // Шрифт ограничен высотой сектора у подписи и общей длиной радиуса
      const fs = Math.min(arcAt(x / r - 0.12) * 0.62, r * 0.14);
      drawLabel(ctx, s.label, x, 0, fs, style.fontFamily, color, 'right', x - r * 0.22);
    }
    ctx.restore();
  });

  // Штырьки на ободе — за них «цепляется» стрелка
  for (let i = 0; i < n; i++) {
    const a = START_ANGLE + i * w;
    const pr = r - 7 * scale;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * pr, Math.sin(a) * pr, 3.2 * scale, 0, TAU);
    ctx.fillStyle = shade(style.dividerColor, -0.15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
  }

  return canvas;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  font: string,
  color: string,
  align: CanvasTextAlign,
  maxWidth: number,
) {
  ctx.font = `900 ${Math.max(8, size)}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.strokeStyle = color === '#111' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  ctx.strokeText(text, x, y, Math.max(10, maxWidth));
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, Math.max(10, maxWidth));
}

/* ------------------------------------------------------------------ компонент */

export const WheelCanvas = forwardRef<WheelCanvasHandle, Props>(function WheelCanvas(
  { wheel, onTick, onHubClick, hubLabel, highlightIndex = null, className },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const images = useSectionImages(wheel);

  const rotation = useRef(0);
  const anim = useRef<{ from: number; to: number; start: number; dur: number; resolve: () => void } | null>(null);
  const pointer = useRef({ angle: 0, vel: 0 });
  const lastIndex = useRef(-1);

  // Актуальные значения для rAF-цикла без его перезапуска
  const live = useRef({ onTick, highlightIndex, hubLabel, hubClickable: !!onHubClick, hovered: false });
  live.current.onTick = onTick;
  live.current.hubClickable = !!onHubClick;
  live.current.highlightIndex = highlightIndex;
  live.current.hubLabel = hubLabel;

  // Размер — по ширине контейнера, квадрат
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.floor(Math.min(e.contentRect.width, 900))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geom = useMemo(() => {
    const scale = size / REF_SIZE;
    // сверху нужен запас под «шляпку» стрелки
    const outer = size / 2 - 14 * scale;
    const rim = wheel.style.rimWidth * scale;
    return { scale, cx: size / 2, cy: size / 2, outer, disc: outer - rim, hub: (outer - rim) * 0.15 };
  }, [size, wheel.style.rimWidth]);

  const disc = useMemo(() => {
    if (!size) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    return renderDisc(wheel, geom.disc, dpr, images);
  }, [wheel, geom.disc, images, size]);

  useImperativeHandle(
    ref,
    () => ({
      spinTo(result) {
        // Если предыдущая анимация не закончилась — завершаем её мгновенно
        anim.current?.resolve();
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const dur = wheel.physics.durationMs * (reduced ? 0.35 : 1);
        return new Promise<void>((resolve) => {
          anim.current = { from: rotation.current, to: result.targetRotation, start: performance.now(), dur, resolve };
        });
      },
      getRotation: () => rotation.current,
      isSpinning: () => anim.current !== null,
    }),
    [wheel.physics.durationMs],
  );

  // Основной цикл отрисовки
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !disc || !size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d')!;
    const { style, sections } = wheel;
    const n = sections.length;
    const { scale, cx, cy, outer, disc: r, hub } = geom;

    let raf = 0;
    let prevTime = performance.now();
    let prevRot = rotation.current;
    lastIndex.current = sectionAtPointer(rotation.current, n);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;

      // --- физика барабана
      const a = anim.current;
      if (a) {
        const t = Math.min(1, (now - a.start) / a.dur);
        rotation.current = a.from + (a.to - a.from) * spinEasing(t);
        if (t >= 1) {
          rotation.current = a.to;
          anim.current = null;
          a.resolve();
        }
      }
      const speed = dt > 0 ? Math.abs(rotation.current - prevRot) / dt : 0;
      prevRot = rotation.current;

      // --- щелчки: сменился сектор под стрелкой → штырёк задел стрелку
      const idx = sectionAtPointer(rotation.current, n);
      if (idx !== lastIndex.current) {
        lastIndex.current = idx;
        const kick = Math.min(0.55, 0.18 + speed * 0.02);
        pointer.current.angle = -Math.max(Math.abs(pointer.current.angle), kick);
        pointer.current.vel = 0;
        live.current.onTick?.(idx, speed);
      }
      // --- пружина стрелки
      const p = pointer.current;
      p.vel += (-260 * p.angle - 18 * p.vel) * dt;
      p.angle += p.vel * dt;
      if (Math.abs(p.angle) < 1e-4 && Math.abs(p.vel) < 1e-3) p.angle = p.vel = 0;

      // --- кадр
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // тень под барабаном
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 30 * scale;
      ctx.shadowOffsetY = 10 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, TAU);
      ctx.fillStyle = style.rimColor;
      ctx.fill();
      ctx.restore();

      // обод
      const rimG = ctx.createLinearGradient(0, cy - outer, 0, cy + outer);
      rimG.addColorStop(0, shade(style.rimColor, 0.35));
      rimG.addColorStop(0.5, style.rimColor);
      rimG.addColorStop(1, shade(style.rimColor, -0.45));
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, TAU);
      ctx.arc(cx, cy, r, 0, TAU, true);
      ctx.fillStyle = rimG;
      ctx.fill('evenodd');

      // диск
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation.current);
      ctx.drawImage(disc, -r, -r, r * 2, r * 2);

      // подсветка выпавшего сектора
      const hi = live.current.highlightIndex;
      if (hi !== null && hi >= 0 && hi < n && !anim.current) {
        const { start, end } = sectionBounds(hi, n);
        const pulse = 0.18 + 0.14 * Math.sin(now / 180);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, start, end);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
        ctx.fill();
        ctx.lineWidth = 4 * scale;
        ctx.strokeStyle = withAlpha(style.lightColor, 0.95);
        ctx.stroke();
      }
      ctx.restore();

      // лампочки
      if (style.showLights) {
        const count = Math.max(24, Math.min(48, n * 2));
        const lr = (outer + r) / 2;
        const spinning = anim.current !== null;
        const phase = Math.floor(now / (spinning ? 90 : 450));
        for (let i = 0; i < count; i++) {
          const ang = START_ANGLE + (i / count) * TAU;
          const lit = spinning ? (i + phase) % 3 === 0 : (i + phase) % 2 === 0;
          const x = cx + Math.cos(ang) * lr;
          const y = cy + Math.sin(ang) * lr;
          const rad = Math.max(2, (outer - r) * 0.22);
          if (lit) {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, rad * 3);
            glow.addColorStop(0, withAlpha(style.lightColor, 0.8));
            glow.addColorStop(1, withAlpha(style.lightColor, 0));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, rad * 3, 0, TAU);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, TAU);
          ctx.fillStyle = lit ? style.lightColor : shade(style.lightColor, -0.55);
          ctx.fill();
        }
      }

      // ступица
      const hubG = ctx.createRadialGradient(cx - hub * 0.3, cy - hub * 0.4, hub * 0.1, cx, cy, hub);
      hubG.addColorStop(0, shade(style.hubColor, 0.55));
      hubG.addColorStop(0.6, style.hubColor);
      hubG.addColorStop(1, shade(style.hubColor, -0.4));
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, hub * (live.current.hovered && live.current.hubClickable ? 1.06 : 1), 0, TAU);
      ctx.fillStyle = hubG;
      ctx.fill();
      ctx.restore();
      const hubImg = style.hubImage ? images.get(style.hubImage) : undefined;
      if (hubImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, hub * 0.85, 0, TAU);
        ctx.clip();
        ctx.drawImage(hubImg, cx - hub * 0.85, cy - hub * 0.85, hub * 1.7, hub * 1.7);
        ctx.restore();
      }
      const label = live.current.hubLabel;
      if (label) {
        ctx.font = `900 ${hub * 0.36}px ${style.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = readableText(style.hubColor);
        ctx.fillText(label, cx, cy, hub * 1.7);
      }

      // стрелка: ось вращения над ободом, кончик входит в диск
      ctx.save();
      const pivotY = cy - outer + 2 * scale;
      ctx.translate(cx, pivotY);
      ctx.rotate(p.angle);
      const len = (outer - r) + 30 * scale;
      const half = 15 * scale;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetY = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(-half, -6 * scale);
      ctx.quadraticCurveTo(0, -14 * scale, half, -6 * scale);
      ctx.lineTo(0, len);
      ctx.closePath();
      const pg = ctx.createLinearGradient(-half, 0, half, 0);
      pg.addColorStop(0, shade(style.pointerColor, 0.3));
      pg.addColorStop(1, shade(style.pointerColor, -0.3));
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeStyle = shade(style.pointerColor, -0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 5 * scale, 0, TAU);
      ctx.fillStyle = shade(style.pointerColor, 0.6);
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [disc, size, geom, wheel, images]);

  // Завершаем незаконченную анимацию при размонтировании, чтобы промисы не висели
  useEffect(() => () => anim.current?.resolve(), []);

  const inHub = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = e.clientX - rect.left - geom.cx;
      const dy = e.clientY - rect.top - geom.cy;
      return Math.hypot(dx, dy) <= geom.hub;
    },
    [geom],
  );

  const description = useMemo(
    () =>
      `Барабан из ${wheel.sections.length} секторов: ` +
      wheel.sections.map((s) => (s.type === 'points' ? s.label : SECTION_TYPE_LABELS[s.type])).join(', '),
    [wheel.sections],
  );

  return (
    <div ref={wrapRef} className={className} style={{ aspectRatio: '1 / 1', width: '100%' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={description}
        // 100% вместо size px: иначе canvas удерживает старую ширину и колонка не может сжаться
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'manipulation' }}
        className={onHubClick ? 'select-none' : undefined}
        onPointerMove={(e) => {
          const h = inHub(e);
          live.current.hovered = h;
          e.currentTarget.style.cursor = h && onHubClick ? 'pointer' : 'default';
        }}
        onPointerLeave={() => (live.current.hovered = false)}
        onClick={(e) => {
          if (onHubClick && inHub(e)) onHubClick();
        }}
      />
    </div>
  );
});
