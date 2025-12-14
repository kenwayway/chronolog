import { useMemo, CSSProperties } from "react";

export function LandingPage({ onDismiss }: { onDismiss: () => void }) {
  const daysUntilAdventure = useMemo(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), 11, 24);
    if (now > target) {
      target.setFullYear(now.getFullYear() + 1);
    }
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, []);

  const styles: Record<string, CSSProperties> = {
    page: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
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
    // Row 1: 我要大肌肉 (spans 2 cols)
    cell1: {
      gridColumn: "1 / -1",
      padding: "24px 0",
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
      padding: "48px 24px",

    },
    cat: {
      fontSize: "72px",
      lineHeight: 1,
      animation: "spin 3s linear infinite",
    },
    // Row 2 Right: Phrase 2
    cell3: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "24px",
    },
    phrase2Label: {
      fontSize: "10px",
      fontWeight: 600,
      letterSpacing: "0.15em",
      color: "var(--text-dim)",
      marginBottom: "8px",
      textTransform: "uppercase",
    },
    phrase2: {
      fontSize: "15px",
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
      padding: "24px 0",
    },
    countdownLabel: {
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "0.1em",
      color: "var(--text-dim)",
    },
    countdownValue: {
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
    },
    countdownNumber: {
      fontSize: "80px",
      fontWeight: 900,
      lineHeight: 0.9,
      color: "var(--text-primary)",
      letterSpacing: "-0.05em",
    },
    countdownUnit: {
      fontSize: "20px",
      fontWeight: 600,
      color: "var(--text-muted)",
    },
    hint: {
      position: "absolute",
      bottom: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "10px",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "var(--text-dim)",
    },
  };

  return (
    <>
      <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
      <div style={styles.page} onClick={onDismiss}>
        <div style={styles.grid}>
          {/* Row 1: 我要大肌肉 */}
          <div style={styles.cell1}>
            <div style={styles.phrase1}>我要大肌肉 💪</div>
          </div>

          {/* Row 2 Left: Cat */}
          <div style={styles.cell2}>
            <span style={styles.cat}>🐱</span>
          </div>

          {/* Row 2 Right: Phrase 2 */}
          <div style={styles.cell3}>
            <div style={styles.phrase2Label}>MORNING MSG</div>
            <div style={styles.phrase2}>早上好中国，现在我有冰淇凌 🍦</div>
          </div>

          {/* Row 3: Countdown */}
          <div style={styles.cell4}>
            <span style={styles.countdownLabel}>下一次大冒险还有</span>
            <div style={styles.countdownValue}>
              <span style={styles.countdownNumber}>{daysUntilAdventure}</span>
              <span style={styles.countdownUnit}>天</span>
            </div>
          </div>
        </div>

        <div style={styles.hint}>CLICK TO ENTER</div>
      </div>
    </>
  );
}
