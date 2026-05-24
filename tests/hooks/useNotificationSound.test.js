import { renderHook, act } from '@testing-library/react-hooks';
import useNotificationSound from '../../src/hooks/useNotificationSound';

// Mock Web Audio API
class FakeAudioContext {
  constructor() { this.state = 'running'; }
  resume() { this.state = 'running'; }
  createOscillator() { return { type: '', frequency: { setValueAtTime: () => {} }, start: () => {}, stop: () => {} }; }
  createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
  createBuffer() { return {}; }
  createBufferSource() { return { buffer: null, connect: () => {}, start: () => {} }; }
  currentTime = 0;
  destination = {};
}

window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;

test('playNotificationSound enqueues and plays without error', () => {
  const { result } = renderHook(() => useNotificationSound());
  act(() => {
    result.current.playNotificationSound();
    result.current.playNotificationSound();
  });
  // No assertions - just ensure no throw and queue works
});
