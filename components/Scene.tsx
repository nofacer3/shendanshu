import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import { Environment, OrbitControls, Sparkles, Float, Text } from '@react-three/drei';
import { Particles } from './Particles';
import { PhotoCloud } from './PhotoCloud';
import { GiftFloor } from './GiftFloor';
import { AppState, HandControlState, GestureType, ParticleData, PhotoData } from '../types';
import { generateParticles } from '../utils/geometry';
import { MathUtils, Vector3, Shape, ExtrudeGeometry, Vector2 } from 'three';
import { TREE_HEIGHT, COLORS } from '../constants';

interface SceneProps {
  handState: HandControlState;
  photos: PhotoData[];
  setAppState: (s: AppState) => void;
  appState: AppState;
}

const StarShape = ({ appState }: { appState: AppState }) => {
    const meshRef = useRef<any>(null);

    const starGeometry = useMemo(() => {
        const shape = new Shape();
        const points = 5;
        const outerRadius = 0.8; 
        const innerRadius = 0.35;

        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2; 
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        const extrudeSettings = {
            steps: 1,
            depth: 0.2, // Slightly thicker
            bevelEnabled: true,
            bevelThickness: 0.1, // Increased from 0.05 for softer edges
            bevelSize: 0.08, // Increased bevel size
            bevelSegments: 10 // High segment count for smooth, round edges
        };

        return new ExtrudeGeometry(shape, extrudeSettings);
    }, []);

    useFrame((state) => {
        if(!meshRef.current) return;
        const time = state.clock.elapsedTime;
        
        // Spin logic
        meshRef.current.rotation.y = time * 0.8;
        
        // Scale logic
        const targetScale = appState === AppState.ASSEMBLED ? 1 : 0.01;
        const currentScale = meshRef.current.scale.x;
        const nextScale = MathUtils.lerp(currentScale, targetScale, 0.1);
        meshRef.current.scale.setScalar(nextScale);
    });

    const starY = TREE_HEIGHT / 2 + 0.6;

    return (
        <group position={[0, starY, 0]}>
            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
                <mesh ref={meshRef} geometry={starGeometry}>
                    {/* Softened Material: Higher roughness for diffused/matte glow */}
                    <meshStandardMaterial 
                        color={COLORS.GOLD} 
                        emissive={COLORS.GOLD}
                        emissiveIntensity={9.0} 
                        toneMapped={false}
                        roughness={0.4} 
                        metalness={0.9} 
                        envMapIntensity={1.0}
                    />
                </mesh>
            </Float>
            {/* Glow light */}
            <pointLight distance={15} intensity={5} color={COLORS.GOLD} decay={2} />
        </group>
    );
};

