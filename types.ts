import { Vector3 } from 'three';

export enum AppState {
  ASSEMBLED = 'ASSEMBLED', // The Tree shape
  SCATTERED = 'SCATTERED', // The Cloud shape
  FOCUSED = 'FOCUSED',     // Photo zoom
}

export enum GestureType {
  NONE = 'NONE',
  FIST = 'FIST',       // Close tree
  OPEN_PALM = 'OPEN_PALM', // Open tree
  PINCH = 'PINCH',     // Grab/Focus
}

export interface ParticleData {
  id: string;
  initialPos: Vector3; // Tree position
  scatterPos: Vector3; // Random position
  type: 'SPHERE' | 'CUBE' | 'LIGHT';
  color: string;
  scale: number;
}

export interface PhotoData {
  id: string;
  url: string;
  aspectRatio: number;
}

export interface HandControlState {
  gesture: GestureType;
  position: { x: number; y: number }; // Normalized -1 to 1
  rotation: number;
}