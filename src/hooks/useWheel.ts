import { useCallback, useRef, useState } from 'react';
import type { SpinResult, Wheel } from '@/types/game';
import type { WheelCanvasHandle } from '@/components/game/WheelCanvas';
import { planSpin } from '@/utils/wheelMath';

/**
 * Управление барабаном: планирует результат (или принимает его от сервера) и
 * запускает анимацию WheelCanvas. Исход известен ДО начала вращения —
 * анимация лишь честно его показывает.
 */
export function useWheel(wheel: Wheel) {
  const wheelRef = useRef<WheelCanvasHandle>(null);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);

  const spin = useCallback(
    async (opts?: { forcedIndex?: number; result?: SpinResult }): Promise<SpinResult | null> => {
      const handle = wheelRef.current;
      if (!handle || handle.isSpinning()) return null;
      const result = opts?.result ?? planSpin(wheel, handle.getRotation(), opts?.forcedIndex);
      setSpinning(true);
      setLastResult(null);
      await handle.spinTo(result);
      setSpinning(false);
      setLastResult(result);
      return result;
    },
    [wheel],
  );

  return { wheelRef, spin, spinning, lastResult, setLastResult };
}
