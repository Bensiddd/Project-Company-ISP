import { useCallback, useEffect } from 'react';

/**
 * Shared Web Audio API notification sound hook.
 * 3‑tone arpeggio (C5 → E5 → G5) with triangle harmonic.
 */
const useNotificationSound = () => {
  // singleton AudioContext
  const audioCtxRef = { current: null };
  const queue = [];
  const isPlaying = { current: false };

  const getCtx = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  };

  const dequeueAndPlay = () => {
    if (queue.length === 0) { isPlaying.current = false; return; }
    const playFn = queue.shift();
    isPlaying.current = true;
    playFn().finally(() => {
      setTimeout(dequeueAndPlay, 100);
    });
  };

  const enqueuePlay = (playFn) => {
    queue.push(playFn);
    if (!isPlaying.current) dequeueAndPlay();
  };

  const playNotificationSound = useCallback(() => {
    const playFn = async () => {
      try {
        const ctx = getCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [
          { freq: 523.25, time: 0,    gain: 0.18 }, // C5
          { freq: 659.25, time: 0.09, gain: 0.16 }, // E5
          { freq: 783.99, time: 0.18, gain: 0.13 }, // G5
        ];
        notes.forEach(({ freq, time, gain: vol }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);
          gainNode.gain.setValueAtTime(vol, now + time);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + 0.28);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(now + time);
          osc.stop(now + time + 0.3);

          // triangle harmonic (octave above)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(freq * 2, now + time);
          gain2.gain.setValueAtTime(vol * 0.3, now + time);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + time + 0.2);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + time);
          osc2.stop(now + time + 0.22);
        });
      } catch (err) {
        console.warn('Notification sound failed:', err);
      }
    };
    enqueuePlay(playFn);
  }, []);

  // unlock on first user interaction (autoplay policy)
  useEffect(() => {
    const unlock = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = getCtx();
          if (ctx.state === 'suspended') ctx.resume();
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
      } catch (e) { /* ignore */ }
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('click', unlock);
    return () => document.removeEventListener('click', unlock);
  }, []);

  return { playNotificationSound };
};

export default useNotificationSound;
