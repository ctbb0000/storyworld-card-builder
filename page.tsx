'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import CardPreview from '@/components/card/CardPreview';
import CardFront from '@/components/card/CardFront';
import CardBack from '@/components/card/CardBack';
import FieldInput from '@/components/ui/FieldInput';
import { CardData } from '@/types/card';
import { generateSerial } from '@/lib/utils';
import {
  COMPANIONS, BACKGROUNDS, VALUE_BADGES, OBJECTS,
  getCompanion, getBadge,
} from '@/lib/assets';

// ── Default card ───────────────────────────────────────────────
const EMPTY_CARD = (): CardData => ({
  companionId: 'rabbit',
  backgroundId: 'mountain',
  valueBadgeIds: [],
  placedObjects: [],
  stickers: [],
  studentName: '',
  grade: '',
  school: '',
  teacherName: '',
  somethingILove: '',
  somethingIWantPeopleToKnow: '',
  aPlaceImportantToMe: '',
  myCommunity: '',
  myNeighborhood: '',
  myHeritage: '',
  myLanguages: '',
  importantPerson: '',
  aDreamIHave: '',
  aSkillIWantToGrow: '',
  myGoal: '',
  artistOrPlaylist: '',
  favoriteSong: '',
  songMeaning: '',
  serialNumber: generateSerial(),
});

const AUTOSAVE_KEY = 'storyworld_draft_v1';

const STEPS = [
  { num: 1,  label: 'Companion'    },
  { num: 2,  label: 'Background'   },
  { num: 3,  label: 'Values'       },
  { num: 4,  label: 'Objects'      },
  { num: 5,  label: 'Stickers'     },
  { num: 6,  label: 'My Story'     },
  { num: 7,  label: 'My World'     },
  { num: 8,  label: 'My Future'    },
  { num: 9,  label: 'Soundtrack'   },
  { num: 10, label: 'Preview'      },
  { num: 11, label: 'Submit'       },
];

