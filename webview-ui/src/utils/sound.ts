const DEBOUNCE_MS = 5000;

let lastPlayTime = 0;

/**
 * Play a short chime using Web Audio API. Debounced so it plays at most once per DEBOUNCE_MS.
 */
export function playTurnCompleteChime(): void {
    const now = Date.now();
    if (now - lastPlayTime < DEBOUNCE_MS) {
        return;
    }
    lastPlayTime = now;

    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        osc.type = "sine";
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    } catch {
        // ignore if AudioContext not available
    }
}
