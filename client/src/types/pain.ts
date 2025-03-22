// Pain scales
export enum PainScale {
  None = 0,
  Mild = 1,
  Moderate = 5,
  Severe = 8,
  Worst = 10
}

// Common pain locations
export const PainLocations = [
  "Head",
  "Neck",
  "Shoulders",
  "Upper Back",
  "Lower Back",
  "Chest",
  "Abdomen",
  "Hips",
  "Joints",
  "Arms",
  "Legs",
  "Feet"
] as const;

export type PainLocation = typeof PainLocations[number];

// Common pain characteristics
export const PainCharacteristics = [
  "Sharp",
  "Dull",
  "Throbbing",
  "Radiating",
  "Burning",
  "Stabbing",
  "Aching",
  "Tingling",
  "Shooting",
  "Cramping",
  "Pressure",
  "Stiffness"
] as const;

export type PainCharacteristic = typeof PainCharacteristics[number];

// Common pain triggers
export const PainTriggers = [
  "Stress",
  "Poor Sleep",
  "Weather",
  "Physical Activity",
  "Food",
  "Posture",
  "Sitting",
  "Standing",
  "Movement",
  "Screen Time",
  "Dehydration",
  "Alcohol"
] as const;

export type PainTrigger = typeof PainTriggers[number];

// Pain visualization data structure
export interface PainTrendData {
  day: string;
  intensity: number;
}
