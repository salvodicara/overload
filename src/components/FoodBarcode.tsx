import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;
export function FoodBarcode({
  onResult,
  onClose,
}: {
  onResult(code: string): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      try {
        const Constructor = (window as unknown as { BarcodeDetector?: DetectorConstructor })
          .BarcodeDetector;
        if (!Constructor || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const detector = new Constructor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        async function scan() {
          if (cancelled) return;
          try {
            if (video.current && video.current.readyState >= 2) {
              const codes = await detector.detect(video.current);
              if (!cancelled && codes[0]) {
                resultRef.current(codes[0].rawValue);
                return;
              }
            }
          } catch {
            stream?.getTracks().forEach((track) => track.stop());
            if (!cancelled) setError(true);
            return;
          }
          if (!cancelled) timer = setTimeout(() => void scan(), 180);
        }
        void scan();
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setError(true);
      }
    }
    void start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return (
    <div className="food-camera">
      {error ? (
        <p role="alert">{t('food.cameraError')}</p>
      ) : (
        <>
          <p className="small muted">{t('food.cameraHint')}</p>
          <video ref={video} muted playsInline aria-label={t('food.scan')} />
        </>
      )}
      <button className="btn btn-ghost" onClick={onClose}>
        {t('common.cancel')}
      </button>
    </div>
  );
}
