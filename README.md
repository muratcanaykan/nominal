# Nominal

**Stay nominal.** A crew health monitoring prototype for long-duration space missions.

> Built by team **SPARK HUB** during the NASA Space Apps Challenge 2026 for the challenge
> *Create Health Monitoring Software for Astronauts on Space Missions*.
> All physiological data in this prototype is **simulated**.

## Demo

- Live app: https://nominal.rteuceng.com — press **Take the 1-minute tour** for a guided walkthrough
- Demo video / slides: _coming soon_

## The challenge

Long missions expose astronauts to radiation, isolation, altered gravity and a closed environment, while the crew
carries much of the responsibility for noticing health changes in themselves. The challenge asks for a visual tool
that helps astronauts assess their own health and guides them on what to do.

## What it does

- **Watch** — each astronaut sees only their own indicators, colour-coded by status, with an info panel that explains
  each value and what to do, and a help button.
- **Tablet** — each astronaut's own detailed readings, short trends and history. The commander's tablet adds each crew
  member's duty status without any health values. The crew medical officer's tablet adds every crew member's details,
  trends and alert history.
- **Alertness check** — a 30-second reaction test on each tablet, modelled on the psychomotor vigilance test used in
  spaceflight to spot fatigue: a circle appears after a random wait and the crew member taps as fast as possible. The
  result (median reaction time, lapses over 500 ms, early taps) is compared with the crew member's own usual time,
  joined with last night's sleep, and shared with the medical officer. Six targets instead of the full test; the
  personal baselines and rating limits are prototype values.
- **Lab results** — a blood panel on each tablet and in the medical officer's view: ten values (sodium, potassium,
  chloride, bicarbonate, urea nitrogen, creatinine, calcium, albumin, alkaline phosphatase, ALT) before launch and the
  day after landing, with the lab range, the change and a small chart across all seven tests. The values are real
  measurements of an anonymised commercial spaceflight crew from NASA OSDR, one crew member per simulated astronaut;
  each value says why it matters in spaceflight. Blood tests are periodic, so this is not a live reading.
- **Nutrition** — each tablet logs what the crew member ate from the ISS standard menu (93 foods with NASA's nutrition
  values) and tracks the day against personal targets. Energy comes from the basal energy formula in NASA's nutrition
  guide × an activity factor, plus 200 kcal per spacewalk hour as NASA plans it; protein, calcium and fibre have
  targets, sodium and saturated fat have limits. BMI is shown for context only. Rule-based suggestions name the next
  foods for the meal the mission clock is at and say why (for example "31 g protein toward your 67 g"). Low glucose
  switches the suggestions to about 15 g of fast-acting carbohydrate. Live readings can point to a diet (low sodium for
  high blood pressure, lower sugar for high glucose, extra fluids for a fever); it only applies once the medical officer
  approves it, and the medical officer sees each crew member's intake for the day. Height, weight and age are
  simulated; the rules are prototype values, not dietary advice ([`src/domain/nutrition.ts`](src/domain/nutrition.ts),
  [`src/data/issMenu.ts`](src/data/issMenu.ts)).
- **Cabin screen** — a shared display that shows device connectivity, a live 3D view of the vehicle with where each
  crew member is, and only the alerts that need crew action. Routine health values stay private: in the cabin's 3D
  view only critical alerts and help calls are visible. Each crew alert carries a response checklist (reach the crew
  member, the kit, the first action, the airlock for a spacewalker, the medical officer, an update to Earth) that anyone
  on board ticks off; every screen shows who did which step, and the medical officer sees the progress. The steps are
  prototype examples, not medical procedures ([`src/domain/response.ts`](src/domain/response.ts)).
- **Tether pull** — spacewalkers stay clipped to a safety tether at the hatch. In a crew emergency on a spacewalk (a
  critical alert or a help call), the commander or the medical officer can pull the crew member back to the airlock
  from the cabin screen, the commander's crew status or the medical officer's crew view; a second tap confirms. Nobody
  else gets the button, and nobody can pull themselves. The crew member's watch, the cabin screen and the 3D view show
  the pull, and the response checklist records who started it. The powered reel is a prototype concept
  ([`src/domain/tether.ts`](src/domain/tether.ts)).
