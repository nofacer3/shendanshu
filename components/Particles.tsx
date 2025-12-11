import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, Shape, ExtrudeGeometry } from 'three';
import { AppState, ParticleData } from '../types';
import { getTargetPosition } from '../utils/geometry';
import { COLORS } from '../constants';

interface ParticlesProps {
  data: ParticleData[];
  appState: AppState;
}

export const Particles: React.FC<ParticlesProps> = ({ data, appState }) => {
  const sphereMeshRef = useRef<InstancedMesh>(null);
  const cubeMeshRef = useRef<InstancedMesh>(null);
  const lightMeshRef = useRef<InstancedMesh>(null);
  
  const dummy = useMemo(() => new Object3D(), []);

  const spheres = useMemo(() => data.filter(d => d.type === 'SPHERE'), [data]);
  const cubes = useMemo(() => data.filter(d => d.type === 'CUBE'), [data]);
  const lights = useMemo(() => data.filter(d => d.type === 'LIGHT'), [data]);

  const starGeometry = useMemo(() => {
    const shape = new Shape();
    const points = 4;
    const outerRadius = 1; 
    const innerRadius = 0.2; 

    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i / (points * 2)) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();

    return new ExtrudeGeometry(shape, {
        depth: 0.1,
        bevelEnabled: false
    });
  }, []);

  useFrame((state, delta) => {
    const step = 3 * delta; 
    const time = state.clock.elapsedTime;

    if (sphereMeshRef.current) {
      spheres.forEach((particle, i) => {
        const target = getTargetPosition(particle, appState);
        sphereMeshRef.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.position.lerp(target, step);
        dummy.rotation.x = Math.sin(time * 0.5 + i) * 0.2;
        dummy.rotation.y = Math.cos(time * 0.3 + i) * 0.2;
        dummy.updateMatrix();
        sphereMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      sphereMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (cubeMeshRef.current) {
      cubes.forEach((particle, i) => {
        const target = getTargetPosition(particle, appState);
        cubeMeshRef.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.position.lerp(target, step);
        dummy.rotation.x += delta * 0.2;
        dummy.rotation.y += delta * 0.3;
        dummy.updateMatrix();
        cubeMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      cubeMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (lightMeshRef.current) {
        lights.forEach((particle, i) => {
          const target = getTargetPosition(particle, appState);
          lightMeshRef.current!.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.position.lerp(target, step);
          
          const pulse = Math.pow(Math.sin(time * 5 + particle.id.charCodeAt(0)), 4);
          const currentScale = particle.scale * (0.8 + pulse * 1.5);
          
          dummy.scale.setScalar(currentScale);
          dummy.rotation.z += delta * 0.5;

          dummy.updateMatrix();
          lightMeshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        lightMeshRef.current.instanceMatrix.needsUpdate = true;
      }
  });

  useEffect(() => {
    const initMesh = (ref: React.RefObject<InstancedMesh>, items: ParticleData[], isStar = false) => {
        if (ref.current) {
            items.forEach((p, i) => {
              dummy.position.copy(p.initialPos);
              dummy.scale.setScalar(p.scale);
              dummy.updateMatrix();
              ref.current!.setMatrixAt(i, dummy.matrix);
              const color = isStar ? COLORS.GOLD : p.color;
              ref.current!.setColorAt(i, new Color(color));
            });
            ref.current.instanceMatrix.needsUpdate = true;
            if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
        }
    };

    initMesh(sphereMeshRef, spheres);
    initMesh(cubeMeshRef, cubes);
    initMesh(lightMeshRef, lights, true); 

  }, [spheres, cubes, lights, dummy]);

  return (
    <group>
      {/* High Gloss Spheres */}
      <instancedMesh ref={sphereMeshRef} args={[undefined, undefined, spheres.length]} castShadow receiveShadow frustumCulled={false}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial 
            roughness={0.02}
            metalness={1.0}
            clearcoat={1.0} 
            clearcoatRoughness={0.05}
            envMapIntensity={2.0} 
        />
      </instancedMesh>
      
      {/* Matte Cubes */}
      <instancedMesh ref={cubeMeshRef} args={[undefined, undefined, cubes.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
            color={COLORS.GREEN}
            roughness={0.8}
            metalness={0.1}
            envMapIntensity={0.5}
        />
      </instancedMesh>

      {/* Emissive Lights - Adjusted intensity */}
      <instancedMesh ref={lightMeshRef} args={[starGeometry, undefined, lights.length]} frustumCulled={false}>
        <meshStandardMaterial 
            color={COLORS.GOLD} 
            emissive={COLORS.GOLD}
            emissiveIntensity={5.0}
            toneMapped={false} 
        />
      </instancedMesh>
    </group>
  );
};