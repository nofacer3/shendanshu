

import React, { useMemo, useRef } from 'react';
import { InstancedMesh, Object3D, Color, MathUtils } from 'three';
import { COLORS, TREE_HEIGHT, TREE_RADIUS_BASE } from '../constants';

export const GiftFloor: React.FC = () => {
    const meshRef = useRef<InstancedMesh>(null);
    const count = 40;
    const dummy = useMemo(() => new Object3D(), []);

    const giftColors = useMemo(() => [
        COLORS.GIFT_1, COLORS.GIFT_2, COLORS.GIFT_3, COLORS.GIFT_4, COLORS.GIFT_5
    ], []);

    useMemo(() => {
        // We delay setting matrices until ref is ready or use useLayoutEffect, 
        // but for static objects just rendering once is fine if we can.
        // With react-three-fiber, we often set it in a useLayoutEffect or just loop during render if we controlled positions.
        // Let's use a callback ref or effect.
    }, []);

    // Set static positions once
    React.useLayoutEffect(() => {
        if (!meshRef.current) return;

        const floorY = -TREE_HEIGHT / 2 + 0.4; // Slightly above floor to avoid z-fighting
        
        for (let i = 0; i < count; i++) {
            // Random position around the base
            const angle = Math.random() * Math.PI * 2;
            const radius = MathUtils.lerp(TREE_RADIUS_BASE * 0.4, TREE_RADIUS_BASE * 1.2, Math.random());
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Random Rotation
            const rotY = Math.random() * Math.PI;

            // Varied Scale - Increased by 1.33x
            // Was 0.5 to 1.0 -> Now ~0.66 to 1.33
            const baseScale = Math.random() * 0.5 + 0.5; 
            const scale = baseScale * 1.33; 

            dummy.position.set(x, floorY + (scale * 0.5 - 0.5), z); // Adjust Y so bottom sits on floor
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            meshRef.current.setMatrixAt(i, dummy.matrix);
            
            // Random Color
            const colorHex = giftColors[Math.floor(Math.random() * giftColors.length)];
            meshRef.current.setColorAt(i, new Color(colorHex));
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [dummy, giftColors]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={0.6} metalness={0.3} />
        </instancedMesh>
    );
};