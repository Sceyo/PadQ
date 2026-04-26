'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Court {
  id: string;
  name: string; // "Court 1"
}

interface CourtContextType {
  courts: Court[];
  activeCourtId: string;
  setActiveCourtId: (id: string) => void;
  addCourt: (name: string) => void;
  removeCourt: (id: string) => void;
}

const CourtContext = createContext<CourtContextType | undefined>(undefined);

export function CourtProvider({ children }: { children: ReactNode }) {
  const [courts, setCourts] = useState<Court[]>([
    { id: 'court-1', name: 'Court 1' },
    { id: 'court-2', name: 'Court 2' },
  ]);
  const [activeCourtId, setActiveCourtId] = useState(courts[0].id);

  const addCourt = (name: string) => {
    setCourts((prev) => [...prev, { id: `court-${Date.now()}`, name }]);
  };

  const removeCourt = (id: string) => {
    setCourts((prev) => prev.filter((c) => c.id !== id));
    if (activeCourtId === id) {
      setActiveCourtId(courts[0]?.id || '');
    }
  };

  return (
    <CourtContext.Provider value={{ courts, activeCourtId, setActiveCourtId, addCourt, removeCourt }}>
      {children}
    </CourtContext.Provider>
  );
}

export function useCourt() {
  const ctx = useContext(CourtContext);
  if (!ctx) throw new Error('useCourt must be used within CourtProvider');
  return ctx;
}