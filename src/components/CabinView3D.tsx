// The live 3D view on the cabin screen: where everyone is. It follows the cabin screen's rule, so only critical
// alerts and help calls show; cautions and warnings stay private. Falls back to the 2D map without WebGL.

import { Component, lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import type { AstronautId } from '../domain/crew';
import { useSimFull } from '../lib/simFull';
import { useInView } from '../lib/useInView';
import { HealthCard } from './HealthCard';
import { usePinchZoom } from '../lib/usePinchZoom';

const Sim3D = lazy(() => import('../three/Sim3D'));

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CabinView3D({ fallback, foreground = false }: { fallback: ReactNode; foreground?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const visible = useInView(box);
  // While the simulation is in full screen this page view is hidden behind it, so it pauses.
  const simFull = useSimFull();
  const zoom = useRef(1);
  usePinchZoom(box, zoom);
  const [selected, setSelected] = useState<AstronautId | null>(null);
  return (
    <div ref={box} className="cabin__3d">
      <Fallback fallback={fallback}>
        <Suspense fallback={fallback}>
          <Sim3D
            mode="cabin"
            active={visible && (foreground || !simFull)}
            zoom={zoom}
            selected={selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
            focusScreen={false}
          />
        </Suspense>
      </Fallback>
      {!selected && <span className="cabin__3d-label">Crew locations · live 3D · tap a crew member</span>}
      {selected && <HealthCard key={selected} id={selected} mode="cabin" onClose={() => setSelected(null)} />}
    </div>
  );
}
