# Nominal

**Stay nominal.** A crew health monitoring prototype for long-duration space missions.

> Built during the NASA Space Apps Challenge 2026 for the challenge
> *Create Health Monitoring Software for Astronauts on Space Missions*.
> Work in progress. All physiological data in this prototype is **simulated**.

## Demo

- Live app: _coming soon_
- Demo video / slides: _coming soon_

## The challenge

Long missions expose astronauts to radiation, isolation, altered gravity and a closed environment, while the crew
carries much of the responsibility for noticing health changes in themselves. The challenge asks for a visual tool
that helps astronauts assess their own health and guides them on what to do.

## What it does

- **Watch** — each astronaut sees only their own indicators, colour-coded by status, with an info panel that explains
  each value and what to do, and a help button.
- **Cabin screen** — a shared display that shows device connectivity and only the alerts that need crew action.
  Routine health values stay private.
- **Crew Medical Officer view** — detailed values, trends and alert history for the crew member responsible for care.
- **Escalation** — three alert levels decide who is told: the astronaut alone, then the crew medical officer, then the
  whole crew and flight surgeons on Earth (with realistic communication delay).

## How it works

- React + TypeScript single-page app, built with Vite.
- A deterministic simulator generates indicator values from time, so every screen shows the same numbers.
- Firebase Realtime Database syncs user actions (help requests, acknowledgements, mood check-ins) between devices in
  real time. Each demo session is a separate room.

## NASA data & resources used

- NASA Human Research Program — [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/)
- NASA Human Research Program — [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)
- NASA Human Research Program — [Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/)

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
