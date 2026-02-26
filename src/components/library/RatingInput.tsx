import React from 'react';

export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            border: n <= value ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
            backgroundColor: n <= value ? 'var(--accent)' : 'transparent',
            cursor: 'pointer', padding: 0,
            transition: 'all 120ms ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: n <= value ? 'var(--bg-primary)' : 'var(--text-dim)',
          }}
          title={`${n}/10`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
