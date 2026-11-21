// Titles and system names follow the US English MotoVisuals catalog.
const topics = [
  { id: '908518', title: 'Wheel Bearing', guides: ['humming-noise-at-speed'], issue: /\bwheel (?:hub and )?bearings?\b|\bhub bearings?\b/i },
  { id: '902541', title: 'Brake Pads', guides: ['grinding-brakes', 'squealing-brakes', 'brake-pad-wear-light'], issue: /\bbrake pads?\b/i },
  { id: '902542', title: 'Warped Brake Rotor (Hotspots)', guides: ['car-shakes-when-braking'], issue: /\bbrake rotors?\b|\brotor (?:warp|pulsat)/i },
  { id: '902526', title: 'Brake Caliper Piston', guides: ['brakes-dragging', 'car-pulls-when-braking'], issue: /\bbrake calipers?\b/i },
  { id: '902513', title: 'Leak in Brake Hose', guides: ['brake-fluid-leak'], issue: /\bbrake hoses?\b/i },
  { id: '902516', title: 'Brake Master Cylinder', guides: ['soft-or-spongy-brake-pedal'], issue: /\bbrake master cylinder\b/i },
  { id: '902501', title: 'Brake System', guides: ['hard-brake-pedal', 'brake-warning-light-on', 'brake-warning-light'] },
  { id: '902530', title: 'ABS System', guides: ['abs-light-on', 'abs-light'], issue: /\b(?:anti-lock brak\w*|ABS (?:pump|module|unit))\b/i },
  { id: '902520', title: 'Parking Brake', guides: ['parking-brake-light', 'electronic-parking-brake-light'], issue: /\bparking brake\b/i },
  { id: '903001', title: 'Cooling System', guides: ['engine-overheating', 'temperature-gauge-fluctuating', 'engine-temperature-light', 'steam-from-under-hood'] },
  { id: '903036', title: 'Cooling Fan', guides: ['overheats-only-in-traffic'], issue: /\b(?:cooling|radiator) fans?\b/i },
  { id: '903028', title: 'Water Pump', guides: [], issue: /\bwater pumps?\b/i },
  { id: '908511', title: 'Shock Absorber', guides: ['bouncy-ride'], issue: /\bshock absorbers?\b/i },
  { id: '908024', title: 'Wheel Alignment', guides: ['uneven-tire-wear', 'car-pulls-to-one-side'], issue: /\bwheel alignment\b/i },
  { id: '901520', title: 'CV Axle', guides: ['clicking-when-turning'], issue: /\bCV (?:axle|joint)s?\b/i },
  { id: '908019', title: 'Power Steering Pump', guides: ['whining-when-turning-steering'], issue: /\bpower steering pump\b/i },
  { id: '907010', title: 'Clutch', guides: ['clutch-slipping'], issue: /\bclutch (?:slip|disc)/i },
  { id: '907519', title: 'Battery', guides: ['battery-keeps-dying', 'car-cranks-slowly'], issue: /\b12[- ]volt battery\b/i },
  { id: '907514', title: 'Alternator', guides: ['battery-light-on', 'battery-light'], issue: /\balternator\b/i },
  { id: '906016', title: 'AC Compressor', guides: ['ac-blowing-warm-air'], issue: /\b(?:AC|A\/C) compressor\b/i },
  { id: '906013', title: 'Heater Core', guides: ['heater-blowing-cold-air'], issue: /\bheater core\b/i },
  { id: '906520', title: 'Spark Plug', guides: [], issue: /\bspark plugs?\b/i },
  { id: '904029', title: 'Oxygen Sensor', guides: [], issue: /\b(?:oxygen|O2) sensors?\b/i },
  { id: '904514', title: 'Catalytic Converter Function', guides: [], issue: /\bcatalytic converters?\b/i }
];
module.exports = topics;
