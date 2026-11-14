// The 3D mission simulation with its controls, a full-screen mode and the cabin screen that opens from inside the
// 3D vehicle.

import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AstronautId } from '../domain/crew';
import { setSimFull } from '../lib/simFull';
import { useInView } from '../lib/useInView';
import { clampZoom, usePinchZoom } from '../lib/usePinchZoom';
import { useNow } from '../lib/useRoom';
import { CabinScreen } from './CabinScreen';
import { SimPanel } from './SimPanel';

// three.js is large: load the 3D view only when the page needs it.
const Sim3D = lazy(() => import('../three/Sim3D'));

class SimBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return <div className="sim3d__fallback">The 3D view could not start in this browser (WebGL is needed). The controls beside it still work.</div>;
    }
    return this.props.children;
  }
}

function CabinOverlay({ viewer, onClose }: { viewer: AstronautId; onClose: () => void }) {
  const now = useNow(250);
  return (
    <div className="sim3d__overlay" role="dialog" aria-label="Cabin screen">
      <div className="sim3d__overlay-inner">
        <button className="drawer__close sim3d__overlay-close" onClick={onClose} aria-label="Close the cabin screen">
          ✕
        </button>
        <CabinScreen now={now} viewer={viewer} foreground />
      </div>
    </div>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

export function SimSection({ viewer }: { viewer: AstronautId }) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const zoom = useRef(1);
  usePinchZoom(view, zoom);
  const [target, setTarget] = useState<AstronautId | null>(null);
  const [focusScreen, setFocusScreen] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  // Native full screen where the browser supports it; otherwise (iPhone) the view covers the page.
  const [nativeFull, setNativeFull] = useState(false);
  const [coverFull, setCoverFull] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const full = nativeFull || coverFull;
  const onScreen = useInView(box);
  useEffect(() => {
    setSimFull(full);
    return () => setSimFull(false);
  }, [full]);
  const openTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onChange = () => setNativeFull(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const closeScreen = useCallback(() => {
    window.clearTimeout(openTimer.current);
    setScreenOpen(false);
    setFocusScreen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (screenOpen || focusScreen) closeScreen();
      else if (coverFull) setCoverFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenOpen, focusScreen, coverFull, closeScreen]);

  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  // The page behind must not scroll while the cabin window (or the page-covering full screen) is open.
  const lockScroll = screenOpen || coverFull;
  useEffect(() => {
    if (!lockScroll) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [lockScroll]);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    // The wheel (or a trackpad pinch) zooms whenever the pointer is over the 3D view.
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.sim3d__overlay')) return;
      e.preventDefault();
      zoom.current = clampZoom(zoom.current * Math.exp(e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    zoom.current = clampZoom(zoom.current * factor);
  };

  const toggleFull = async () => {
    if (full) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setCoverFull(false);
      return;
    }
    const el = box.current;
    if (el?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall back to covering the page */
      }
    }
    setCoverFull(true);
  };

  // The camera flies to the screen first, then the full cabin screen opens in front of the 3D view.
  const onScreenClick = () => {
    setFocusScreen(true);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setScreenOpen(true), 900);
  };

  return (
    <div ref={box} className={`sim3d${full ? ' is-full' : ''}${coverFull ? ' is-cover' : ''}${full && !panelOpen ? ' is-panel-hidden' : ''}`}>
      <div
        ref={view}
        className="sim3d__view"
      >
        <SimBoundary>
          <Suspense fallback={<div className="sim3d__loading">Loading the 3D simulation…</div>}>
            <Sim3D
              selected={target}
              onSelect={(id) => {
                closeScreen();
                setTarget(id);
              }}
              focusScreen={focusScreen}
              onScreenClick={onScreenClick}
              zoom={zoom}
              // While the cabin screen is open in front, its own 3D view runs and this one pauses (only one renders).
              active={(onScreen || full) && !screenOpen}
              quality={full ? 'light' : 'normal'}
            />
          </Suspense>
        </SimBoundary>
        <p className="sim3d__hint">
          Drag to rotate · Scroll to zoom · Click the cabin screen or an astronaut ·
          Astronaut model: NASA 3D Resources · Simulated data
        </p>
        <div className="sim3d__buttons">
          {full && (
            <button className="sim3d__btn" onClick={() => setPanelOpen((o) => !o)} aria-pressed={panelOpen}>
              {panelOpen ? 'Hide controls' : 'Controls'}
            </button>
          )}
          <div className="sim3d__zoom" role="group" aria-label="Zoom">
            <button className="sim3d__btn sim3d__btn--icon" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom in">
              +
            </button>
            <button className="sim3d__btn sim3d__btn--icon" onClick={() => zoomBy(1.3)} aria-label="Zoom out">
              −
            </button>
          </div>
          <button className="sim3d__btn" onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'}>
            <FullscreenIcon exit={full} />
            <span>{full ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </div>
        {screenOpen && <CabinOverlay viewer={viewer} onClose={closeScreen} />}
      </div>
      <SimPanel
        target={target}
        onTarget={(id) => {
          closeScreen();
          setTarget(id);
        }}
      />
    </div>
  );
}
