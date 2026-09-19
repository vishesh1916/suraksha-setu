/**
 * Web Audio API Emergency Siren Synthesizer
 * 
 * Generates an authentic Emergency Alert System (EAS) / NDMA dual-tone warning siren
 * using native browser Web Audio API oscillators (853 Hz & 960 Hz alternating pulse).
 * Works 100% offline with zero external audio file dependencies.
 */

let audioCtx: AudioContext | null = null;
let isPlaying = false;
let currentOscillators: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode }[] = [];
let alarmInterval: NodeJS.Timeout | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Silently unlock the Web Audio API context on user interaction (tap/click).
 * Required by mobile browsers (iOS Safari, Chrome Mobile).
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Play a burst of the EAS dual-tone emergency siren (853Hz + 960Hz).
 */
function playEmergencyPulse(ctx: AudioContext, durationMs: number = 800) {
  try {
    const now = ctx.currentTime;
    
    // Primary Tone 1: 853 Hz (EAS Attention Signal)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(853, now);

    // Primary Tone 2: 960 Hz (EAS Attention Signal)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(960, now);

    // Master Gain for siren burst with smooth attack and decay
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.08);
    gain.gain.setValueAtTime(0.28, now + (durationMs / 1000) - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));

    // Connect audio routing graph
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    const stopTime = now + (durationMs / 1000);
    osc1.stop(stopTime);
    osc2.stop(stopTime);

    currentOscillators.push({ osc1, osc2, gain });

    setTimeout(() => {
      currentOscillators = currentOscillators.filter((o) => o.osc1 !== osc1);
    }, durationMs + 100);
  } catch {
    // Gracefully handle browser audio restrictions
  }
}

/**
 * Start continuous Emergency Siren alarm sequence.
 * Repeats pulsing EAS siren until stopEmergencySiren() is called.
 */
export function playEmergencySiren(): boolean {
  if (isPlaying) return true;
  const ctx = getAudioContext();
  if (!ctx) return false;

  isPlaying = true;

  // Immediate first burst
  playEmergencyPulse(ctx, 800);

  // Repeat pulse sequence every 1100ms
  alarmInterval = setInterval(() => {
    if (!isPlaying) return;
    const activeCtx = getAudioContext();
    if (activeCtx) {
      playEmergencyPulse(activeCtx, 800);
    }
  }, 1100);

  return true;
}

/**
 * Immediately silence and stop any playing siren.
 */
export function stopEmergencySiren(): void {
  isPlaying = false;
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  for (const { osc1, osc2, gain } of currentOscillators) {
    try {
      if (audioCtx) {
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
      }
      osc1.stop();
      osc2.stop();
    } catch {}
  }
  currentOscillators = [];
}

/**
 * Check if the emergency siren is currently sounding.
 */
export function isEmergencySirenPlaying(): boolean {
  return isPlaying;
}
