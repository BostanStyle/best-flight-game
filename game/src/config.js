// Skylark Valley — tuning, palette and mission definitions.
// One job: every number the rest of the game agrees on lives here,
// so balancing the flight model never means hunting through render code.

export const VIEW = {
  width: 1280,
  height: 720,
  // Pseudo-3D camera: 1 / tan(fov / 2) for a ~100 degree field of view.
  cameraDepth: 0.84,
  // How many course segments ahead the renderer draws.
  drawDistance: 150,
  // Length of one course segment, in metres.
  segmentLength: 100,
  // Half-width of the valley floor the camera can see, in metres.
  viewHalfWidth: 900,
};

export const RUNWAY = {
  // The runway occupies the first segments of the course.
  firstSegment: 0,
  lengthSegments: 9,
  width: 34,
  heading: 90, // Runway 09: due east, so the morning sun sits ahead.
};

export const PLANE = {
  // Arcade flight model, metres / seconds / degrees.
  minSpeed: 26, // Below this the wing stops flying.
  stallSpeed: 32, // Below this the nose drops on its own.
  cruiseSpeed: 78, // Throttle 0.62 settles here, level flight.
  maxSpeed: 105,
  takeoffSpeed: 36,
  climbRate: 8, // m/s at full throttle, wings level.
  rollRate: 95, // deg/s at full stick.
  maxBank: 62, // deg.
  pitchRate: 42, // deg/s at full stick.
  maxPitchUp: 24,
  maxPitchDown: -18,
  turnFactor: 0.9, // How strongly bank turns the nose.
  fuelCapacity: 100, // Units; a full tank is one generous sortie.
  fuelBurnCruise: 0.08, // Units per second at cruise throttle.
  fuelBurnFull: 0.22, // Units per second at full throttle.
  gearDrag: 0.06, // Extra drag with the wheels down.
  flapLift: 1.25, // Lift multiplier with flaps out.
  flapDrag: 0.22,
  damageHardLanding: 34, // Vertical speed above this hurts on touchdown.
  crashVerticalSpeed: 7.5,
};

export const WORLD = {
  // Course length in segments: 9 runway + valley + return leg.
  totalSegments: 300,
  // Gentle valley walls: ground rises with the square of lateral offset.
  wallSteepness: 0.0016,
  wallStart: 260, // Metres from centreline before the walls begin.
  maxWallHeight: 190,
  // A river crosses the valley and runs beside the course for a stretch.
  riverAtSegment: 96,
  riverWidth: 46,
};

export const SCORING = {
  ringPoints: 100,
  ringCentreBonus: 25, // Flying through the middle of the ring.
  landingBase: 300,
  landingSmoothBonus: 200, // A gentle touchdown earns the rest.
  fuelBonusPerUnit: 2, // Leftover fuel, at mission end.
  timeBonusPerSecond: 1, // Under the mission par time.
};

// Three sorties over the same valley. Same sky, same runway, different
// jobs: rings to thread, a low river run, and a race against the clock.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Valley Ring Run',
    tagline: 'Thread 8 rings over the valley, then bring her home.',
    parSeconds: 420,
    rings: [
      { segment: 30, x: -40, height: 55, radius: 26 },
      { segment: 48, x: 60, height: 70, radius: 26 },
      { segment: 66, x: -20, height: 48, radius: 24 },
      { segment: 86, x: 90, height: 85, radius: 26 },
      { segment: 106, x: -70, height: 60, radius: 24 },
      { segment: 128, x: 30, height: 95, radius: 26 },
      { segment: 150, x: -50, height: 70, radius: 24 },
      { segment: 172, x: 0, height: 55, radius: 26 },
    ],
  },
  {
    id: 'river-low',
    name: 'River Low Pass',
    tagline: 'Stay low over the river, slip 6 gates, mind the bridges.',
    parSeconds: 360,
    rings: [
      { segment: 34, x: 10, height: 26, radius: 22 },
      { segment: 52, x: -30, height: 30, radius: 22 },
      { segment: 70, x: 20, height: 24, radius: 20 },
      { segment: 88, x: -10, height: 28, radius: 22 },
      { segment: 108, x: 40, height: 26, radius: 20 },
      { segment: 128, x: 0, height: 30, radius: 22 },
    ],
  },
  {
    id: 'time-trial',
    name: 'Dawn Time Trial',
    tagline: '10 rings, full throttle, beat the clock home.',
    parSeconds: 300,
    rings: [
      { segment: 26, x: 0, height: 60, radius: 24 },
      { segment: 42, x: -60, height: 75, radius: 24 },
      { segment: 58, x: 70, height: 60, radius: 24 },
      { segment: 74, x: -30, height: 80, radius: 24 },
      { segment: 92, x: 50, height: 65, radius: 24 },
      { segment: 110, x: -80, height: 90, radius: 24 },
      { segment: 128, x: 20, height: 55, radius: 24 },
      { segment: 146, x: -40, height: 70, radius: 24 },
      { segment: 164, x: 60, height: 60, radius: 24 },
      { segment: 182, x: 0, height: 50, radius: 24 },
    ],
  },
];

export const PALETTE = {
  skyTop: '#2e6fb0',
  skyMid: '#7db3dd',
  skyHorizon: '#f6d9a0',
  sunCore: '#fff3c4',
  sunGlow: 'rgba(255, 214, 120, 0.55)',
  grassLight: '#7fae4e',
  grassDark: '#749c46',
  fieldGold: '#c9a94f',
  fieldGreen: '#5d8f3e',
  forest: '#3f7031',
  river: '#4a90c2',
  riverBank: '#c2b280',
  townRoof: '#b65c43',
  townWall: '#e8dcc8',
  runway: '#3c3f45',
  runwayMark: '#f2f2e8',
  ringNext: '#ffd23e',
  ringLater: '#5aa9e6',
  ringDone: '#7ed957',
  panel: '#20242c',
  panelEdge: '#3a4150',
  lampAmber: '#ffb347',
  lampGreen: '#7ed957',
  lampRed: '#ff5a4e',
  hudText: '#eaf2f8',
  hudDim: '#9fb4c4',
};
