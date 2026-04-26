'use client';

import { useState, useEffect } from 'react';
import AccessCodeModal from '../atoms/AccessCodeModal';
import { useSessionAccess, SessionAccess } from '@/hooks/useSessionAccess'; // assumed hook location

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const { access, requestAccess } = useSessionAccess();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (access === SessionAccess.NONE) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [access]);

  if (access === SessionAccess.NONE) {
    return (
      <AccessCodeModal
        open={showModal}
        onSubmit={async (code) => {
          await requestAccess(code);
          setShowModal(false);
        }}
        onClose={() => setShowModal(false)}
      />
    );
  }

  return <>{children}</>;
}