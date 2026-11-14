// Body regions for the body map, and the joints a crew member can report pain in.

export type BodyRegion =
  | 'head'
  | 'chest'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftArm'
  | 'rightArm'
  | 'leftHand'
  | 'rightHand'
  | 'leftLeg'
  | 'rightLeg';

export const REGION_LABELS: Record<BodyRegion, string> = {
  head: 'Head',
  chest: 'Chest',
  leftShoulder: 'Left shoulder',
  rightShoulder: 'Right shoulder',
  leftArm: 'Left arm',
  rightArm: 'Right arm',
  leftHand: 'Left hand',
  rightHand: 'Right hand',
  leftLeg: 'Left leg',
  rightLeg: 'Right leg',
};

export type PainSite = 'leftShoulder' | 'rightShoulder' | 'leftElbow' | 'rightElbow' | 'leftKnee' | 'rightKnee';

export const PAIN_SITES: Record<PainSite, { label: string; region: BodyRegion }> = {
  leftShoulder: { label: 'Left shoulder', region: 'leftShoulder' },
  rightShoulder: { label: 'Right shoulder', region: 'rightShoulder' },
  leftElbow: { label: 'Left elbow', region: 'leftArm' },
  rightElbow: { label: 'Right elbow', region: 'rightArm' },
  leftKnee: { label: 'Left knee', region: 'leftLeg' },
  rightKnee: { label: 'Right knee', region: 'rightLeg' },
};

export const PAIN_SITE_IDS = Object.keys(PAIN_SITES) as PainSite[];
