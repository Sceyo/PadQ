'use client';

import { useState } from 'react';
import styles from './AccessCodeModal.module.css';

interface Props {
  open: boolean;
  onSubmit: (code: string) => Promise<void>;
  onClose: () => void;
}

export default function AccessCodeModal({ open, onSubmit, onClose }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onSubmit(code);
    } catch {
      setError('Invalid code. Please try again.');
    }
  };

  return (
    <div className={styles.backdrop}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Enter session code</h2>
        <input
          className={styles.input}
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Session code"
          maxLength={8}
          autoFocus
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary}>Join</button>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}