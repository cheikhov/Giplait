import React, { useEffect, useRef, useState } from 'react';
import { Camera, FileImage, StopCircle, Upload, Video, X } from 'lucide-react';
import type { DocumentType } from '../types/stock';

interface CameraModalProps {
  isOpen: boolean;
  mode: 'photo' | 'photo_and_video';
  title: string;
  sampleDocType?: DocumentType;
  onClose: () => void;
  onCapturePhoto: (dataUrl: string) => void;
  onCaptureVideo?: (dataUrl: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  mode,
  title,
  sampleDocType,
  onClose,
  onCapturePhoto,
  onCaptureVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }
    void startCamera();
    return () => stopStream();
  }, [isOpen]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const stopStream = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setRecording(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Caméra non disponible sur ce navigateur. Utilisez l’import de fichier.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === 'photo_and_video',
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        'Aucune caméra physique détectée ou permission refusée. Vous pouvez importer une photo/vidéo depuis votre appareil.'
      );
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopStream();
    onCapturePhoto(dataUrl);
  };

  const startRecording = () => {
    if (!streamRef.current || !onCaptureVideo) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          stopStream();
          onCaptureVideo(reader.result);
        }
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecordSeconds(0);
    setRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') return;
      stopStream();
      if (file.type.startsWith('video/') && onCaptureVideo) {
        onCaptureVideo(reader.result);
      } else {
        onCapturePhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Generates a realistic crisp synthetic paper dock document PNG image on canvas when testing without a physical paper sheet
  const generateSampleDocumentImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 900, 1100);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 840, 1040);

    ctx.fillStyle = '#004B93';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(
      sampleDocType === 'LIVRAISON'
        ? 'BON DE LIVRAISON — QUAI LAITERIE ALGER'
        : 'BON DE RÉCEPTION — QUAI LAITERIE ALGER',
      60,
      90
    );

    ctx.fillStyle = '#1e293b';
    ctx.font = '18px monospace';
    const randNum = Math.floor(1000 + Math.random() * 8999);
    const docNo = sampleDocType === 'LIVRAISON' ? `BL-2026-${randNum}` : `BR-2026-${randNum}`;
    const today = new Date().toISOString().slice(0, 16).replace('T', ' ');
    ctx.fillText(`N° Document : ${docNo}`, 60, 140);
    ctx.fillText(`Date / Heure : ${today}`, 60, 175);
    ctx.fillText(
      sampleDocType === 'LIVRAISON'
        ? 'Distributeur : SARL Distribution Alger Centre (DIST-ALG-01)'
        : 'Fournisseur : Unité Production Laiterie Giplait Alger',
      60,
      210
    );

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 245);
    ctx.lineTo(840, 245);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('REF          DESIGNATION                              COND.         QTE', 60, 280);

    const rows =
      sampleDocType === 'LIVRAISON'
        ? [
            ['GPL-LS-001', 'Lait enrichi pasteurisé partiellement écrémé', 'Caisse 20', '200'],
            ['GPL-YG-037', 'Yaourt aromatisé 160 g', 'Plateau 24', '120'],
            ['GPL-GR-066', 'Beurre pasteurisé 250 g', 'Carton 40', '80'],
          ]
        : [
            ['GPL-LS-001', 'Lait enrichi pasteurisé partiellement écrémé', 'Caisse 20', '500'],
            ['GPL-FR-032', 'Camembert 250 g', 'Carton 16', '240'],
            ['GPL-PL-051', 'Raïb pasteurisé bouteille 1 L', 'Fardeau 6', '180'],
          ];

    ctx.font = '16px monospace';
    rows.forEach((r, idx) => {
      const y = 330 + idx * 55;
      ctx.fillText(`${r[0]}   ${r[1].slice(0, 36).padEnd(38, ' ')} ${r[2].padEnd(13, ' ')} ${r[3]}`, 60, y);
    });

    ctx.fillStyle = '#16A34A';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Visa Chef de Quai : CONFORME / CHAINE DU FROID +4°C', 60, 560);

    const dataUrl = canvas.toDataURL('image/png');
    stopStream();
    onCapturePhoto(dataUrl);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Fermer la caméra"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative bg-slate-950 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            {!cameraActive && (
              <div className="p-6 text-center space-y-3">
                <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  {cameraError || 'Initialisation de la caméra du poste...'}
                </p>
              </div>
            )}
            {recording && (
              <div className="absolute top-3 right-3 px-3 py-1 rounded-md bg-red-600 text-white text-xs font-mono font-semibold">
                REC {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                {String(recordSeconds % 60).padStart(2, '0')}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={mode === 'photo_and_video' ? 'image/*,video/*' : 'image/*'}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {cameraActive && (
                <button
                  type="button"
                  onClick={takePhoto}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#004B93] hover:bg-[#00356B] text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Prendre Photo
                </button>
              )}

              {cameraActive && mode === 'photo_and_video' && onCaptureVideo && (
                !recording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    Filmer Chambre Froide
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                    Arrêter Vidéo
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                {mode === 'photo_and_video' ? 'Importer Photo / Vidéo' : 'Importer une Image'}
              </button>
            </div>

            {sampleDocType && (
              <button
                type="button"
                onClick={generateSampleDocumentImage}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#004B93] bg-[#EEF5FC] hover:bg-blue-100 rounded-lg transition-colors"
              >
                <FileImage className="w-4 h-4" />
                Générer Bon Test (OCR)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