- **Suit sensors and body map** — while a crew member wears the spacesuit (airlock or spacewalk), sensors in the
  helmet, gloves and shoulders report helmet CO₂, water in the helmet, fingertip temperature and suit contact pressure.
  A body map on the tablet and in the medical officer's view colours the region that needs attention. Every region of
  the body map and of the 3D astronaut is clickable: it shows the live readings there, what the region does, how
  spaceflight affects it, how it is measured, when to see the medical officer and how to prevent problems. A cold hand
  asks "Do your fingers feel numb?" on the watch before the medical officer is told. Joint pain can be reported from
  the watch; in the suit it is treated as possible decompression sickness.
- **3D mission simulation** — the vehicle and the crew in 3D: move an astronaut between the modules, the airlock and a
  spacewalk, and change their readings with sliders. Suit regions glow in the alert colour, and a simulated solar
  particle event shows as a particle stream. Every screen follows the simulation.
  Arms and legs move (a help call waves, a cold hand shakes), data pulses show telemetry going to the vehicle, warnings
  going to the medical officer and critical alerts travelling to Earth with the mission's signal delay. The cabin
  screen hangs inside the habitat module; clicking it opens the live cabin screen. The view has a full-screen mode.
  Crew in the airlock or outside wear the spacesuit; inside the vehicle they wear a coverall over a smart shirt, with
  the watch on the left wrist, whose screen shows the wearer's status colour. The coverall models are split into body
  regions by part name, so clicking and region alerts work the same way ([`src/three/crewGeometry.ts`](src/three/crewGeometry.ts)).
  The coverall crew models were made by our team with Claude and built with trimesh
  ([`public/models/crew-female.glb`](public/models/crew-female.glb), [`public/models/crew-male.glb`](public/models/crew-male.glb)).
