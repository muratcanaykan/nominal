import { useLocation } from 'react-router';
import type { Variant } from '../components/bits';

/** Visual direction used until the team picks one. Any page can be previewed with ?style=mission|glass|suit. */
export const DEFAULT_VARIANT: Variant = 'glass';

const VARIANTS: Variant[] = ['mission', 'glass', 'suit'];

export function useVariant(): Variant {
  const { search } = useLocation();
  const style = new URLSearchParams(search).get('style');
  return VARIANTS.includes(style as Variant) ? (style as Variant) : DEFAULT_VARIANT;
}

/** Keeps the ?style= preview parameter when linking between screens. */
export function useStyledPath() {
  const { search } = useLocation();
  const style = new URLSearchParams(search).get('style');
  return (path: string) => (style ? `${path}?style=${style}` : path);
}
