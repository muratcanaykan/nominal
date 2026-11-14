# Nominal

**Stay nominal.** A crew health monitoring prototype for long-duration space missions.

> Built during the NASA Space Apps Challenge 2026 for the challenge
> *Create Health Monitoring Software for Astronauts on Space Missions*.
> Work in progress. All physiological data in this prototype is **simulated**.

## Demo

- Live app: https://nasa.rteuceng.com
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
- **Cabin screen** — a shared display that shows device connectivity, a map of where each crew member is, and only
  the alerts that need crew action. Routine health values stay private.
- **Suit sensors and body map** — while a crew member wears the spacesuit (airlock or spacewalk), sensors in the
  helmet, gloves and shoulders report helmet CO₂, water in the helmet, fingertip temperature and suit contact pressure.
  A body map on the tablet and in the medical officer's view colours the region that needs attention. A cold hand
  asks "Do your fingers feel numb?" on the watch before the medical officer is told. Joint pain can be reported from
  the watch; in the suit it is treated as possible decompression sickness.
- **3D mission simulation** — the vehicle and the crew in 3D: move an astronaut between the modules, the airlock and a
  spacewalk, and change their readings with sliders. Suit regions glow in the alert colour, and a simulated solar
  particle event shows as a particle stream. Every screen follows the simulation.
  Arms and legs move (a help call waves, a cold hand shakes), data pulses show telemetry going to the vehicle, warnings
  going to the medical officer and critical alerts travelling to Earth with the mission's signal delay. The cabin
  screen hangs inside the habitat module; clicking it opens the live cabin screen. The view has a full-screen mode.
- **Escalation** — three alert levels decide who is told: the astronaut alone, then the crew medical officer, then the
  whole crew and flight surgeons on Earth (with realistic communication delay).
- **Live demo** — pick a crew member (the profile button at the bottom left) to see the mission through their devices: the cabin screen, the crew's watches and
  that person's tablet. Scenarios change the simulated readings; every open screen updates live.

## How it works

- React + TypeScript single-page app, built with Vite. The 3D view uses three.js with React Three Fiber and loads only
  when it is shown.
- A deterministic simulator generates indicator values from time, so every screen shows the same numbers.
- Firebase Realtime Database syncs user actions (help requests, acknowledgements, mood check-ins) between devices in
  real time. Each demo session is a separate room.

## NASA data & resources used

- NASA Human Research Program — [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/)
- NASA Human Research Program — [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)
- NASA Human Research Program — [Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) via [api.nasa.gov](https://api.nasa.gov/)
  — a solar energetic particle event in the last 72 hours raises a radiation advisory on every screen, and recent
  space weather events are listed in the medical officer view. Data is saved at build time
  ([`scripts/fetch-donki.mjs`](scripts/fetch-donki.mjs)) and refreshed live in the browser.
- NASA Open Science Data Repository — [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575), Inspiration4
  Comprehensive Metabolic Panel. Each simulated astronaut's glucose baseline comes from the real pre-flight glucose of
  one anonymised Inspiration4 crew member; the medical officer view shows that baseline and the post-landing value
  ([`scripts/fetch-osdr.mjs`](scripts/fetch-osdr.mjs) → [`src/data/osdr-inspiration4.json`](src/data/osdr-inspiration4.json)).

- NASA 3D Resources — [Astronaut](https://science.nasa.gov/3d-resources/) model
  ([GitHub mirror](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Astronaut)), used in the 3D
  simulation. For the web the mesh was decompressed and its textures removed
  ([`public/models/astronaut-web.glb`](public/models/astronaut-web.glb)); the app splits it into body regions and
  renders it with its own materials.

## Space agency partner resources

- Canadian Space Agency — [Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)

## Other references

Threshold references are listed next to each indicator in [`src/domain/vitals.ts`](src/domain/vitals.ts).
Thresholds are prototype values and are not clinically validated.

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

_To be added._
