'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export type MatchFlowStage = 'idle' | 'ready' | 'saving' | 'slow' | 'failed' | 'success';

export interface UseMatchFlowOptions {
  onSave: (winner: 'A' | 'B', score?: string) => Promise<boolean>;
}

export function useMatchFlow({ onSave }: UseMatchFlowOptions) {
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [stage, setStage] = useState<MatchFlowStage>('idle');
  const [pendingScore, setPendingScore] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const savingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  const chooseWinner = useCallback((side: 'A' | 'B', score?: string) => {
    if (submittingRef.current) return;
    setWinner(side);
    setPendingScore(score);
    setStage('ready');
  }, []);

  const clearWinner = useCallback(() => {
    if (submittingRef.current) return;
    setWinner(null);
    setPendingScore(undefined);
    setStage('idle');
  }, []);

  const confirmResult = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current || !winner) return false;

    submittingRef.current = true;
    setIsSubmitting(true);
    setStage('ready');

    // After 1s, display "Saving..."
    savingTimerRef.current = setTimeout(() => {
      setStage('saving');
    }, 1000);

    // After 8s, display "Still saving..."
    slowTimerRef.current = setTimeout(() => {
      setStage('slow');
    }, 8000);

    try {
      const ok = await onSave(winner, pendingScore);
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);

      if (ok !== false) {
        setStage('success');
        setWinner(null);
        setPendingScore(undefined);
        submittingRef.current = false;
        setIsSubmitting(false);
        return true;
      } else {
        setStage('failed');
        submittingRef.current = false;
        setIsSubmitting(false);
        return false;
      }
    } catch {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setStage('failed');
      submittingRef.current = false;
      setIsSubmitting(false);
      return false;
    }
  }, [winner, pendingScore, onSave]);

  return {
    winner,
    stage,
    pendingScore,
    isSubmitting,
    chooseWinner,
    clearWinner,
    confirmResult,
  };
}
