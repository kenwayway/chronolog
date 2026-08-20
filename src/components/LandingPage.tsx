import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSessionContext } from "@/contexts/SessionContext";
import { buildStatsSummary } from "@/domain/statistics";

const MINUTE_MS = 60_000;

function formatChineseDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} 分`;
  return `${hours} 小时 ${minutes} 分`;
}

export function LandingPage({ onDismiss }: { onDismiss: () => void }) {
  const { state } = useSessionContext();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(interval);
  }, []);

  const todayStart = useMemo(() => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [now]);

  const trackedToday = useMemo(() => buildStatsSummary({
    notes: state.notes,
    sessions: state.sessions,
    start: todayStart,
    end: now,
    now,
    activeSessionId: state.activeSessionId,
  }).trackedMs, [state.notes, state.sessions, state.activeSessionId, todayStart, now]);

  const styles: Record<string, CSSProperties> = {
    page: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-10) var(--space-5)",
      cursor: "pointer",
      userSelect: "none",
      fontFamily: "var(--font-mono)",
      position: "relative",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "auto auto auto",
      gap: "0",
      width: "100%",
      maxWidth: "560px",
    },
    // Row 1: time elapsed today (spans 2 cols)
    cell1: {
      gridColumn: "1 / -1",
      padding: "var(--space-6) 0",
    },
    phrase1: {
      fontSize: "36px",
      fontWeight: 900,
      lineHeight: 1,
      letterSpacing: "-0.02em",
      color: "var(--text-primary)",
    },
    // Row 2 Left: Cat
    cell2: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-12) var(--space-6)",

    },
    cat: {
      width: "160px",
      height: "110px",
      maxWidth: "100%",
      objectFit: "contain",
    },
    // Row 2 Right: Phrase 2
    cell3: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "var(--space-6)",
    },
    phrase2Label: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      letterSpacing: "0.15em",
      color: "var(--text-dim)",
      marginBottom: "var(--space-2)",
      textTransform: "uppercase",
    },
    phrase2: {
      fontSize: "var(--text-base)",
      fontWeight: 500,
      lineHeight: 1.5,
      color: "var(--text-secondary)",
    },
    // Row 3: Countdown (spans 2 cols)
    cell4: {
      gridColumn: "1 / -1",
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "var(--space-6) 0",
    },
    countdownLabel: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      letterSpacing: "0.1em",
      color: "var(--text-dim)",
    },
    countdownValue: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-2)",
    },
    countdownNumber: {
      fontSize: "80px",
      fontWeight: 900,
      lineHeight: 0.9,
      color: "var(--text-primary)",
      letterSpacing: "-0.05em",
    },
    countdownUnit: {
      fontSize: "var(--text-lg)",
      fontWeight: 600,
      color: "var(--text-muted)",
    },
    hint: {
      position: "absolute",
      bottom: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "var(--text-xs)",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "var(--text-dim)",
    },
  };

  return (
    <>
      <div style={styles.page} onClick={onDismiss}>
        <div style={styles.grid}>
          {/* Row 1: time elapsed today */}
          <div style={styles.cell1}>
            <div style={styles.phrase1}>
              今天已经活了 {formatChineseDuration(now - todayStart)}
            </div>
          </div>

          {/* Row 2 Left: Cat GIF */}
          <div style={styles.cell2}>
            <img
              src="/sir-cat.gif"
              alt="A cat tipping its hat"
              style={styles.cat}
            />
          </div>

          {/* Row 2 Right: Phrase 2 */}
          <div style={styles.cell3}>
            <div style={styles.phrase2Label}>TODAY'S RECEIPT</div>
            <div style={styles.phrase2}>
              其中 {formatChineseDuration(trackedToday)}有据可查
            </div>
          </div>

          {/* Row 3: Countdown */}
          <div style={styles.cell4}>
            <span style={styles.countdownLabel}>剩下的呢？</span>
          </div>
        </div>

        <div style={styles.hint}>CLICK TO ENTER</div>
      </div>
    </>
  );
}
