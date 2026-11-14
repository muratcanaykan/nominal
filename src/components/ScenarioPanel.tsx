// Scenarios side panel: pick a crew member, move them, and play out alerts. Each card says what happens and who is
// told, coloured by alert level.

import { useState } from 'react';
import { CREW, CREW_BY_ID, PROFILES, type AstronautId, type ProfileId } from '../domain/crew';
import { isSuited, LOCATION_IDS, LOCATIONS, locationOf, type LocationId } from '../domain/locations';
import { activeScenario, type ScenarioId } from '../domain/scenarios';
import { LEVEL_NAMES, type Level } from '../domain/vitals';
import { useRoom, useStore } from '../lib/useRoom';
import { Avatar } from './Avatar';
import { formatDelay, levelClass } from './bits';
import { icons, type IconName } from './icons';

interface CardDef {
  id: ScenarioId;
  title: string;
  detail: string;
  level: Level | 'nodata';
  icon: IconName;
}

const READINGS: CardDef[] = [
  { id: 'nominal', title: 'All normal', detail: 'Readings back in range', level: 0, icon: 'check' },
  { id: 'caution', title: 'High heart rate', detail: '113 bpm · only the astronaut', level: 1, icon: 'heart' },
  { id: 'lowGlucose', title: 'Low glucose', detail: '58 mg/dL · fingerstick check', level: 1, icon: 'drop' },
  { id: 'warning', title: 'Falling SpO₂', detail: '90 % · medical officer told', level: 2, icon: 'lungs' },
  { id: 'fever', title: 'Fever', detail: '38.5 °C · medical officer told', level: 2, icon: 'thermo' },
  { id: 'critical', title: 'Hypoxia', detail: '85 % · whole crew and Earth', level: 3, icon: 'alarm' },
  { id: 'nodata', title: 'Sensor offline', detail: 'The watch stops sending', level: 'nodata', icon: 'signalOff' },
];

const SUIT: CardDef[] = [
  { id: 'coldHand', title: 'Cold left hand', detail: '14 °C · numbness check', level: 1, icon: 'hand' },
  { id: 'shoulderPressure', title: 'Shoulder pressure', detail: '9 kPa · adjust position', level: 1, icon: 'shoulder' },
  { id: 'helmetCO2', title: 'Helmet CO₂ rising', detail: '11 mmHg · medical officer told', level: 2, icon: 'helmet' },
  { id: 'helmetWater', title: 'Water in helmet', detail: '140 mL · whole crew and Earth', level: 3, icon: 'water' },
];

const PLACE_ICONS: Record<LocationId, IconName> = { habitat: 'habitat', lab: 'lab', airlock: 'airlock', eva: 'outside' };

const PROFILE_SHORT: Record<ProfileId, string> = { leo: 'Earth orbit', lunar: 'Lunar orbit', mars: 'Mars base' };

function badge(level: Level | 'nodata') {
  return level === 'nodata' ? 'No data' : LEVEL_NAMES[level];
}

function Card({
  title,
  detail,
  level,
  icon,
  active,
  disabled,
  badgeText,
  onClick,
}: {
  title: string;
  detail: string;
  level: Level | 'nodata' | 'accent';
  icon: IconName;
  active?: boolean;
  disabled?: boolean;
  badgeText?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`scn-card ${level === 'accent' ? 'is-accent' : levelClass(level)}${active ? ' is-active' : ''}`}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="scn-card__icon">{icons[icon]}</span>
      <span className="scn-card__text">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      {badgeText && <span className="scn-card__badge">{badgeText}</span>}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="scn-section">
      <header className="scn-section__head">
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </header>
      {children}
    </section>
  );
}

