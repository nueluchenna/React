import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, SwitchCamera, Upload, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  onCapture,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      setError(null);
      setReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Live camera preview is not supported in this browser. Use the native camera button below.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Camera access was denied or no camera was found.';
        setError(msg);
      }
    };

    void startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `Receipt_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.88
    );
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onCapture(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0E0F0C]/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-[#0E0F0C] text-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFallbackFile}
          className="hidden"
        />

        <div className="px-5 py-4 flex items-center justify-between">
          <span className="font-display font-bold text-sm">Scan receipt</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
              }
              title="Switch camera"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative bg-black aspect-[3/4] sm:aspect-[4/3] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-8 text-center space-y-4 max-w-xs">
              <AlertCircle className="w-8 h-8 text-[#9FE870] mx-auto" />
              <p className="text-xs text-white/75 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] text-[#163300] text-xs font-semibold transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Open system camera</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-6 border border-white/30 rounded-2xl" />
            </>
          )}
        </div>

        <div className="p-5 flex items-center justify-between gap-3 bg-[#0E0F0C]">
          <button
            type="button"
            onClick={() => fallbackInputRef.current?.click()}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition cursor-pointer"
          >
            Native camera
          </button>

          <button
            type="button"
            disabled={!ready || Boolean(error)}
            onClick={handleTakePhoto}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] disabled:opacity-40 text-[#163300] text-sm font-semibold transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Capture</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-medium text-white/60 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
