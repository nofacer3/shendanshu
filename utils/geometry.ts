import { Vector3, MathUtils } from 'three';
import { ParticleData, AppState } from '../types';
import { COLORS, PARTICLE_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, SCATTER_BOUNDS } from '../constants';

const generateUUID = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

export const generateParticles = (): ParticleData[] => {
  const particles: ParticleData[] = [];

  // Spiral definition
  const turns = 7.5; // Slightly tighter spiral
  const height = TREE_HEIGHT;
  const baseRadius = TREE_RADIUS_BASE;
  
  // Reserve more particles for the core filling
  const FILLER_COUNT = 1200; // Doubled filler count
  const MAIN_COUNT = PARTICLE_COUNT - FILLER_COUNT;

  // 1. Generate Main Spiral (Spheres, Cubes, Ornaments)
  for (let i = 0; i < MAIN_COUNT; i++) {
    const t = i / MAIN_COUNT; 
    
    // Core spiral path
    const angle = t * Math.PI * 2 * turns;
    const yBase = -height / 2 + t * height;
    const spiralRadius = MathUtils.lerp(baseRadius, 0.1, t);
    
    const cx = Math.cos(angle) * spiralRadius;
    const cz = Math.sin(angle) * spiralRadius;

    // Volumetric offset (Tube/Garland thickness)
    const tubeRadius = MathUtils.lerp(0.9, 0.3, t); 
    
    // Random point inside a sphere of radius 'tubeRadius'
    // Reduced randomness slightly to keep structure
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * tubeRadius * 0.9; // 0.9 multiplier to tighten ribbon

    const ox = r * Math.sin(phi) * Math.cos(theta);
    const oy = r * Math.sin(phi) * Math.sin(theta);
    const oz = r * Math.cos(phi);

    const xTree = cx + ox;
    const yTree = yBase + oy * 0.6; // Flatten vertically to keep layers distinct
    const zTree = cz + oz;

    // Scatter Position
    const xScatter = (Math.random() - 0.5) * SCATTER_BOUNDS;
    const yScatter = (Math.random() - 0.5) * SCATTER_BOUNDS;
    const zScatter = (Math.random() - 0.5) * SCATTER_BOUNDS;

    // Type & Color Distribution
    const rand = Math.random();
    
    let type: ParticleData['type'] = 'SPHERE';
    let color = COLORS.GOLD;
    let baseScale = 1;

    // SIZES:
    // Gold Spheres: 0.25 - 0.40
    // Red Spheres: 0.30 - 0.45 (Similar/Slightly larger than Gold avg)
    // Cubes: 0.20 - 0.28 (Smaller than spheres, ~1/3 smaller than Red max)
    
    // INCREASED CUBE PROBABILITY (from 0.35/0.45 to 0.55)
    if (rand < 0.55) {
        // Matte Green Cubes (55%)
        type = 'CUBE';
        color = COLORS.GREEN;
        baseScale = Math.random() * 0.08 + 0.20; // 0.20 - 0.28
    } else if (rand < 0.70) {
        // Red Ornaments (15%)
        type = 'SPHERE';
        color = COLORS.RED;
        baseScale = Math.random() * 0.15 + 0.30; // 0.30 - 0.45
    } else if (rand < 0.80) {
        // Twinkle Lights / Stars (10%)
        type = 'LIGHT';
        color = COLORS.LIGHT; // Will be overridden to Gold in render
        // SIGNIFICANTLY REDUCED SIZE for delicate star twinkle
        baseScale = Math.random() * 0.03 + 0.04; 
    } else {
        // Gold Ornaments (20%)
        type = 'SPHERE';
        color = COLORS.GOLD;
        baseScale = Math.random() * 0.15 + 0.25; // 0.25 - 0.40
    }

    // TAPER LOGIC: Reduce scale as we go up
    let finalScale = baseScale;
    if (type !== 'LIGHT') {
       const taperFactor = MathUtils.lerp(1.0, 0.5, t); // Taper to 50% at top
       finalScale = baseScale * taperFactor;
    }

    particles.push({
      id: generateUUID(),
      initialPos: new Vector3(xTree, yTree, zTree),
      scatterPos: new Vector3(xScatter, yScatter, zScatter),
      type,
      color,
      scale: finalScale,
    });
  }

  // 2. Generate Core Fillers (Small Red/Gold particles inside the tree)
  for (let i = 0; i < FILLER_COUNT; i++) {
    const t = Math.random(); 
    const heightPos = -height / 2 + t * height;
    
    // Position closer to center axis
    const maxRadiusAtHeight = MathUtils.lerp(baseRadius, 0.1, t) * 0.7; // Fill up to 70% of radius
    const r = Math.sqrt(Math.random()) * maxRadiusAtHeight;
    const theta = Math.random() * 2 * Math.PI;

    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    const y = heightPos + (Math.random() - 0.5) * 0.5;

    // Scatter
    const xScatter = (Math.random() - 0.5) * SCATTER_BOUNDS;
    const yScatter = (Math.random() - 0.5) * SCATTER_BOUNDS;
    const zScatter = (Math.random() - 0.5) * SCATTER_BOUNDS;

    const isRed = Math.random() > 0.5;

    particles.push({
      id: generateUUID(),
      initialPos: new Vector3(x, y, z),
      scatterPos: new Vector3(xScatter, yScatter, zScatter),
      type: 'SPHERE',
      color: isRed ? COLORS.RED : COLORS.GOLD,
      scale: (Math.random() * 0.05 + 0.08) * MathUtils.lerp(1.0, 0.5, t), // Small: 0.08 - 0.13 tapered
    });
  }

  return particles;
};

export const getTargetPosition = (particle: ParticleData, state: AppState): Vector3 => {
  if (state === AppState.SCATTERED || state === AppState.FOCUSED) {
    return particle.scatterPos;
  }
  return particle.initialPos;
};