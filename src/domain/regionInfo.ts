// What each body region does, how spaceflight affects it, how it is measured, when to see the medical officer and
// how to prevent problems. Shown when a region of the body map or the 3D astronaut is clicked.
// Background: NASA Human Research Program, Risks of Human Spaceflight (cardiovascular adaptations, spaceflight
// associated neuro-ocular syndrome, bone and muscle loss, EVA injuries, decompression sickness, CO₂ exposure).

import type { BodyRegion } from './body';

export interface RegionInfo {
  title: string;
  function: string;
  spaceflight: string;
  measured: string;
  exam: string;
  prevention: string;
}

const SHOULDER: RegionInfo = {
  title: 'Shoulder',
  function: 'The most mobile joint of the body. On a spacewalk it carries most of the arm work, often overhead.',
  spaceflight:
    'The pressurised suit pushes against the shoulder, and shoulder injuries are among the most common spacesuit injuries. During or after a spacewalk, joint pain can also be a sign of decompression sickness.',
  measured: 'Pressure sensors in the suit lining (only while suited), and pain you report on the watch.',
  exam: 'Pain that stays after rest, or any joint pain during or after a spacewalk.',
  prevention: 'A well-fitted suit, short breaks from overhead work, stretching and resistance exercise.',
};

const ARM: RegionInfo = {
  title: 'Arm and elbow',
  function: 'Reaching and holding. The glucose sensor patch sits on the back of the upper arm.',
  spaceflight:
    'Without gravity, arm and shoulder muscles lose mass and strength. Elbow pain after a spacewalk can be a sign of decompression sickness.',
  measured: 'Continuous glucose sensor on the upper arm; pain you report on the watch.',
  exam: 'Joint pain after a spacewalk, or skin irritation under the sensor patch.',
  prevention: 'Daily resistance exercise, and moving the sensor patch to a new spot at each change.',
};

const HAND: RegionInfo = {
  title: 'Hand',
  function: 'Fine work: tools, switches, experiments. The watch sits on the wrist.',
  spaceflight:
    'Pressurised spacesuit gloves press on the fingertips and can make them cold. That leads to numbness, loss of dexterity and fingernail injuries, among the most common spacewalk injuries.',
  measured: 'Fingertip temperature in the suit glove (only while suited); heart rate and blood oxygen from the watch at the wrist.',
  exam: 'Numbness that lasts after warming up, a damaged fingernail, or blisters.',
  prevention: 'Glove heaters on, a correctly sized glove, short breaks to flex the fingers, hand exercises.',
};

const LEG: RegionInfo = {
  title: 'Leg and knee',
  function: 'In weightlessness the legs barely carry any load, so bones and muscles are not loaded as on Earth.',
  spaceflight:
    'Weight-bearing bones (hips, spine, legs) lose roughly 1–1.5 % of their mineral density per month without exercise, and leg muscles shrink. Fluid moves up to the head ("bird legs"). Knee pain after a spacewalk can be a sign of decompression sickness.',
  measured: 'Not measured live: bone density is checked with scans before and after the mission. Pain you report on the watch.',
  exam: 'Bone scans before and after the mission; any knee pain during or after a spacewalk.',
  prevention: 'About two hours of daily exercise in space: resistance training and treadmill or cycling.',
};

export const REGION_INFO: Record<BodyRegion, RegionInfo> = {
  head: {
    title: 'Head',
    function: 'Brain, eyes, nose and mouth: where you breathe, see and decide.',
    spaceflight:
      'Body fluids shift toward the head, causing a puffy face, congestion and headaches. Some astronauts develop eye changes on long missions (spaceflight associated neuro-ocular syndrome). Carbon dioxide build-up causes headaches and poor concentration.',
    measured: 'Helmet CO₂ and water sensors (only while suited); mood check-ins on the watch.',
    exam: 'A headache with vision changes, confusion, or a headache after a CO₂ alarm. Eyes are checked with regular in-flight eye exams.',
    prevention: 'Keep cabin and suit CO₂ low, protect your sleep, and report vision changes early.',
  },
  chest: {
    title: 'Chest: heart and lungs',
    function: 'The heart pumps blood; the lungs bring in oxygen and remove carbon dioxide.',
    spaceflight:
      'In weightlessness the heart works less and deconditions, blood volume drops and blood pressure regulation changes. Back in gravity this can cause dizziness or fainting.',
    measured: 'Heart rate, blood oxygen and blood pressure from the watch; core temperature from a skin patch.',
    exam: 'An irregular heartbeat, chest pain, blood oxygen below 90 %, or fainting. Heart checks in space use ECG, a blood pressure cuff and ultrasound.',
    prevention: 'Daily aerobic exercise (treadmill or cycle), drinking enough water, and salt and fluid loading before landing.',
  },
  leftShoulder: SHOULDER,
  rightShoulder: SHOULDER,
  leftArm: ARM,
  rightArm: ARM,
  leftHand: HAND,
  rightHand: HAND,
  leftLeg: LEG,
  rightLeg: LEG,
};
