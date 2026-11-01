import { useCallback, useRef } from 'react';
import type { MediaUrl, SoundKey } from '@/types/game';
import { playSound } from '@/utils/sound';

export function useAudio(overrides?: Partial<Record<SoundKey, MediaUrl>>, enabled = true) {
  const lastTick = useRef(0);

  const play = useCallback(
    (key: SoundKey, intensity = 1) => {
      if (!enabled) return;
      if (key === 'spinTick') {
        // не чаще ~60 щелчков в секунду, иначе на высокой скорости звук превращается в шум
        const now = performance.now();
        if (now - lastTick.current < 16) return;
        lastTick.current = now;
      }
      playSound(key, overrides, intensity);
    },
    [overrides, enabled],
  );

  return { play };
}
