import React, { useEffect, useRef, useState } from 'react';
import { GestureType, HandControlState } from '../types';

interface HandControllerProps {
  onUpdate: (state: HandControlState) => void;
}

const HandController: React.FC<HandControllerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze landmarks to detect gestures
  const detectGesture = (landmarks: any[]): GestureType => {
    // Landmarks:
    // 0: Wrist
    // 4: Thumb tip
    // 8: Index tip
    // 12: Middle tip
    // 16: Ring tip
    // 20: Pinky tip

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    // Distance between thumb tip and index tip for Pinch
    const pinchDist = Math.hypot(
      thumbTip.x - indexTip.x,
      thumbTip.y - indexTip.y
    );

    if (pinchDist < 0.05) {
      return GestureType.PINCH;
    }

    // Check if fingers are extended (tip further from wrist than PIP joint)
    const dist = (p1: any, p2: any) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    
    // Thresholds relative to palm size might be better, but simple distance checks work for general states
    const isIndexExtended = dist(indexTip, wrist) > dist(landmarks[6], wrist) + 0.05;
    const isMiddleExtended = dist(middleTip, wrist) > dist(landmarks[10], wrist) + 0.05;
    const isRingExtended = dist(ringTip, wrist) > dist(landmarks[14], wrist) + 0.05;
    const isPinkyExtended = dist(pinkyTip, wrist) > dist(landmarks[18], wrist) + 0.05;

    const extendedCount = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;

    if (extendedCount >= 3) {
      return GestureType.OPEN_PALM;
    }

    if (extendedCount <= 1) {
      return GestureType.FIST;
    }

    return GestureType.NONE;
  };

  useEffect(() => {
    let active = true;

    const initHands = async () => {
      if (!(window as any).Hands) {
        console.error("MediaPipe Hands not loaded");
        return;
      }

      const hands = new (window as any).Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults((results: any) => {
        if (!active) return;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          const gesture = detectGesture(landmarks);
          
          // Calculate hand position (center of palm approx)
          const palmX = landmarks[9].x; // Middle finger MCP
          const palmY = landmarks[9].y;

          // Normalize to -1 to 1, invert X for mirror effect
          const x = (1 - palmX) * 2 - 1; 
          const y = (1 - palmY) * 2 - 1;

          // Calculate Rotation (Roll)
          // Use vector from Index MCP (5) to Pinky MCP (17) to determine horizontal tilt
          const p5 = landmarks[5];
          const p17 = landmarks[17];
          
          const dx = p17.x - p5.x;
          const dy = p17.y - p5.y;
          
          // Determine handedness roughly by relative position
          // Right hand (palm to camera): Pinky (17) is to the right of Index (5) in world, 
          // but in mirrored video feed (or raw coords), it depends.
          // In standard MediaPipe raw coords (0,0 top left):
          // Right hand: Thumb is left (smaller x), Pinky is right (larger x) -> dx > 0
          // Left hand: Thumb is right (larger x), Pinky is left (smaller x) -> dx < 0
          const isRightHand = dx > 0;

          // Calculate raw angle. 
          // We normalize x distance to be positive to calculate tilt relative to "outward" direction
          const rawAngle = Math.atan2(dy, Math.abs(dx));

          // Normalize Rotation:
          // We want: Turn Left (CCW) -> Negative value
          //          Turn Right (CW) -> Positive value
          
          // For Right Hand:
          // Turn Left (CCW) -> Pinky goes UP (y decreases), Index goes DOWN. dy < 0. rawAngle < 0.
          // Turn Right (CW) -> Pinky goes DOWN (y increases). dy > 0. rawAngle > 0.
          // Matches desired output.

          // For Left Hand:
          // Turn Left (CCW) -> Pinky goes DOWN (y increases). dy > 0. rawAngle > 0.
          // Turn Right (CW) -> Pinky goes UP (y decreases). dy < 0. rawAngle < 0.
          // Inverse of desired output.
          
          const rotation = isRightHand ? rawAngle : -rawAngle;

          onUpdate({
            gesture,
            position: { x, y },
            rotation
          });
        } else {
          onUpdate({
            gesture: GestureType.NONE,
            position: { x: 0, y: 0 },
            rotation: 0
          });
        }
      });

      handsRef.current = hands;
    };

    initHands();

    return () => {
      active = false;
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [onUpdate]);

  // Camera handling
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640,
            height: 480,
            facingMode: 'user'
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
            videoRef.current?.play().catch(e => console.error("Video play failed", e));
          };
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setError("Camera access denied. Please allow permissions.");
        } else {
            setError("Camera unavailable.");
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Prediction Loop
  useEffect(() => {
    if (!isCameraReady || !handsRef.current || !videoRef.current) return;

    const predict = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && !videoRef.current.paused && !videoRef.current.ended) {
        await handsRef.current.send({ image: videoRef.current });
      }
      requestRef.current = requestAnimationFrame(predict);
    };

    requestRef.current = requestAnimationFrame(predict);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraReady]);

  return (
    // Responsive Hide: Hidden on mobile (<1024px), Block on Desktop (lg)
    // Increased size: w-60 h-44 (approx 2x previous size)
    <div className="hidden lg:block absolute bottom-6 right-6 w-60 h-44 bg-black/50 rounded-xl overflow-hidden border-2 border-gold/30 shadow-[0_0_20px_rgba(255,215,0,0.2)] z-50">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover opacity-90 -scale-x-100 transform ${(!isCameraReady || error) ? 'hidden' : ''}`} // Hide video element on error or loading
        playsInline
        muted
      />
      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">
          Loading...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/80">
          <p className="text-xmas-red font-bold text-sm mb-1">Camera Error</p>
          <p className="text-white/70 text-xs">{error}</p>
        </div>
      )}
    </div>
  );
};

export default HandController;