export const Scene: React.FC<SceneProps> = ({ handState, photos, setAppState, appState }) => {
  const [particles] = useState<ParticleData[]>(() => generateParticles());
  // Using sequential index instead of ID for orderly navigation
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const controlsRef = useRef<any>(null);
  const lastSwitchTime = useRef<number>(0);
  
  // Responsive Scaling
  const { size } = useThree();
  const isDesktop = size.width >= 1024; 
  const isMobile = size.width < 768;
  
  const treeScale = isMobile ? 0.65 : 1;

  // Gesture Logic Handler
  useEffect(() => {
    if (handState.gesture === GestureType.FIST) {
      setAppState(AppState.ASSEMBLED);
    } else if (handState.gesture === GestureType.OPEN_PALM) {
      if (appState !== AppState.SCATTERED && appState !== AppState.FOCUSED) {
        setAppState(AppState.SCATTERED);
      }
    } else if (handState.gesture === GestureType.PINCH) {
      if (appState === AppState.SCATTERED && photos.length > 0) {
        setAppState(AppState.FOCUSED);
        // Do not reset activeIndex randomly; maintain sequence or start at 0 if first time
      }
    }
    
    if (handState.gesture === GestureType.OPEN_PALM && appState === AppState.FOCUSED) {
        setAppState(AppState.SCATTERED);
    }
  }, [handState.gesture, appState, photos, setAppState]);

  // Camera Motion & Photo Switching Logic
  useFrame((state) => {
    const isHandActive = handState.gesture !== GestureType.NONE;
    const time = state.clock.elapsedTime;

    // Photo Switching Logic (only when FOCUSED)
    if (appState === AppState.FOCUSED && photos.length > 1) {
        // Cooldown check (0.8s) for deliberate rotations
        if (time - lastSwitchTime.current > 0.8) {
            const rot = handState.rotation;
            
            // Hand Rotation Logic
            // Turn Left (rot < -0.4) -> Previous Photo
            // Turn Right (rot > 0.4) -> Next Photo
            const THRESHOLD = 0.4;

            if (rot < -THRESHOLD) {
                setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length);
                lastSwitchTime.current = time;
            } 
            else if (rot > THRESHOLD) {
                setActiveIndex((prev) => (prev + 1) % photos.length);
                lastSwitchTime.current = time;
            }
        }
    }

    if (controlsRef.current) {
        if (appState === AppState.SCATTERED) {
            // Scattered Mode: Free Orbit with Hand
            const targetAzimuth = handState.position.x * Math.PI;
            const targetPolar = Math.PI / 2 - handState.position.y * 0.5;

            controlsRef.current.setAzimuthalAngle(
                MathUtils.lerp(controlsRef.current.getAzimuthalAngle(), targetAzimuth, 0.05)
            );
            controlsRef.current.setPolarAngle(
                MathUtils.lerp(controlsRef.current.getPolarAngle(), targetPolar, 0.05)
            );
            controlsRef.current.update();

        } else if (appState === AppState.ASSEMBLED) {
            // Assembled Mode (Tree): Strict Rotation Control
            if (isHandActive) {
                controlsRef.current.autoRotate = false;
                const targetAzimuth = handState.position.x * Math.PI;

                controlsRef.current.setAzimuthalAngle(
                    MathUtils.lerp(controlsRef.current.getAzimuthalAngle(), targetAzimuth, 0.05)
                );
            } else {
                controlsRef.current.autoRotate = true;
                controlsRef.current.autoRotateSpeed = 0.8; 
            }
            controlsRef.current.update();
        } else if (appState === AppState.FOCUSED) {
            // Stop rotation when focused on a photo
            controlsRef.current.autoRotate = false;
            controlsRef.current.update();
        }
    }
  });

  return (
    <>
      <color attach="background" args={['#030303']} />
      <fog attach="fog" args={['#030303', 5, 30]} />
      
      <Suspense fallback={null}>
          <Environment preset="city" />
      </Suspense>

      <ambientLight intensity={0.3} />
      <spotLight position={[10, 15, 10]} angle={0.4} penumbra={1} intensity={5} color="#FFF8E7" castShadow />
      <spotLight position={[-10, 8, -5]} angle={0.5} penumbra={1} intensity={3} color="#FFD700" castShadow />
      <pointLight position={[0, 0, 0]} intensity={2} color="#FFA500" distance={10} decay={2} />

      <Sparkles count={1500} scale={25} size={3} speed={0.3} opacity={0.6} color="#FFD700" />

      <group position={[0, -0.5, 0]} scale={[treeScale, treeScale, treeScale]}>
        <StarShape appState={appState} />
        
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
          <Suspense fallback={null}>
            <Text
                position={[-6, 3, 3]}
                font="https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.woff"
                fontSize={2.5}
                anchorX="center"
                anchorY="middle"
                rotation={[0, 0.3, 0]}
                outlineWidth={0.05}
                outlineColor="#B8860B"
            >
                Merry
                <meshStandardMaterial 
                    color="#FFD700" 
                    emissive="#FFC800"
                    emissiveIntensity={2.5} 
                    toneMapped={false}
                    roughness={0.1}
                    metalness={0.8}
                />
            </Text>
          </Suspense>
        </Float>

        <Float speed={2.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <Suspense fallback={null}>
            <Text
                position={[6, -1, 3]} 
                font="https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.woff"
                fontSize={2.5}
                anchorX="center"
                anchorY="middle"
                rotation={[0, -0.3, 0]}
                outlineWidth={0.05}
                outlineColor="#B8860B"
            >
                Christmas
                <meshStandardMaterial 
                    color="#FFD700" 
                    emissive="#FFC800"
                    emissiveIntensity={2.5} 
                    toneMapped={false}
                    roughness={0.1}
                    metalness={0.8}
                />
            </Text>
          </Suspense>
        </Float>

        <Particles data={particles} appState={appState} />
        <PhotoCloud photos={photos} appState={appState} activeIndex={activeIndex} />
        <GiftFloor />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -TREE_HEIGHT/2, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#050505" roughness={0.3} metalness={0.5} />
        </mesh>
      </group>

      <OrbitControls 
        ref={controlsRef} 
        enableZoom={false} 
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
        rotateSpeed={0.5}
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom 
            luminanceThreshold={0.1} 
            mipmapBlur 
            intensity={1.0} 
            radius={0.9} 
            levels={8}
        />
        <ChromaticAberration 
            offset={new Vector2(0.002, 0.002)} 
            radialModulation={true} 
            modulationOffset={0.5} 
        />
        <Noise opacity={0.04} />
        <Vignette eskil={false} offset={0.3} darkness={0.9} />
      </EffectComposer>
    </>
  );
};