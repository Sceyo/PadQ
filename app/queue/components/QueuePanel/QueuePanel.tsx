'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PlayerLabel } from '../atoms/PlayerLabel';
import type { QueueViewModel } from '../../lib/viewModels';
import type { PlayerStat } from '../../lib/types';

interface Props {
  queue: QueueViewModel;
  onSelectPlayer: (name: string, zone?: 'waiting' | 'break') => void;
  onReturnFromBreak?: (name: string) => void;
  statsMap?: Record<string, PlayerStat>;
  defaultWaitingExpanded?: boolean;
}

export function QueuePanel({
  queue,
  onSelectPlayer,
  onReturnFromBreak: _onReturnFromBreak,
  statsMap,
  defaultWaitingExpanded = false,
}: Props) {
  const [isWaitingExpanded, setIsWaitingExpanded] = useState(defaultWaitingExpanded);
  const [isOnBreakExpanded, setIsOnBreakExpanded] = useState(false);

  return (
    <section
      style={{
        background: 'var(--surface-card, #131726)',
        border: '1px solid var(--line-subtle, #252d47)',
        borderRadius: 'var(--r-lg, 18px)',
        padding: 'var(--sp-3, 12px) var(--sp-3_5, 14px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3, 12px)',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.25))',
      }}
    >
      {/* 1. UP NEXT (Always Visible) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1_5, 6px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 'var(--r-pill, 9999px)',
              }}
            >
              Next up
            </span>
          </div>
          {queue.nextUp.length > 0 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
              {queue.nextUp.length} {queue.nextUp.length === 1 ? 'player' : 'players'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2, 8px)' }}>
          {queue.nextUp.length === 0 ? (
            <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)', padding: '4px 0' }}>
              No players next up.
            </span>
          ) : (
            queue.nextUp.map((p) => (
              <button
                key={`next-${p.name}`}
                type="button"
                onClick={() => onSelectPlayer(p.name, 'waiting')}
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
                  gap: '6px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <PlayerLabel name={p.name} statsMap={statsMap} showRank={false} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. WAITING (Collapsible Accordion) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isWaitingExpanded ? 'var(--sp-2, 8px)' : '0px',
          borderTop: '1px solid var(--line-subtle, #1e2438)',
          paddingTop: 'var(--sp-2_5, 10px)',
        }}
      >
        <button
          type="button"
          onClick={() => setIsWaitingExpanded(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
          aria-expanded={isWaitingExpanded}
          aria-label={isWaitingExpanded ? 'Collapse waiting queue' : 'Expand waiting queue'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span
              style={{
                fontSize: 'var(--fs-xs, 0.8125rem)',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #94a3b8)',
                flexShrink: 0,
              }}
            >
              WAITING · {queue.waiting.length}
            </span>
            {!isWaitingExpanded && queue.waiting.length > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted, #64748b)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                ({queue.waiting.map(p => p.name).slice(0, 4).join(', ')}{queue.waiting.length > 4 ? ` +${queue.waiting.length - 4}` : ''})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary, #6366f1)', flexShrink: 0 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
              {isWaitingExpanded ? 'Hide' : 'View'}
            </span>
            <ChevronDown
              size={15}
              style={{
                transform: isWaitingExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </button>

        {isWaitingExpanded && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2, 8px)', paddingTop: '4px' }}>
            {queue.waiting.length === 0 ? (
              <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                No additional players waiting.
              </span>
            ) : (
              queue.waiting.map((p) => (
                <button
                  key={`waiting-${p.name}`}
                  type="button"
                  onClick={() => onSelectPlayer(p.name, 'waiting')}
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
                  <PlayerLabel name={p.name} statsMap={statsMap} showRank={false} />
                  {p.etaLabel && (
                    <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                      · {p.etaLabel}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. ON BREAK (Hidden when 0, Collapsible when > 0) */}
      {queue.onBreak.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isOnBreakExpanded ? 'var(--sp-2, 8px)' : '0px',
            borderTop: '1px solid var(--line-subtle, #1e2438)',
            paddingTop: 'var(--sp-2_5, 10px)',
          }}
        >
          <button
            type="button"
            onClick={() => setIsOnBreakExpanded(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
            aria-expanded={isOnBreakExpanded}
            aria-label={isOnBreakExpanded ? 'Collapse break list' : 'Expand break list'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span
                style={{
                  fontSize: 'var(--fs-xs, 0.8125rem)',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #94a3b8)',
                  flexShrink: 0,
                }}
              >
                ON BREAK · {queue.onBreak.length}
              </span>
              {!isOnBreakExpanded && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #64748b)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ({queue.onBreak.map(p => p.name).slice(0, 3).join(', ')}{queue.onBreak.length > 3 ? ` +${queue.onBreak.length - 3}` : ''})
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary, #6366f1)', flexShrink: 0 }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                {isOnBreakExpanded ? 'Hide' : 'View'}
              </span>
              <ChevronDown
                size={15}
                style={{
                  transform: isOnBreakExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
          </button>

          {isOnBreakExpanded && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2, 8px)', paddingTop: '4px' }}>
              {queue.onBreak.map((p) => (
                <button
                  key={`break-${p.name}`}
                  type="button"
                  onClick={() => onSelectPlayer(p.name, 'break')}
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
                  <PlayerLabel name={p.name} statsMap={statsMap} showRank={false} />
                  <span style={{ color: 'var(--accent-primary, #5457e0)', fontWeight: 700 }}>
                    · Break
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
