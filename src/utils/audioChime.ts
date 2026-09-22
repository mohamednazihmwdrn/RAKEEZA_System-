/**
 * Audio Chime Utility for Incoming Web Orders
 * Synthesizes a pleasant two-tone retail order bell chime via Web Audio API
 */

export function playOrderAlertChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Helper to play a single chime tone
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope: quick attack and smooth exponential decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Tone 1: E5 (659.25 Hz)
    playTone(659.25, now, 0.35);
    // Tone 2: G#5 (830.61 Hz)
    playTone(830.61, now + 0.18, 0.35);
    // Tone 3: B5 (987.77 Hz) - high cheerful chime!
    playTone(987.77, now + 0.36, 0.6);
  } catch (err) {
    console.warn('AudioContext playback error:', err);
  }
}
