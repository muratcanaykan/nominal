// Temporary page for the team: the same watch and cabin screen in three visual directions.
// Turkish copy on purpose (internal tool); remove once a direction is chosen.

import { useMemo } from 'react';
import { CabinScreen } from '../components/CabinScreen';
import { WatchFace } from '../components/WatchFace';
import type { Variant } from '../components/bits';
import { SCENARIOS, type ScenarioId } from '../domain/scenarios';
import { MemoryBackend, RoomStore } from '../lib/store';
import { RoomContext, useNow, useRoom, useStore } from '../lib/useRoom';

const DIRECTIONS: { id: Variant; letter: string; name: string; desc: string }[] = [
  {
    id: 'mission',
    letter: 'A',
    name: 'Görev Kontrol',
    desc: 'Telemetri ekranı hissi: koyu zemin, eşit aralıklı rakamlar, saat kadranında 60 çentikli bir gösterge. Teknik ve ciddi.',
  },
  {
    id: 'glass',
    letter: 'B',
    name: 'Klinik Cam',
    desc: 'Modern bir sağlık cihazı: buzlu cam paneller, yumuşak halkalar, büyük yuvarlak rakamlar, yaylanan geçişler. Sakin ve anlaşılır.',
  },
  {
    id: 'suit',
    letter: 'C',
    name: 'Uzay Giysisi',
    desc: 'Giysi üzerindeki kontrol paneli: köşeli kasa, kalın dar harfler, blok göstergeler, kritik durumda ikaz şeritleri. Sert ve endüstriyel.',
  },
];

const BUTTONS: { id: ScenarioId; label: string; hint: string }[] = [
  { id: 'nominal', label: 'Normal', hint: 'Seviye 0' },
  { id: 'caution', label: 'Dikkat', hint: 'Nabız 113 · seviye 1' },
  { id: 'warning', label: 'Uyarı', hint: 'SpO₂ 90 · seviye 2' },
  { id: 'critical', label: 'Kritik', hint: 'SpO₂ 85 · seviye 3' },
  { id: 'nodata', label: 'Veri yok', hint: 'Sensör koptu' },
];

function Controls() {
  const store = useStore();
  const { state } = useRoom();
  const help = state?.help?.['02'];
  const active = (() => {
    if (state?.disconnects?.['02']) return 'nodata';
    const o = state?.overrides?.['02'];
    if (!o) return 'nominal';
    return (Object.keys(SCENARIOS) as ScenarioId[]).find((id) => {
      const t = SCENARIOS[id].targets;
      return t && Object.keys(t).length === Object.keys(o).length && Object.entries(t).every(([k, v]) => o[k as keyof typeof o]?.target === v);
    });
  })();
  return (
    <div className="dir-controls" role="group" aria-label="Senaryo">
      <span className="dir-controls__who">Daniel Okafor · uzay yürüyüşünde</span>
      <div className="dir-controls__row">
        {BUTTONS.map((b) => (
          <button
            key={b.id}
            className={`dir-btn${active === b.id ? ' is-active' : ''}`}
            onClick={() => store.runScenario('02', b.id)}
          >
            <span>{b.label}</span>
            <small>{b.hint}</small>
          </button>
        ))}
        <button className={`dir-btn${help ? ' is-active' : ''}`} onClick={() => (help ? store.cancelHelp('02') : store.requestHelp('02'))}>
          <span>Yardım çağrısı</span>
          <small>Saatten elle</small>
        </button>
      </div>
    </div>
  );
}

function Stage() {
  const now = useNow(250);
  return (
    <>
      {DIRECTIONS.map((d) => (
        <section key={d.id} className={`dir dir--${d.id} v-${d.id}`}>
          <div className="dir__inner">
            <header className="dir__head">
              <span className="dir__letter">{d.letter}</span>
              <div>
                <h2>{d.name}</h2>
                <p>{d.desc}</p>
              </div>
            </header>
            <div className="dir__stage">
              <WatchFace variant={d.id} astronautId="02" now={now} />
              <CabinScreen variant={d.id} now={now} />
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

export function Directions() {
  // In-memory store: lives as long as the page, no cleanup needed.
  const store = useMemo(() => new RoomStore(new MemoryBackend()), []);
  return (
    <RoomContext.Provider value={store}>
      <div className="dir-page">
        <header className="dir-intro">
          <p className="dir-intro__eyebrow">Nominal · takım için geçici sayfa</p>
          <h1>Görsel yön seçimi</h1>
          <p>
            Aynı saat ve aynı ortak ekran, üç farklı stilde. Aşağıdaki düğmelerle uzay yürüyüşündeki astronotun durumunu
            değiştirin ve üç yönün uyarıları nasıl gösterdiğine bakın. Saatteki <b>i</b> düğmesi açıklama panelini,
            ortak ekrandaki <b>I'm responding</b> müdahaleyi üstlenmeyi gösterir.
          </p>
          <p className="dir-intro__rule">
            Seviye 1 ve 2 ortak ekranda görünmez (gizlilik). Seviye 3 ve yardım çağrısı ortak ekrana düşer.
          </p>
        </header>
        <div className="dir-sticky">
          <Controls />
        </div>
        <Stage />
      </div>
    </RoomContext.Provider>
  );
}
