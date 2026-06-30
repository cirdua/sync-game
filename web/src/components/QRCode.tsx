import { useEffect, useRef } from "react";
import QRCodeLib from "qrcode";

// Renders a QR code for the join URL onto a canvas. Used full-screen on the host
// projector so 200 phones can scan instead of typing the code.

export function QRCode({ value, size = 280 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    QRCodeLib.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#181c21", light: "#ffffff" },
    }).catch(() => {
      /* ignore render errors */
    });
  }, [value, size]);

  return <canvas ref={ref} width={size} height={size} />;
}