// ── Draggable object on card ───────────────────────────────────
function DraggableObject({
  objectId, x, y, scale: objScale, cardW, cardH, onMove, onRemove,
}: {
  objectId: string; x: number; y: number; scale: number;
  cardW: number; cardH: number;
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const obj = OBJECTS.find((o) => o.id === objectId);
  if (!obj) return null;
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragging.current = true;
    startPos.current = { mx: e.clientX, my: e.clientY, ox: x, oy: y };
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ((me.clientX - startPos.current.mx) / cardW) * 100;
      const dy = ((me.clientY - startPos.current.my) / cardH) * 100;
      const nx = Math.max(0, Math.min(100, startPos.current.ox + dx));
      const ny = Math.max(0, Math.min(100, startPos.current.oy + dy));
      onMove(nx, ny); // uses closure — name collision fix below
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%,-50%)',
        cursor: 'grab',
        zIndex: 20,
        userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <img src={obj.preview} alt={obj.label} style={{ height: 56 * objScale, width: 'auto', display: 'block', pointerEvents: 'none' }} />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 18, height: 18, borderRadius: '50%',
            background: '#c0522a', border: '2px solid white',
            color: 'white', fontSize: 9, fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
        >✕</button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function Home() {
  const [step, setStep] = useState(0); // 0-indexed
  const [card, setCard] = useState<CardData>(EMPTY_CARD);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitTimestamp, setSubmitTimestamp] = useState('');
  const [autosavePing, setAutosavePing] = useState(false);

  // ── Autosave to localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCard(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(card));
      setAutosavePing(true);
      const t = setTimeout(() => setAutosavePing(false), 1200);
      return () => clearTimeout(t);
    } catch {}
  }, [card]);

  const set = useCallback(<K extends keyof CardData>(key: K, val: CardData[K]) => {
    setCard((c) => ({ ...c, [key]: val }));
  }, []);

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_data: card }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSubmitTimestamp(new Date().toLocaleString());
      setSubmitted(true);
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── PNG download ──
  const handleDownload = async (side: 'front' | 'back') => {
    const { exportCardToPng, downloadBlob } = await import('@/lib/export');
    const blob = await exportCardToPng(
      side === 'front' ? 'card-front-export' : 'card-back-export',
      `storyworld_${card.studentName || 'card'}_${side}`
    );
    if (blob) downloadBlob(blob, `storyworld_${card.studentName || 'card'}_${side}.png`);
  };

  if (submitted) {
    return <ConfirmationScreen card={card} timestamp={submitTimestamp} onDownload={handleDownload}
      onNew={() => { setCard(EMPTY_CARD()); setStep(0); setSubmitted(false); }} />;
  }

  const stepIndex = step;
  const totalSteps = STEPS.length;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fdf6ec 0%,#f0e8d8 100%)', fontFamily: "'Nunito',sans-serif" }}>

      {/* Header */}
      <header style={{ background: '#c0522a', padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, background: '#b03a2e', border: '2px solid rgba(255,255,255,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Lilita One',cursive", color: 'white', fontSize: 17 }}>Ü</div>
          <div>
            <div style={{ fontFamily: "'Lilita One',cursive", color: 'white', fontSize: 15, lineHeight: 1.1 }}>STORYWORLD CARD BUILDER</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>U of U Storytelling Camp 2026</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {autosavePing && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>✓ Saved</span>}
          <a href="/admin" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, textDecoration: 'none', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6 }}>Admin →</a>
        </div>
      </header>

      {/* Step pills */}
      <div style={{ background: '#3a3530', padding: '10px 24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, width: 'max-content', margin: '0 auto' }}>
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                padding: '5px 12px', borderRadius: 999, border: 'none',
                background: i === stepIndex ? '#c0522a' : i < stepIndex ? '#7a8c5e' : '#5a4a3a',
                color: i <= stepIndex ? 'white' : '#9a8878',
                fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 11,
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {i < stepIndex ? '✓ ' : `${s.num}. `}{s.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          {/* Left: Step content */}
          <div style={{ flex: 1, minWidth: 0, background: 'white', borderRadius: 16, border: '2px solid #ede0cc', padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

            {step === 0 && <StepCompanion card={card} set={set} />}
            {step === 1 && <StepBackground card={card} set={set} />}
            {step === 2 && <StepValues card={card} set={set} />}
            {step === 3 && <StepObjects card={card} set={set} />}
            {step === 4 && <StepStickers />}
            {step === 5 && <StepMyStory card={card} set={set} />}
            {step === 6 && <StepMyWorld card={card} set={set} />}
            {step === 7 && <StepMyFuture card={card} set={set} />}
            {step === 8 && <StepSoundtrack card={card} set={set} />}
            {step === 9 && <StepPreview card={card} onDownload={handleDownload} />}
            {step === 10 && <StepSubmit card={card} onSubmit={handleSubmit} submitting={submitting} submitError={submitError} />}

            {/* Nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #ede0cc' }}>
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ padding: '10px 22px', borderRadius: 8, border: '2px solid #d4b896', background: 'transparent', color: step === 0 ? '#c4b4a4' : '#7a6a5a', fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 14, cursor: step === 0 ? 'not-allowed' : 'pointer' }}
              >← Back</button>
              <div style={{ fontSize: 12, color: '#9a8878', alignSelf: 'center' }}>
                Step {step + 1} of {totalSteps}
              </div>
              {step < totalSteps - 1 ? (
                <button
                  onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
                  style={{ padding: '10px 26px', borderRadius: 8, border: 'none', background: '#c0522a', color: 'white', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(192,82,42,0.3)' }}
                >Next →</button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ padding: '10px 26px', borderRadius: 8, border: 'none', background: submitting ? '#b0a090' : '#2d5a3d', color: 'white', fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 2px 8px rgba(45,90,61,0.35)' }}
                >{submitting ? '⏳ Submitting…' : '🖨️ Submit for Print'}</button>
              )}
            </div>
          </div>

          {/* Right: Live card preview */}
          <div style={{ width: 310, flexShrink: 0, position: 'sticky', top: 20 }}>
            <div style={{ fontFamily: "'Lilita One',cursive", color: '#c0522a', fontSize: 12, marginBottom: 10, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Preview</div>
            <CardPreview card={card} scale={1} />
          </div>
        </div>
      </main>

      {/* Hidden export elements */}
      <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', opacity: 0 }}>
        <CardFront card={card} id="card-front-export" scale={1} />
        <CardBack  card={card} id="card-back-export"  scale={1} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════

type SetFn = <K extends keyof CardData>(key: K, val: CardData[K]) => void;

// ── Step 1: Choose Companion ───────────────────────────────────
function StepCompanion({ card, set }: { card: CardData; set: SetFn }) {
  return (
    <div>
      <SH emoji="🐾">Choose Your Companion</SH>
      <p style={hint}>Your companion travels with you on your card. Pick one!</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {COMPANIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => set('companionId', c.id)}
            style={{
              borderRadius: 12, border: `2.5px solid ${card.companionId === c.id ? '#c0522a' : '#ede0cc'}`,
              background: card.companionId === c.id ? '#fff3ee' : 'white',
              padding: '12px 8px', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}
          >
            <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={c.front} alt={c.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><text y="48" font-size="48">🐾</text></svg>'; }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: card.companionId === c.id ? '#c0522a' : '#7a6a5a' }}>{c.label}</span>
            {card.companionId === c.id && <span style={{ fontSize: 10, color: '#c0522a', fontWeight: 800 }}>✓ Selected</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Choose Background ──────────────────────────────────
function StepBackground({ card, set }: { card: CardData; set: SetFn }) {
  return (
    <div>
      <SH emoji="🏔️">Choose Your Background</SH>
      <p style={hint}>This will be the scene behind your character.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            onClick={() => set('backgroundId', bg.id)}
            style={{
              borderRadius: 10, border: `2.5px solid ${card.backgroundId === bg.id ? '#c0522a' : '#ede0cc'}`,
              background: 'transparent', cursor: 'pointer', overflow: 'hidden', padding: 0, position: 'relative',
              transition: 'all 0.15s', boxShadow: card.backgroundId === bg.id ? '0 0 0 3px #c0522a44' : 'none',
            }}
          >
            <div style={{ width: '100%', paddingBottom: '56.25%', position: 'relative', overflow: 'hidden' }}>
              <img src={bg.path} alt={bg.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={{
              padding: '6px 10px',
              background: card.backgroundId === bg.id ? '#c0522a' : '#f5ede0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: card.backgroundId === bg.id ? 'white' : '#3a3530' }}>{bg.label}</span>
              {card.backgroundId === bg.id && <span style={{ fontSize: 10, color: 'white' }}>✓</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Choose Values (up to 3) ───────────────────────────
function StepValues({ card, set }: { card: CardData; set: SetFn }) {
  const selected = card.valueBadgeIds ?? [];
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      set('valueBadgeIds', selected.filter((x) => x !== id));
    } else if (selected.length < 3) {
      set('valueBadgeIds', [...selected, id]);
    }
  };

  return (
    <div>
      <SH emoji="⭐">Choose Your Values</SH>
      <p style={hint}>Pick up to 3 values that matter most to you. They'll appear as badges on your card.</p>
      <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {selected.map((id) => {
          const b = getBadge(id);
          return b ? (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff3ee', border: '1.5px solid #c0522a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#c0522a' }}>
              <img src={b.path} alt={b.label} style={{ width: 18, height: 18, objectFit: 'contain' }} />
              {b.label}
              <button onClick={() => toggle(id)} style={{ background: 'none', border: 'none', color: '#c0522a', cursor: 'pointer', fontSize: 11, fontWeight: 900, padding: '0 2px' }}>✕</button>
            </span>
          ) : null;
        })}
        {selected.length === 0 && <span style={{ fontSize: 12, color: '#9a8878' }}>None selected yet</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {VALUE_BADGES.map((b) => {
          const on = selected.includes(b.id);
          const maxed = selected.length >= 3 && !on;
          return (
            <button
              key={b.id}
              onClick={() => toggle(b.id)}
              disabled={maxed}
              style={{
                borderRadius: 10, border: `2px solid ${on ? '#c0522a' : '#ede0cc'}`,
                background: on ? '#fff3ee' : maxed ? '#f8f4f0' : 'white',
                padding: '10px 6px', cursor: maxed ? 'not-allowed' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                opacity: maxed ? 0.45 : 1, transition: 'all 0.15s',
              }}
            >
              <div style={{ width: 48, height: 48 }}>
                <img src={b.path} alt={b.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: on ? '#c0522a' : '#7a6a5a', textAlign: 'center', lineHeight: 1.2 }}>{b.label}</span>
              {on && <span style={{ fontSize: 9, color: '#c0522a', fontWeight: 800 }}>✓</span>}
            </button>
          );
        })}
      </div>
      <p style={{ ...hint, marginTop: 10 }}>{3 - selected.length} badge slot{3 - selected.length !== 1 ? 's' : ''} remaining</p>
    </div>
  );
}

// ── Step 4: Objects ────────────────────────────────────────────
function StepObjects({ card, set }: { card: CardData; set: SetFn }) {
  const placed = card.placedObjects ?? [];

  const addObject = (id: string) => {
    if (placed.length >= 5) return;
    set('placedObjects', [...placed, { objectId: id, x: 50, y: 50, scale: 1 }]);
  };

  const removeObject = (i: number) => {
    set('placedObjects', placed.filter((_, idx) => idx !== i));
  };

  const moveObject = (i: number, x: number, y: number) => {
    const updated = placed.map((p, idx) => idx === i ? { ...p, x, y } : p);
    set('placedObjects', updated);
  };

  // Card preview with drag area
  const cardW = 280, cardH = 260;

  return (
    <div>
      <SH emoji="🎒">Add Objects to Your Card</SH>
      <p style={hint}>Add up to 5 objects. Drag them on the preview to position them.</p>

      {/* Mini drag canvas */}
      <div style={{ marginBottom: 16, border: '2px dashed #d4b896', borderRadius: 10, padding: 8, background: '#fdf9f5' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9a8878', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card Canvas — Drag to position</div>
        <div style={{ position: 'relative', width: cardW, height: cardH, background: '#f5ede0', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #d4b896', margin: '0 auto' }}>
          {/* BG thumb */}
          {card.backgroundId && (() => {
            const bg = BACKGROUNDS.find((b) => b.id === card.backgroundId);
            return bg ? <img src={bg.path} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} /> : null;
          })()}
          {placed.map((po, i) => (
            <DraggableObject
              key={i}
              objectId={po.objectId}
              x={po.x} y={po.y}
              scale={po.scale}
              cardW={cardW} cardH={cardH}
              onMove={(x, y) => moveObject(i, x, y)}
              onRemove={() => removeObject(i)}
            />
          ))}
          {placed.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c4b4a4', fontSize: 12, fontWeight: 600 }}>
              Click an object below to add it
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9a8878', textAlign: 'center', marginTop: 6 }}>
          {placed.length}/5 objects placed
        </div>
      </div>

      {/* Object picker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {OBJECTS.map((obj) => {
          const used = placed.filter((p) => p.objectId === obj.id).length;
          const disabled = placed.length >= 5;
          return (
            <button
              key={obj.id}
              onClick={() => addObject(obj.id)}
              disabled={disabled}
              title={obj.label}
              style={{
                borderRadius: 8, border: `1.5px solid ${used > 0 ? '#c0522a' : '#ede0cc'}`,
                background: used > 0 ? '#fff3ee' : 'white',
                padding: '8px 4px', cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                opacity: disabled && used === 0 ? 0.5 : 1, transition: 'all 0.15s',
              }}
            >
              <img src={obj.preview} alt={obj.label} style={{ width: 44, height: 44, objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7a6a5a', textAlign: 'center', lineHeight: 1.2 }}>{obj.label}</span>
              {used > 0 && <span style={{ fontSize: 9, color: '#c0522a', fontWeight: 800 }}>+{used}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 5: Stickers (coming soon) ─────────────────────────────
function StepStickers() {
  return (
    <div>
      <SH emoji="✨">Add Stickers</SH>
      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f5ede0', borderRadius: 12, border: '2px dashed #d4b896' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
        <div style={{ fontFamily: "'Lilita One',cursive", color: '#c0522a', fontSize: 18, marginBottom: 6 }}>Stickers Coming Soon!</div>
        <p style={{ color: '#7a6a5a', fontSize: 13 }}>Sticker packs will be added in the next update. Skip to the next step for now!</p>
      </div>
    </div>
  );
}

// ── Step 6: My Story ───────────────────────────────────────────
function StepMyStory({ card, set }: { card: CardData; set: SetFn }) {
  return (
    <div>
      <SH emoji="📖">My Story</SH>
      <p style={hint}>Tell us about yourself — this goes on your card.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FieldInput label="Your Name" value={card.studentName} onChange={(v) => set('studentName', v)} placeholder="Your first name" maxLength={20} />
        <FieldInput label="Grade" value={card.grade} onChange={(v) => set('grade', v)} placeholder="6th Grade" maxLength={20} />
        <FieldInput label="School" value={card.school} onChange={(v) => set('school', v)} placeholder="Washington Elementary" maxLength={50} />
        <FieldInput label="Teacher's Name" value={card.teacherName} onChange={(v) => set('teacherName', v)} placeholder="Ms. Smith" maxLength={40} />
      </div>
      <FieldInput label="Something I Love" value={card.somethingILove} onChange={(v) => set('somethingILove', v)} placeholder="Playing soccer with my friends…" multiline rows={2} maxLength={140} />
      <FieldInput label="Something I Want People to Know" value={card.somethingIWantPeopleToKnow} onChange={(v) => set('somethingIWantPeopleToKnow', v)} placeholder="I'm learning how to code…" multiline rows={2} maxLength={140} />
      <FieldInput label="A Place Important to Me" value={card.aPlaceImportantToMe} onChange={(v) => set('aPlaceImportantToMe', v)} placeholder="My grandma's house…" multiline rows={2} maxLength={140} />
      <FieldInput label="My Community" value={card.myCommunity} onChange={(v) => set('myCommunity', v)} placeholder="I'm part of…" multiline rows={2} maxLength={140} />
    </div>
  );
}

// ── Step 7: My World ───────────────────────────────────────────
function StepMyWorld({ card, set }: { card: CardData; set: SetFn }) {
  return (
    <div>
      <SH emoji="🌍">My World</SH>
      <p style={hint}>Where do you come from? What makes your world unique?</p>
      <FieldInput label="My Neighborhood" value={card.myNeighborhood} onChange={(v) => set('myNeighborhood', v)} placeholder="I live in…" multiline rows={2} maxLength={140} />
      <FieldInput label="My Heritage / Background" value={card.myHeritage} onChange={(v) => set('myHeritage', v)} placeholder="My family comes from…" multiline rows={2} maxLength={140} />
      <FieldInput label="Languages I Speak" value={card.myLanguages} onChange={(v) => set('myLanguages', v)} placeholder="English, Spanish…" maxLength={80} />
      <FieldInput label="An Important Person in My Life" value={card.importantPerson} onChange={(v) => set('importantPerson', v)} placeholder="My grandma, because…" multiline rows={2} maxLength={140} />
    </div>
  );
}

// ── Step 8: My Future ──────────────────────────────────────────
function StepMyFuture({ card, set }: { card: CardData; set: SetFn }) {
  return (
    <div>
      <SH emoji="🚀">My Future</SH>
      <p style={hint}>What do you dream about? Where are you headed?</p>
      <FieldInput label="A Dream I Have" value={card.aDreamIHave} onChange={(v) => set('aDreamIHave', v)} placeholder="One day I want to…" multiline rows={2} maxLength={140} />
      <FieldInput label="A Skill I Want to Grow" value={card.aSkillIWantToGrow} onChange={(v) => set('aSkillIWantToGrow', v)} placeholder="I want to get better at…" maxLength={100} />
      <FieldInput label="My Goal for This Year" value={card.myGoal} onChange={(v) => set('myGoal', v)} placeholder="This year I want to…" multiline rows={2} maxLength={140} />
    </div>
  );
}

// ── Step 9: Soundtrack ─────────────────────────────────────────
function StepSoundtrack({ card, set }: { card: CardData; set: SetFn }) {
  return (
    <div>
      <SH emoji="🎵">My Soundtrack</SH>
      <p style={hint}>Music tells your story. What's on your playlist?</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FieldInput label="Artist or Playlist" value={card.artistOrPlaylist} onChange={(v) => set('artistOrPlaylist', v)} placeholder="Taylor Swift" maxLength={60} />
        <FieldInput label="Favorite Song" value={card.favoriteSong} onChange={(v) => set('favoriteSong', v)} placeholder="Shake It Off" maxLength={60} />
      </div>
      <FieldInput label="Why This Song Matters to Me" value={card.songMeaning} onChange={(v) => set('songMeaning', v)} placeholder="This song makes me feel…" multiline rows={3} maxLength={200} />
    </div>
  );
}

// ── Step 10: Preview ───────────────────────────────────────────
function StepPreview({ card, onDownload }: { card: CardData; onDownload: (side: 'front' | 'back') => Promise<void> }) {
  const [dlFront, setDlFront] = useState(false);
  const [dlBack, setDlBack] = useState(false);

  const dl = async (side: 'front' | 'back') => {
    const set = side === 'front' ? setDlFront : setDlBack;
    set(true);
    await onDownload(side);
    set(false);
  };

  return (
    <div>
      <SH emoji="👀">Preview Your Card</SH>
      <p style={hint}>Check both sides. Use the Front / Back toggle on the preview. Download PNGs or continue to submit.</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => dl('front')} disabled={dlFront} style={dlBtn('#2e6b8a', dlFront)}>
          {dlFront ? '⏳' : '⬇️'} Download Front PNG
        </button>
        <button onClick={() => dl('back')} disabled={dlBack} style={dlBtn('#7a8c5e', dlBack)}>
          {dlBack ? '⏳' : '⬇️'} Download Back PNG
        </button>
      </div>
      <div style={{ marginTop: 16, padding: 14, background: '#f5ede0', borderRadius: 10, border: '1.5px solid #d4b896', fontSize: 12, color: '#3a3530' }}>
        <div style={{ fontFamily: "'Lilita One',cursive", color: '#c0522a', marginBottom: 8 }}>Card Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {[['Name', card.studentName], ['Grade', card.grade], ['School', card.school], ['Companion', getCompanion(card.companionId).label], ['Values', (card.valueBadgeIds ?? []).map((id) => getBadge(id)?.label).filter(Boolean).join(', ')], ['Serial', card.serialNumber]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 5 }}>
              <span style={{ color: '#9a8878', fontWeight: 600 }}>{k}:</span>
              <span style={{ fontWeight: 700 }}>{v || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 11: Submit ────────────────────────────────────────────
function StepSubmit({ card, onSubmit, submitting, submitError }: {
  card: CardData; onSubmit: () => void; submitting: boolean; submitError: string;
}) {
  return (
    <div>
      <SH emoji="🖨️">Submit for Print</SH>
      <p style={hint}>Ready? Submitting sends your card to your teacher for professional printing.</p>
      {!card.studentName && (
        <div style={{ background: '#fff3ee', border: '1.5px solid #c0522a', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#c0522a', fontWeight: 600 }}>
          ⚠️ Don't forget to add your name in Step 6 — My Story!
        </div>
      )}
      {submitError && (
        <div style={{ background: '#fff3ee', border: '1.5px solid #c0522a', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#c0522a' }}>{submitError}</div>
      )}
      <button
        onClick={onSubmit}
        disabled={submitting}
        style={{
          width: '100%', padding: '16px 0', borderRadius: 12, border: 'none',
          background: submitting ? '#b0a090' : 'linear-gradient(135deg,#2d5a3d,#3a7a52)',
          color: 'white', fontFamily: "'Lilita One',cursive", fontSize: 18,
          cursor: submitting ? 'not-allowed' : 'pointer',
          boxShadow: submitting ? 'none' : '0 4px 18px rgba(45,90,61,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        {submitting ? '⏳ SUBMITTING…' : '🖨️ SUBMIT FOR PRINT'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONFIRMATION SCREEN
// ─────────────────────────────────────────────────────────────
function ConfirmationScreen({ card, timestamp, onDownload, onNew }: {
  card: CardData;
  timestamp: string;
  onDownload: (side: 'front' | 'back') => Promise<void>;
  onNew: () => void;
}) {
  const companion = getCompanion(card.companionId);
  const [dlFront, setDlFront] = useState(false);
  const [dlBack, setDlBack] = useState(false);

  const dl = async (side: 'front' | 'back') => {
    const setter = side === 'front' ? setDlFront : setDlBack;
    setter(true);
    await onDownload(side);
    setter(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fdf6ec,#f0e8d8)', fontFamily: "'Nunito',sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 24, border: '3px solid #c0522a', padding: '40px 36px', maxWidth: 500, width: '100%', textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.12)' }}>

        {/* Success badge */}
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#2d5a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 40 }}>✅</div>

        <h1 style={{ fontFamily: "'Lilita One',cursive", color: '#c0522a', fontSize: 26, marginBottom: 10, lineHeight: 1.1 }}>
          Your Storyworld card has been<br />submitted successfully.
        </h1>

        {/* Companion + Name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '20px 0', padding: 16, background: '#f5ede0', borderRadius: 12, border: '1.5px solid #d4b896' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'white', border: '2px solid #c0522a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src={companion.front} alt={companion.label}
              style={{ width: '80%', height: '80%', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createTextNode('🐾'))); }}
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Lilita One',cursive", color: '#3a3530', fontSize: 22 }}>
              {card.studentName || 'Anonymous'}
            </div>
            <div style={{ fontSize: 12, color: '#7a6a5a', marginTop: 2 }}>
              {card.grade && `${card.grade} · `}{card.school || ''}
            </div>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: '#c0522a', marginTop: 2 }}>
              {card.serialNumber}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <p style={{ fontSize: 12, color: '#9a8878', marginBottom: 24 }}>
          Submitted {timestamp} — your teacher will hand out printed cards soon!
        </p>

        {/* Download buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => dl('front')} disabled={dlFront} style={{ ...dlBtn('#2e6b8a', dlFront), flex: 1 }}>
            {dlFront ? '⏳' : '⬇️'} Front PNG
          </button>
          <button onClick={() => dl('back')} disabled={dlBack} style={{ ...dlBtn('#7a8c5e', dlBack), flex: 1 }}>
            {dlBack ? '⏳' : '⬇️'} Back PNG
          </button>
        </div>

        {/* Start New Card */}
        <button
          onClick={onNew}
          style={{
            width: '100%', padding: 12, borderRadius: 10, border: '2px solid #c0522a',
            background: 'transparent', color: '#c0522a',
            fontFamily: "'Lilita One',cursive", fontSize: 15, cursor: 'pointer',
          }}
        >+ Start a New Card</button>

      </div>

      {/* Hidden export elements */}
      <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', opacity: 0 }}>
        <CardFront card={card} id="card-front-export" scale={1} />
        <CardBack  card={card} id="card-back-export"  scale={1} />
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────
function SH({ children, emoji }: { children: React.ReactNode; emoji?: string }) {
  return (
    <h2 style={{ fontFamily: "'Lilita One',cursive", color: '#c0522a', fontSize: 18, marginBottom: 8, paddingBottom: 10, borderBottom: '2px solid #ede0cc', display: 'flex', alignItems: 'center', gap: 8 }}>
      {emoji && <span>{emoji}</span>}{children}
    </h2>
  );
}

const hint: React.CSSProperties = { fontSize: 13, color: '#7a6a5a', marginBottom: 16, lineHeight: 1.6 };

const dlBtn = (color: string, disabled: boolean): React.CSSProperties => ({
  flex: 1, padding: '9px 0', borderRadius: 8, border: `2px solid ${color}`,
  background: disabled ? '#f5f0eb' : `${color}14`,
  color: disabled ? '#b0a090' : color,
  fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
});