- **Early warning** — when a reading drifts steadily away from the crew member's own baseline toward the next alert
  level, the watch, the tablet and the medical officer see how soon it will get there (for example "Blood oxygen
  falling · Warning in about 1 min"), so the crew can act before the alert. Normal sensor noise does not trigger it, and neither does a sudden jump
  that has already stopped: the change has to be gradual and still going.
- **Messages to Earth** — the medical officer sends flight surgeons a status update, a request for guidance or an all
  clear about a crew member (ticking the Earth step of a response checklist sends an update too). Each message shows
  its journey: out across the signal delay, the flight surgeon answering, the reply coming back. From lunar orbit that
  is seconds; from the Mars base about 24 minutes, which is why the crew acts first. The cabin screen shows only that an
  update was sent and when the reply is due. Replies are simulated, and the flight surgeon's answer time is shortened
  to 15 seconds for the demo.
- **Radiation dose** — every crew member's tablet shows a simulated personal dosimeter: the dose rate now, what
  raises it (a spacewalk has less shielding; a solar particle event from NASA DONKI or the demo raises it sharply) and
  the dose received this mission against the career limit. The medical officer sees one line per crew member. Base
  rates come from published measurements; the spacewalk and solar event factors are prototype assumptions.
- **Readable at a glance** — alert levels have a shape as well as a colour (● nominal, ▲ caution, ◆ warning,
  ■ critical, ○ no data), so they do not depend on colour vision. While an alert needs the crew, the demo page and the
  cabin screen glow red at the edges and play a short alert tone (it can be switched off).
- **Escalation** — three alert levels decide who is told: the astronaut alone, then the crew medical officer, then the
  whole crew and flight surgeons on Earth (with realistic communication delay).
- **Guided tour** — one health event played live in about a minute: a spacewalker's blood oxygen drifts down, and
  each step highlights the screen that changes and who is told, from the astronaut's own watch to the medical officer,
  the whole crew and flight surgeons on Earth.
- **Narrator** — while you play scenarios, short captions say what just happened and who was told (own watch,
  medical officer, cabin screen, Earth). It can be turned off in the demo header.
- **Live demo** — pick a crew member (the profile button at the bottom left) to see the mission through their devices: the cabin screen, the crew's watches and
  that person's tablet. Scenarios change the simulated readings; every open screen updates live.

## Future work

- **Suit voice link** — the watch microphone inside the suit carries the astronaut's voice to the cabin screen as
  live speech and text. Saying "help" or "mayday" starts a help call hands-free, which matters in pressurised gloves
  that make touching a watch hard.
- **Real devices and network** — the watches, suit sensors and tablets on the vehicle's own network instead of the web
  demo's cloud sync, and personal baselines learned from each crew member's pre-flight data.

## How it works

- React + TypeScript single-page app, built with Vite. The 3D view uses three.js with React Three Fiber and loads only
  when it is shown.
- A deterministic simulator generates indicator values from time, so every screen shows the same numbers.
- Firebase Realtime Database syncs user actions (help requests, acknowledgements, mood check-ins) between devices in
  real time. Each demo session is a separate room.
- Prototype versus a real vehicle: in a spacecraft the watches, tablets and cabin screen would share data over the
  vehicle's own network and keep working without a link to Earth. Firebase stands in for that network in this web demo,
  and all physiological data is simulated.

## NASA data & resources used

- NASA Human Research Program — [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/)
- NASA Human Research Program — [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)
- NASA Human Research Program — [Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) via the
  [CCMC DONKI API](https://ccmc.gsfc.nasa.gov/tools/DONKI/), where DONKI moved on 30 September 2026 (the old
  [api.nasa.gov](https://api.nasa.gov/) address is the fallback) — a solar energetic particle event in the last 72 hours
  raises a radiation advisory on every screen, and recent space weather events are listed in the medical officer view.
  Data is saved at build time ([`scripts/fetch-donki.mjs`](scripts/fetch-donki.mjs)) and refreshed live in the
  browser.
- NASA Open Science Data Repository — [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575), Inspiration4
  Comprehensive Metabolic Panel. Each simulated astronaut's glucose baseline comes from the real pre-flight glucose of
  one anonymised Inspiration4 crew member; the medical officer view shows that baseline and the post-landing value.
  The lab results panel shows ten more values from the same panel, with the lab's reference ranges, at all seven
  timepoints (three before launch, four after return); eGFR is left out because the file reports it with race-based
  labels ([`scripts/fetch-osdr.mjs`](scripts/fetch-osdr.mjs) → [`src/data/osdr-inspiration4.json`](src/data/osdr-inspiration4.json),
  [`src/domain/labs.ts`](src/domain/labs.ts)).

- NASA STEMonstrations — [Nutrition](https://www.nasa.gov/stem-content/stemonstrations-nutrition/) classroom
  connection ([PDF](https://www.nasa.gov/wp-content/uploads/2023/03/stemonstrations-nutrition.pdf)). Its appendix,
  International Space Station Standard Menu Nutritional Data, gives the 93 foods and their values in the nutrition
  panel ([`src/data/issMenu.ts`](src/data/issMenu.ts)); its worked example gives the basal energy formula and the
  activity factors.
- NASA — [Exploration nutritional requirements (JSC-67378)](https://ntrs.nasa.gov/api/citations/20205008306/downloads/JSC67378%20Expl%20Nutr%20Reqs%20042020.pdf):
  an extra 200 kcal for every hour of a spacewalk.
- [Food for Space Flight](https://www.worldspaceflight.com/bios/spacefood.php) (from a NASA fact sheet) — the same basal
  energy formula was used to plan Space Shuttle crew diets.
- NASA 3D Resources — [Astronaut](https://science.nasa.gov/3d-resources/) model
  ([GitHub mirror](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Astronaut)), used in the 3D
  simulation. For the web the mesh was decompressed and its textures removed
  ([`public/models/astronaut-web.glb`](public/models/astronaut-web.glb)); the app splits it into body regions and
  renders it with its own materials.

## Space agency partner resources

- Canadian Space Agency — [Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- Canadian Space Agency — [Bio-Monitor: Keeping an eye on astronauts' vital signs](https://www.asc-csa.gc.ca/eng/sciences/astroskin.asp):
  the smart shirt tested on the space station is the model for the sensor shirt crew members wear inside the vehicle.

## Other references

### Health thresholds and background

Thresholds are prototype values and are not clinically validated. Each indicator lists its sources next to it in
[`src/domain/vitals.ts`](src/domain/vitals.ts):

- American Heart Association — normal resting heart rate (60–100 bpm) and
  [Understanding Blood Pressure Readings](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings).
- Mayo Clinic — [Hypoxemia](https://www.mayoclinic.org/symptoms/hypoxemia/basics/definition/sym-20050930) (normal
  pulse oximetry 95–100 %), fever and hypothermia thresholds.
- Stahn A.C. et al., "Increased core body temperature in astronauts during long-duration space missions",
  Scientific Reports 7, 16180 (2017).
- American Diabetes Association — hypoglycaemia levels 1 and 2 (below 70 and 54 mg/dL).
- Battelino T. et al., "Clinical Targets for Continuous Glucose Monitoring Data Interpretation", Diabetes Care 42(8),
  2019.
- Watson N.F. et al., "Recommended Amount of Sleep for a Healthy Adult", Sleep 38(6), 2015.
- NASA Human Research Program — Risk of Injury and Compromised Performance Due to EVA Operations (glove and shoulder
  injuries), Risk of Decompression Sickness, and behavioural conditions (Risks of Human Spaceflight).
- NASA Human Research Program — Risks of Human Spaceflight on cardiovascular adaptations, spaceflight associated
  neuro-ocular syndrome, bone loss and muscle loss (background for the body region explanations in
  [`src/domain/regionInfo.ts`](src/domain/regionInfo.ts)) and for why each lab value matters in spaceflight (fluid
  shifts, renal stone formation, muscle and nutrition; [`src/domain/labs.ts`](src/domain/labs.ts)).
- Heus R., Daanen H.A.M., Havenith G., "Physiological criteria for functioning of hands in the cold: a review",
  Applied Ergonomics 26(1), 1995.
- Anderson A. et al., in-suit sensor systems for characterising human–spacesuit interaction, International Conference
  on Environmental Systems, 2015.
- NASA-STD-3001 Volume 2 — NASA Space Flight Human-System Standard (carbon dioxide limits).
- Law J. et al., carbon dioxide levels and reported headaches on the International Space Station, Journal of
  Occupational and Environmental Medicine, 2014.
- NASA mishap investigation report on water entering a spacesuit helmet during a 2013 spacewalk.

### Alertness check

- Basner M., Dinges D.F., "Maximizing sensitivity of the psychomotor vigilance test (PVT) to sleep loss", Sleep 34(5),
  2011 — lapse (over 500 ms) and false start (under 100 ms) rules.
- Basner M. et al., "Development and Validation of the Cognition Test Battery for Spaceflight", Aerospace Medicine and
  Human Performance 86(11), 2015 — the reaction-time test in the spaceflight cognition battery.

### Radiation dose

Base dose rates and the limit used in [`src/domain/radiation.ts`](src/domain/radiation.ts); the spacewalk and solar
particle event factors are prototype assumptions:

- Low Earth orbit: about 0.5 mSv per day, within the 0.3–0.8 mSv per day typically received by space station crews
  (NASA Human Research Program, Risks of Human Spaceflight: space radiation).
- Zeitlin C. et al., "Measurements of Energetic Particle Radiation in Transit to Mars on the Mars Science Laboratory",
  Science 340(6136), 2013 — 1.84 mSv per day in deep space (used for lunar orbit).
- Hassler D.M. et al., "Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity
  Rover", Science 343(6169), 2014 — 0.64 mSv per day on the surface of Mars.
- NASA-STD-3001 Volume 1 — NASA Space Flight Human-System Standard, crew health (600 mSv career effective dose
  limit).

### Nutrition

Targets and rules used in [`src/domain/nutrition.ts`](src/domain/nutrition.ts); the activity factor, the planned
spacewalk length and the suggestion scoring are prototype assumptions:

- U.S. Department of Agriculture and U.S. Department of Health and Human Services,
  [Dietary Guidelines for Americans, 2020–2025](https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf),
  Appendix 1 — calcium 1,000 mg, fibre 14 g per 1,000 kcal, sodium under 2,300 mg, saturated fat under 10 % of energy.
- Institute of Medicine, [Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol,
  Protein, and Amino Acids](https://nap.nationalacademies.org/catalog/10490) (2005) — protein 0.8 g per kg body weight.
- U.S. Food and Drug Administration, [21 CFR 101.61](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-D/section-101.61)
  — "low sodium" means 140 mg or less per serving.
- American Diabetes Association — [Hypoglycemia (low blood glucose)](https://diabetes.org/living-with-diabetes/hypoglycemia-low-blood-glucose):
  the 15-15 rule, about 15 g of fast-acting carbohydrate and a recheck after 15 minutes.

### Software, libraries and fonts

| Used for | Project | Licence |
| --- | --- | --- |
| User interface | [React](https://react.dev/) and React DOM 19 | MIT |
| Page routes | [React Router](https://reactrouter.com/) 8 | MIT |
| Animations | [Motion](https://motion.dev/) 14 | MIT |
| 3D view | [three.js](https://threejs.org/), [React Three Fiber](https://r3f.docs.pmnd.rs/), [drei](https://github.com/pmndrs/drei), [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) | MIT |
| 3D glow effects | [postprocessing](https://github.com/pmndrs/postprocessing) | Zlib |
| Live sync and anonymous sign-in | [Firebase JavaScript SDK](https://firebase.google.com/) (Realtime Database, Authentication) | Apache-2.0 |
| QR codes | [qrcode](https://github.com/soldair/node-qrcode) | MIT |
| Build and tests | [Vite](https://vite.dev/), [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react), [Vitest](https://vitest.dev/) | MIT |
| Language | [TypeScript](https://www.typescriptlang.org/), type definitions from [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (`@types/react`, `@types/react-dom`, `@types/three`, `@types/qrcode`) | Apache-2.0, MIT |
| Preparing the 3D model (one-off) | [glTF Transform](https://gltf-transform.dev/), [draco3dgltf](https://github.com/google/draco) | MIT, Apache-2.0 |
| Building the coverall crew models (one-off) | [trimesh](https://github.com/mikedh/trimesh) | MIT |
| Typeface | [Manrope](https://fonts.google.com/specimen/Manrope) via Google Fonts | SIL Open Font License 1.1 |

### Services and APIs

- NASA DONKI API — the [CCMC DONKI API](https://ccmc.gsfc.nasa.gov/tools/DONKI/) (`ccmc.gsfc.nasa.gov/DONKI-API`), with
  [api.nasa.gov](https://api.nasa.gov/) (`api.nasa.gov/DONKI`) as the fallback: solar particle events and other space
  weather, saved at build time and refreshed live in the browser.
- NASA OSDR data download (`osdr.nasa.gov/geode-py/ws/studies/OSD-575/download`) — the Inspiration4 metabolic panel
  file behind the glucose baselines and the lab results, fetched by `npm run data:osdr`.
- Firebase Realtime Database and Firebase Authentication (anonymous sign-in) — live sync of demo rooms between devices.
- Google Fonts — the Manrope typeface.
- Cloudflare Pages — hosting of the website.
- Browser APIs — WebGL (3D view), Web Audio API (alarm sound), Vibration API (watch alerts on phones), Clipboard API
  (copy room link), Fullscreen API (3D view), Web Storage (remembered view, sound setting, PIN unlock and a short space weather cache) and
  IntersectionObserver (3D views pause off screen).

## Use of AI

- The source code was written with Claude Code (Anthropic). This includes the simulated data generator, the
  threshold tables and the in-app guidance texts, which live in the source code.
- Commits written with AI assistance carry a `Co-Authored-By: Claude` trailer.
- No AI-generated images, video or audio are used.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web config
npm run dev
```

## Team

**SPARK HUB**

- Muratcan Aykan
- Ece İrem Şaş
- Rümeyda Sürmeli
- Rümeysa Esilay Sarı
- Zehra Yalçınkaya
- Ramazan Giyici
