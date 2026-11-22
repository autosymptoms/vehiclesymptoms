# Driver safety and sound examples review

Reviewed November 21, 2026. This review covers urgent instructions in the symptom guides, related warning lights and charging codes, and the source and labeling of the sound recording. The public site is written for U.S. drivers.

## What changed

- Across 47 guides, 180 existing result records changed. The revisions address advice to test-drive suspect brakes or steering, run or rev an engine after a stop instruction, approach smoke or escaping coolant, search for a fuel leak by smell, or wait for visible flame or worsening symptoms before seeking emergency help.
- The driving instructions for transmission overheating now account for the vehicle’s own stop, idle or shutdown message. Charging codes P0562, P0563, P0620, P0621 and P0622 distinguish an active charging warning from a stored code on a vehicle operating normally. The urgent condition appears before the routine instruction, including in the driving FAQ.
- The sound page provides an eight-second excerpt of a real in-car whir recorded by watercool, released under CC0. Its cause is unknown. The local player links to the guide for humming or whirring while moving.

## Evidence

The revised guides and light pages name the sources used for the guidance. The following examples illustrate how reviewers resolved conflicting instructions.

| Question | Source and scope |
| --- | --- |
| What should a driver do when a vehicle fire is suspected? | [U.S. Fire Administration vehicle fire safety](https://www.usfa.fema.gov/prevention/vehicle-fires/) covers evacuation, distance, traffic, the hood and calling 911. |
| Which conditions warrant stopping and arranging a tow? | [AAA Car Care Guide](https://assets.goaaa.com/image/upload/v1698431472/AAA_Guide_CarCare_final.pdf), “When to call a professional,” covers braking, steering, smoke, steam, grinding and knocking. |
| What if a charging warning comes on while driving? | [Honda Civic owner’s manual, indicators](https://owners.honda.com/utility/download?path=%2Fstatic%2Fpdfs%2F2022%2FCivic+Hatchback%2F2022_Civic_5D_Dashboard_Details.pdf) directs the driver to stop safely and contact a dealer. The general guide does not give a remaining driving-time estimate. |
| How should drivers treat a worn or underinflated tire? | [NHTSA TireWise](https://www.nhtsa.gov/vehicle-safety/tires) covers cold inflation pressure, tread wear indicators and replacement. |
| What is known about the in-car sound? | [Creator’s original recording and license](https://freesound.org/people/watercool/sounds/410235/). The mechanical cause was not identified by the recorder. |

## Verification and limits

Build with `NODE_OPTIONS=--max-old-space-size=4096 npm run build`. Run `node --test tools/driver-stop.test.js tools/driver-fire-fume.test.js tools/sounds.test.js tools/guide-share.test.js tools/symptom-search.test.js tools/motovisuals.test.js` and `node tools/regression.js`. Confirm that guide records embedded in the generated pages and the saved-result API agree with the source. Confirm that the sound page serves the local MP3, names its creator and license, and links to the matching guide. Check playback on a device.

Structured checks cover rendering and routing. Audio decoding and a successful page request do not establish audible playback on every device. Existing price evidence, vehicle claims, recall mapping coverage, and professional approval of exact wording are tracked separately. The owner relayed technician feedback on the earlier site; this review does not attribute the revised wording or the sound recording to that technician.
