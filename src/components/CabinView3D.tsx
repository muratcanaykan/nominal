// The live 3D view on the cabin screen: where everyone is. It follows the cabin screen's rule, so only critical
// alerts and help calls show; cautions and warnings stay private. Falls back to the 2D map without WebGL.

import { Component, lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import type { AstronautId } from '../domain/crew';
import { useInView } from '../lib/useInView';

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

export function CabinView3D({ fallback }: { fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const visible = useInView(box);
  const zoom = useRef(1);
  const [selected, setSelected] = useState<AstronautId | null>(null);
  return (
    <div ref={box} className="cabin__3d">
      <Fallback fallback={fallback}>
        <Suspense fallback={fallback}>
          <Sim3D
            mode="cabin"
            active={visible}
            zoom={zoom}
            selected={selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
            focusScreen={false}
          />
        </Suspense>
      </Fallback>
      <span className="cabin__3d-label">Crew locations · live 3D</span>
      {selected && (
        <button className="cabin__3d-reset" onClick={() => setSelected(null)}>
          Whole vehicle
        </button>
      )}
    </div>
  );
}
