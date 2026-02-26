import React, { memo } from 'react';
import { Star } from 'lucide-react';

export const RatingDisplay = memo(function RatingDisplay({ rating, size = 10 }: { rating?: number; size?: number }) {
  if (!rating) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Star size={size} fill="var(--accent)" stroke="var(--accent)" strokeWidth={2} />
      <span style={{ fontSize: size, fontWeight: 600, color: 'var(--accent)' }}>{rating}</span>
    </div>
  );
});
