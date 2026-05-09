'use client';

import { useState } from 'react';
import styles from './AccessCodeModal.module.css';

interface Props {
  open:       boolean;
  onSubmit:   (code: string) => Promise<void>;
  onClose:    () => void;
  label?:     string;
  placeholder?: string;
  maxLength?: number;
}

export default function AccessCodeModal({
  open,
  onSubmit,
  onClose,
  label       = 'Enter session code',
  placeholder = 'Session code',
  maxLength   = 8,
}: Props) {
  const [code,  setCode]  = useState('');
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setBusy(true);
    try {
      await onSubmit(code.trim().toUpperCase());
      setCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <form className={styles.modal} onSubmit={handleSubmit}>
        <h2 className={styles.title}>{label}</h2>
        <input
          className={styles.input}
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={busy || !code.trim()}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
