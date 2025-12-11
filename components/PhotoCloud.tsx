import React, { useRef, useMemo, useState, useLayoutEffect } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { TextureLoader, Vector3, MathUtils, CanvasTexture, RepeatWrapping, DoubleSide, Quaternion, Euler } from 'three';
import { AppState, PhotoData } from '../types';
import { SCATTER_BOUNDS, TREE_HEIGHT, TREE_RADIUS_BASE } from '../constants';

interface PhotoCloudProps {
  photos: PhotoData[];
  appState: AppState;
  activeIndex: number;
}

// Procedural Candy Stripe Texture
const useCandyTexture = () => {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 512, 512);
        
        // Stripes: Red, White, Green, Gold
        const colors = ['#D90429', '#FFFFFF', '#2E8B57', '#FFD700']; 
        const stripeWidth = 64;
        const offset = 256; // slant

        // Draw diagonal stripes
        for (let i = -512; i < 1024 + 512; i += stripeWidth) {
            const colorIndex = Math.floor((i + 512) / stripeWidth) % colors.length;
            ctx.fillStyle = colors[colorIndex];
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + stripeWidth, 0);
            ctx.lineTo(i + stripeWidth - offset, 512);
            ctx.lineTo(i - offset, 512);
            ctx.fill();
        }
    }
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    return tex;
  }, []);
};

const PolaroidFrame: React.FC<{ 
  photo: PhotoData; 
  appState: AppState; 
  isFocused: boolean;
  index: number;
  total: number;
}> = ({ photo, appState, isFocused, index, total }) => {
  const texture = useLoader(TextureLoader, photo.url);
  const candyTexture = useCandyTexture();
  const meshRef = useRef<any>(null);
  
  // Calculate dynamic dimensions based on image aspect ratio
  // Default width is 1.0 (normalized unit)
  const [dims, setDims] = useState({ w: 1, h: 1 });

  useLayoutEffect(() => {
    if (texture.image) {
        const aspect = texture.image.width / texture.image.height;
        // Fix width to 1.0, adjust height
        setDims({ w: 1.0, h: 1.0 / aspect });
    }
  }, [texture]);

  // Frame Dimensions calculation
  // REDUCED BORDER SIZES
  const border = 0.05; // Reduced from 0.1
  const bottomChin = 0.2; // Reduced from 0.4
  
  const frameW = dims.w + border * 2;
  const frameH = dims.h + border + bottomChin;
  // Offset Y to center the image visually in the top part of the frame
  const frameYOffset = (border - bottomChin) / 2;

  // Generate a fixed random position for this photo when in scatter mode
  const randomPos = useMemo(() => new Vector3(
    (Math.random() - 0.5) * SCATTER_BOUNDS,
    (Math.random() - 0.5) * SCATTER_BOUNDS,
    (Math.random() - 0.5) * SCATTER_BOUNDS
  ), []);

  // Generate a tree position along the spiral
  const treePos = useMemo(() => {
    const turns = 7.5; 
    const t = 0.15 + (index / total) * 0.7; 
    
    const tRand = MathUtils.clamp(t + (Math.random() - 0.5) * 0.1, 0.1, 0.9);
    
    const angle = tRand * Math.PI * 2 * turns;
    const height = TREE_HEIGHT;
    const baseRadius = TREE_RADIUS_BASE;
    
    const y = -height / 2 + tRand * height;
    const spiralRadius = MathUtils.lerp(baseRadius, 0.1, tRand);
    const tubeRadius = MathUtils.lerp(0.9, 0.3, tRand); 
    
    // Position closer to surface
    const distanceFromCenter = spiralRadius + tubeRadius * 0.9;
    
    const x = Math.cos(angle) * distanceFromCenter;
    const z = Math.sin(angle) * distanceFromCenter;
    
    return new Vector3(x, y, z);
  }, [index, total]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    let targetPos = treePos;
    let targetScale = 0.65; 
    let targetRot = new Quaternion(); 

    if (isFocused) {
      // Logic: Place photo exactly in front of the camera
      const camera = state.camera;
      const dist = 5.0; // Distance from camera
      
      const forward = new Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);

      const up = new Vector3(0, 1, 0); // Camera local up
      up.applyQuaternion(camera.quaternion);
      
      // Position: Camera Pos + Forward * 5 + Up * 0.8
      // Moves the photo higher up in the view
      targetPos = camera.position.clone()
        .add(forward.multiplyScalar(dist))
        .add(up.multiplyScalar(0.8));

      targetScale = 2.5; // Good size for reading
      
      // Face the camera exactly
      targetRot.copy(camera.quaternion);
    } else if (appState === AppState.SCATTERED) {
      targetPos = randomPos;
      targetScale = 1.0; 
      // Rotate slowly in place
      const eulerRot = new Vector3(0, state.clock.elapsedTime * 0.1, 0);
      const q = new Quaternion().setFromEuler(new Euler(eulerRot.x, eulerRot.y, eulerRot.z));
      targetRot = q;
    } else {
      // Tree mode: face outward from center
      const angleToCenter = Math.atan2(treePos.x, treePos.z);
      const tilt = Math.sin(index * 123) * 0.1; 
      
      const q = new Quaternion().setFromEuler(new Euler(
          tilt, 
          angleToCenter, 
          Math.sin(state.clock.elapsedTime + index) * 0.05
      ));
      targetRot = q;
    }

    const step = 4 * delta; // Faster transition for UI responsiveness

    meshRef.current.position.lerp(targetPos, step);
    meshRef.current.scale.lerp(new Vector3(targetScale, targetScale, targetScale), step);
    
    // Slerp rotation
    meshRef.current.quaternion.slerp(targetRot, step);
  });

  // Render Order 999 ensures it draws LAST (on top of transparent particles)
  // depthTest={false} ensures it ignores Z-buffer checks against particles
  const renderOrder = isFocused ? 999 : 1;

  return (
    <group ref={meshRef} renderOrder={renderOrder}>
        {/* Candy Stripe Backing Frame */}
        <mesh position={[0, frameYOffset, -0.01]}>
            <boxGeometry args={[frameW, frameH, 0.02]} />
            <meshStandardMaterial 
                map={candyTexture}
                roughness={0.3} 
                metalness={0.1}
                depthTest={!isFocused} 
                depthWrite={!isFocused}
            />
        </mesh>

        {/* Photo Image */}
        <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[dims.w, dims.h]} />
            <meshBasicMaterial 
                map={texture} 
                side={DoubleSide} 
                depthTest={!isFocused} 
                depthWrite={!isFocused}
            />
        </mesh>
    </group>
  );
};

export const PhotoCloud: React.FC<PhotoCloudProps> = ({ photos, appState, activeIndex }) => {
  return (
    <group>
      {photos.map((photo, index) => (
        <PolaroidFrame 
            key={photo.id} 
            photo={photo} 
            appState={appState} 
            isFocused={appState === AppState.FOCUSED && index === activeIndex}
            index={index}
            total={photos.length}
        />
      ))}
    </group>
  );
};