export function ScenarioControls({ initialTarget }: { initialTarget: AstronautId }) {
  const store = useStore();
  const { state } = useRoom();
  const [target, setTarget] = useState<AstronautId>(initialTarget);
  const a = CREW_BY_ID[target];
  const active = activeScenario(state, target);
  const help = !!state?.help?.[target];
  const where = locationOf(state, target);
  const suited = isSuited(state, target);
  const run = (id: ScenarioId) => store.runScenario(target, id);

  return (
    <>
      <Section title="Crew member">
        <div className="scn-crew" role="radiogroup" aria-label="Crew member for the scenarios">
          {CREW.map((c) => (
            <button key={c.id} role="radio" aria-checked={target === c.id} className={`scn-crew__btn${target === c.id ? ' is-active' : ''}`} onClick={() => setTarget(c.id)}>
              <Avatar id={c.id} size={40} />
              <span>{c.callsign}</span>
            </button>
          ))}
        </div>
        <p className="scn-who">
          <strong>{a.name}</strong> · {a.cmo ? 'Medical officer' : a.role}
        </p>
      </Section>

      <Section title="Location" hint="Suit sensors work in the airlock and outside.">
        <div className="scn-places" role="radiogroup" aria-label={`Location of ${a.name}`}>
          {LOCATION_IDS.map((l) => (
            <button key={l} role="radio" aria-checked={where === l} className={`scn-place${where === l ? ' is-active' : ''}`} onClick={() => store.setLocation(target, l)}>
              {icons[PLACE_ICONS[l]]}
              <span>{LOCATIONS[l].short}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Vital signs">
        <div className="scn-cards">
          {READINGS.map((c) => (
            <Card key={c.id} {...c} badgeText={c.id === 'nominal' ? undefined : badge(c.level)} active={active === c.id} onClick={() => run(c.id)} />
          ))}
        </div>
      </Section>

      <Section title="Suit sensors" hint={suited ? undefined : `${a.name} is not suited. Move them to the airlock or outside.`}>
        <div className="scn-cards">
          {SUIT.map((c) => (
            <Card key={c.id} {...c} badgeText={badge(c.level)} active={active === c.id} disabled={!suited} onClick={() => run(c.id)} />
          ))}
        </div>
      </Section>

      <Section title="From the watch">
        <div className="scn-cards">
          <Card
            title={help ? 'Cancel help call' : 'Help call'}
            detail="Shows on the cabin screen"
            level={3}
            icon="sos"
            badgeText="Crew"
            active={help}
            onClick={() => (help ? store.cancelHelp(target) : store.requestHelp(target))}
          />
          <Card title="Ask mood" detail="The watch asks how they feel" level="accent" icon="mood" onClick={() => store.askMood(target)} />
          <Card
            title="Knee pain report"
            detail={suited ? 'In the suit: possible bends' : 'Self-reported · 4/10'}
            level={suited ? 2 : 1}
            icon="knee"
            badgeText={suited ? LEVEL_NAMES[2] : LEVEL_NAMES[1]}
            active={active === 'kneePain'}
            onClick={() => run('kneePain')}
          />
        </div>
      </Section>
    </>
  );
}

export function MissionControls() {
  const store = useStore();
  const { state } = useRoom();
  const [confirmReset, setConfirmReset] = useState(false);
  const profile = state?.profile ?? 'lunar';
  const solar = !!state?.spaceWeather?.sepAt;
  return (
    <>
      <Section title="Mission" hint="Sets the signal delay to Earth.">
        <div className="scn-missions" role="radiogroup" aria-label="Mission location">
          {(Object.keys(PROFILES) as ProfileId[]).map((p) => (
            <button key={p} role="radio" aria-checked={profile === p} className={`scn-mission${profile === p ? ' is-active' : ''}`} onClick={() => store.setProfile(p)}>
              <span className={`scn-planet scn-planet--${p}`} aria-hidden="true" />
              <strong>{PROFILE_SHORT[p]}</strong>
              <span>Earth {formatDelay(PROFILES[p].earthDelayMs)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Space weather">
        <button className={`scn-switch${solar ? ' is-on' : ''}`} role="switch" aria-checked={solar} onClick={() => store.simulateSolarEvent(!solar)}>
          <span className="scn-switch__icon">{icons.sun}</span>
          <span className="scn-card__text">
            <strong>Solar particle event</strong>
            <span>{solar ? 'Radiation advisory on every screen' : 'Simulate one; real events come from NASA DONKI'}</span>
          </span>
          <span className="scn-switch__track" aria-hidden="true">
            <span className="scn-switch__thumb" />
          </span>
        </button>
      </Section>

      <Section title="Demo">
        {confirmReset ? (
          <div className="scn-reset is-confirm">
            <span>Clear all scenarios and alerts?</span>
            <button
              className="scn-reset__yes"
              onClick={() => {
                store.resetDemo();
                setConfirmReset(false);
              }}
            >
              Reset
            </button>
            <button className="scn-reset__no" onClick={() => setConfirmReset(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button className="scn-reset" onClick={() => setConfirmReset(true)}>
            {icons.reset}
            <span>Reset demo</span>
          </button>
        )}
      </Section>
    </>
  );
}
