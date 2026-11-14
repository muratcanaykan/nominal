import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code for opening a screen on a phone. */
export function Qr({ url, label }: { url: string; label: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } }).then((s) => {
      if (alive) setSvg(s);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return <div className="qr" role="img" aria-label={`QR code: ${label}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
