'use client';

import React from 'react';
import type { QueueViewModel } from '../../lib/viewModels';

interface Props {
  queue: QueueViewModel;
  onSelectPlayer: (name: string) => void;
  onReturnFromBreak?: (name: string) => void;
}

export function QueuePanel({
  queue,
  onSelectPlayer,
  onReturnFromBreak,
}: Props) {
  return (
    <section
      style={{
        background: 'var(--surface-card, #131726)',
        border: '1px solid var(--line-subtle, #252d47)',
        borderRadius: 'var(--r-lg, 18px)',
        padding: 'var(--sp-3_5, 14px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4, 16px)',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.25))',
      }}
    >
      {/* UP NEXT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2, 8px)' }}>
          <span
            style={{
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            UP NEXT
          </span>
          <span
            style={{
              background: 'var(--status-warn-bg, rgba(245, 158, 11, 0.15))',
              color: 'var(--status-warn, #f59e0b)',
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--r-pill, 9999px)',
            }}
          >
            Next up
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2, 8px)' }}>
          {queue.nextUp.length === 0 ? (
            <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
              No players next up.
            </span>
          ) : (
            queue.nextUp.map((p) => (
              <button
                key={`next-${p.name}`}
                type="button"
                onClick={() => onSelectPlayer(p.name)}
                style={{
                  minHeight: 'var(--tap-min, 44px)',
                  padding: 'var(--sp-1_5, 6px) var(--sp-3_5, 14px)',
                  borderRadius: 'var(--r-pill, 9999px)',
                  border: '1.5px solid var(--line-subtle, #252d47)',
                  background: 'var(--surface-bg, #0b0d17)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: 'var(--fs-sm, 0.9375rem)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      </div>

      {/* WAITING */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs, 0.8125rem)',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          WAITING · {queue.waiting.length}
        </span>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2, 8px)' }}>
          {queue.waiting.length === 0 ? (
            <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
              No additional players waiting.
            </span>
          ) : (
            queue.waiting.map((p) => (
              <button
                key={`waiting-${p.name}`}
                type="button"
                onClick={() => onSelectPlayer(p.name)}
                style={{
                  minHeight: 'var(--tap-min, 44px)',
                  padding: 'var(--sp-1_5, 6px) var(--sp-3_5, 14px)',
                  borderRadius: 'var(--r-pill, 9999px)',
                  border: '1.5px solid var(--line-subtle, #252d47)',
                  background: 'var(--surface-bg, #0b0d17)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: 'var(--fs-sm, 0.9375rem)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--sp-1_5, 6px)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <span>{p.name}</span>
                {p.etaLabel && (
                  <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                    · {p.etaLabel}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ON BREAK */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs, 0.8125rem)',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          ON BREAK · {queue.onBreak.length}
        </span>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2, 8px)' }}>
          {queue.onBreak.length === 0 ? (
            <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
              No players on break.
            </span>
          ) : (
            queue.onBreak.map((p) => (
              <button
                key={`break-${p.name}`}
                type="button"
                onClick={() => onReturnFromBreak?.(p.name)}
                style={{
                  minHeight: 'var(--tap-min, 44px)',
                  padding: 'var(--sp-1_5, 6px) var(--sp-3_5, 14px)',
                  borderRadius: 'var(--r-pill, 9999px)',
                  border: '1.5px solid var(--line-subtle, #252d47)',
                  background: 'var(--surface-bg, #0b0d17)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: 'var(--fs-sm, 0.9375rem)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--sp-1_5, 6px)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <span>{p.name}</span>
                <span style={{ color: 'var(--accent-primary, #5457e0)', fontWeight: 700 }}>
                  · Back in
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
