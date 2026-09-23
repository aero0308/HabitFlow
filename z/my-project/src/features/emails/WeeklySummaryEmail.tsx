import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Button,
  Hr,
  Link,
} from "@react-email/components";
import type { WeeklyEmailHabitRow } from "@/lib/email/stats";

export interface WeeklySummaryEmailProps {
  userName: string;
  weekStart: string;
  weekEnd: string;
  overallPct: number;
  totalCompleted: number;
  totalScheduled: number;
  deltaVsLastWeek: number;
  maxCurrentStreak: number;
  habits: WeeklyEmailHabitRow[];
  topWin: WeeklyEmailHabitRow | null;
  needsAttention: WeeklyEmailHabitRow | null;
  avgMood: number | null;
  appUrl: string;
  unsubscribeToken: string;
}

// Dark theme palette — all literal hex values, no CSS vars (email clients
// like Outlook/Gmail strip CSS custom properties).
const COLORS = {
  bg: "#0b0b0f",
  card: "#16161d",
  cardBorder: "#26262f",
  text: "#e7e7ee",
  textMuted: "#9b9ba9",
  accent: "#7c3aed",
  accentSoft: "#a78bfa",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f97316",
  divider: "#26262f",
};

const FONT_FAMILY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Render a single stat card as a raw <td> block (NOT a React component —
 * a plain helper function returning JSX). Using a function call instead of a
 * <Component /> reference avoids the react-hooks/static-components lint rule
 * that flags components defined inside other components' render scopes.
 *
 * Usage:  {renderStatCard({ label, value, sublabel, accentColor })}
 */
function renderStatCard(opts: {
  label: string;
  value: string;
  sublabel?: string;
  accentColor?: string;
}) {
  const accent = opts.accentColor || COLORS.accentSoft;
  return (
    <td
      width="33.33%"
      valign="top"
      style={{
        padding: "0 4px",
        verticalAlign: "top",
      }}
    >
      <table
        cellPadding="0"
        cellSpacing="0"
        border={0}
        style={{
          width: "100%",
          background: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: "14px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                padding: "18px 14px 14px",
                fontFamily: FONT_FAMILY,
                textAlign: "center" as const,
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: COLORS.textMuted,
                  marginBottom: "8px",
                }}
              >
                {opts.label}
              </div>
              <div
                style={{
                  fontSize: "30px",
                  lineHeight: "1.1",
                  fontWeight: 700,
                  color: accent,
                  marginBottom: opts.sublabel ? "6px" : "0",
                }}
              >
                {opts.value}
              </div>
              {opts.sublabel ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: COLORS.textMuted,
                  }}
                >
                  {opts.sublabel}
                </div>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>
    </td>
  );
}

export const WeeklySummaryEmail = (props: WeeklySummaryEmailProps) => {
  const {
    userName,
    weekStart,
    weekEnd,
    overallPct,
    totalCompleted,
    totalScheduled,
    deltaVsLastWeek,
    maxCurrentStreak,
    habits,
    topWin,
    needsAttention,
    avgMood,
    appUrl,
    unsubscribeToken,
  } = props;

  const deltaSign =
    deltaVsLastWeek > 0 ? "+" : deltaVsLastWeek < 0 ? "" : "±";
  const deltaColor =
    deltaVsLastWeek > 0
      ? COLORS.success
      : deltaVsLastWeek < 0
        ? COLORS.danger
        : COLORS.textMuted;

  const greetingName = userName?.trim() ? userName.trim() : "there";

  const habitRows = habits.map((h) => {
    const streakLabel =
      h.currentStreak > 0 ? `${h.currentStreak}d 🔥` : "—";
    const rateColor =
      h.rate >= 80
        ? COLORS.success
        : h.rate >= 50
          ? COLORS.warning
          : COLORS.danger;
    return (
      <tr key={h.id}>
        <td
          style={{
            padding: "10px 12px",
            fontFamily: FONT_FAMILY,
            fontSize: "14px",
            color: COLORS.text,
            borderBottom: `1px solid ${COLORS.divider}`,
          }}
        >
          <span>{h.icon}</span>
          <span style={{ marginLeft: "8px" }}>{h.name}</span>
        </td>
        <td
          align="right"
          style={{
            padding: "10px 12px",
            fontFamily: FONT_FAMILY,
            fontSize: "13px",
            color: COLORS.textMuted,
            textAlign: "right" as const,
            borderBottom: `1px solid ${COLORS.divider}`,
            whiteSpace: "nowrap",
          }}
        >
          {h.completed}/{h.scheduled}
        </td>
        <td
          align="right"
          style={{
            padding: "10px 12px",
            fontFamily: FONT_FAMILY,
            fontSize: "14px",
            fontWeight: 600,
            color: rateColor,
            textAlign: "right" as const,
            borderBottom: `1px solid ${COLORS.divider}`,
            whiteSpace: "nowrap",
          }}
        >
          {h.rate}%
        </td>
        <td
          align="right"
          style={{
            padding: "10px 12px",
            fontFamily: FONT_FAMILY,
            fontSize: "13px",
            color: COLORS.warning,
            textAlign: "right" as const,
            borderBottom: `1px solid ${COLORS.divider}`,
            whiteSpace: "nowrap",
          }}
        >
          {streakLabel}
        </td>
      </tr>
    );
  });

  const encouragement =
    overallPct >= 80
      ? "You're on fire this week. Keep stacking those wins."
      : overallPct >= 50
        ? "Solid week. Every check-in counts — keep the momentum going."
        : "A new week is a fresh start. Pick one habit and make it non-negotiable tomorrow.";

  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const dashboardUrl = `${appUrl}`;

  return (
    <Html>
      <Head />
      <Preview>{`Your HabitFlow weekly summary — ${overallPct}% complete`}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: COLORS.bg,
          fontFamily: FONT_FAMILY,
          color: COLORS.text,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* Outer wrapper — sets max-width on the email body */}
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "24px 16px 48px",
            backgroundColor: COLORS.bg,
          }}
        >
          {/* Header band with violet gradient */}
          <Section
            style={{
              background: `linear-gradient(135deg, ${COLORS.accent} 0%, #5b21b6 100%)`,
              padding: "28px 24px",
              borderRadius: "14px 14px 0 0",
              textAlign: "center" as const,
            }}
          >
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ width: "100%" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      color: "#ffffff",
                      fontSize: "13px",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase" as const,
                      opacity: 0.85,
                      marginBottom: "8px",
                    }}
                  >
                    HabitFlow · Weekly Summary
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      color: "#ffffff",
                      fontSize: "26px",
                      fontWeight: 700,
                      lineHeight: "1.2",
                    }}
                  >
                    {weekStart} → {weekEnd}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Main content card */}
          <Section
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.cardBorder}`,
              borderTop: "none",
              borderRadius: "0 0 14px 14px",
              padding: "28px 24px 8px",
            }}
          >
            {/* Greeting */}
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ width: "100%" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: "20px",
                      fontWeight: 600,
                      color: COLORS.text,
                      paddingBottom: "6px",
                    }}
                  >
                    Hi {greetingName},
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: "14px",
                      color: COLORS.textMuted,
                      paddingBottom: "20px",
                      lineHeight: "1.55",
                    }}
                  >
                    Here&apos;s how your habits held up this week. Two minutes
                    of review keeps the streak alive.
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 3 stat cards row */}
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ width: "100%", marginBottom: "8px" }}
            >
              <tbody>
                <tr>
                  {renderStatCard({
                    label: "Completion",
                    value: `${overallPct}%`,
                    sublabel: `${totalCompleted}/${totalScheduled} done`,
                    accentColor: COLORS.accentSoft,
                  })}
                  {renderStatCard({
                    label: "Habits done",
                    value: `${totalCompleted}`,
                    sublabel: `of ${totalScheduled}`,
                    accentColor: COLORS.success,
                  })}
                  {renderStatCard({
                    label: "Best streak",
                    value: `${maxCurrentStreak}d`,
                    sublabel: maxCurrentStreak >= 7 ? "🔥 on fire" : "current",
                    accentColor: COLORS.warning,
                  })}
                </tr>
              </tbody>
            </table>

            {/* Delta vs last week strip */}
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{
                width: "100%",
                marginTop: "12px",
                marginBottom: "20px",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: "12px",
                      color: COLORS.textMuted,
                      textAlign: "center" as const,
                      padding: "8px 12px",
                      background: "#101015",
                      border: `1px solid ${COLORS.cardBorder}`,
                      borderRadius: "10px",
                    }}
                  >
                    vs last week:{" "}
                    <span
                      style={{
                        color: deltaColor,
                        fontWeight: 700,
                      }}
                    >
                      {deltaSign}
                      {deltaVsLastWeek > 0 ? `+${deltaVsLastWeek}` : deltaVsLastWeek} pts
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Habit breakdown table */}
            {habits.length > 0 ? (
              <table
                cellPadding="0"
                cellSpacing="0"
                border={0}
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: "20px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: "10px 12px",
                        fontFamily: FONT_FAMILY,
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: COLORS.textMuted,
                        textAlign: "left" as const,
                        borderBottom: `1px solid ${COLORS.divider}`,
                      }}
                    >
                      Habit
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        fontFamily: FONT_FAMILY,
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: COLORS.textMuted,
                        textAlign: "right" as const,
                        borderBottom: `1px solid ${COLORS.divider}`,
                      }}
                    >
                      Done
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        fontFamily: FONT_FAMILY,
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: COLORS.textMuted,
                        textAlign: "right" as const,
                        borderBottom: `1px solid ${COLORS.divider}`,
                      }}
                    >
                      Rate
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        fontFamily: FONT_FAMILY,
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: COLORS.textMuted,
                        textAlign: "right" as const,
                        borderBottom: `1px solid ${COLORS.divider}`,
                      }}
                    >
                      Streak
                    </th>
                  </tr>
                </thead>
                <tbody>{habitRows}</tbody>
              </table>
            ) : null}

            {/* Insights row: top win / needs attention / mood */}
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ width: "100%", marginBottom: "16px" }}
            >
              <tbody>
                <tr>
                  <td
                    width="50%"
                    valign="top"
                    style={{ padding: "0 4px 8px", verticalAlign: "top" }}
                  >
                    <table
                      cellPadding="0"
                      cellSpacing="0"
                      border={0}
                      style={{
                        width: "100%",
                        background: "#101015",
                        border: `1px solid ${COLORS.cardBorder}`,
                        borderRadius: "10px",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              padding: "12px 14px",
                              fontFamily: FONT_FAMILY,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase" as const,
                                color: COLORS.success,
                                marginBottom: "6px",
                              }}
                            >
                              🏆 Top win
                            </div>
                            {topWin ? (
                              <>
                                <div
                                  style={{
                                    fontSize: "15px",
                                    fontWeight: 600,
                                    color: COLORS.text,
                                    marginBottom: "2px",
                                  }}
                                >
                                  {topWin.icon} {topWin.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: COLORS.textMuted,
                                  }}
                                >
                                  {topWin.rate}% · {topWin.completed}/{topWin.scheduled} days
                                </div>
                              </>
                            ) : (
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: COLORS.textMuted,
                                }}
                              >
                                No scheduled habits this week yet.
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td
                    width="50%"
                    valign="top"
                    style={{ padding: "0 4px 8px", verticalAlign: "top" }}
                  >
                    <table
                      cellPadding="0"
                      cellSpacing="0"
                      border={0}
                      style={{
                        width: "100%",
                        background: "#101015",
                        border: `1px solid ${COLORS.cardBorder}`,
                        borderRadius: "10px",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              padding: "12px 14px",
                              fontFamily: FONT_FAMILY,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase" as const,
                                color: COLORS.danger,
                                marginBottom: "6px",
                              }}
                            >
                              ⚠️ Needs attention
                            </div>
                            {needsAttention ? (
                              <>
                                <div
                                  style={{
                                    fontSize: "15px",
                                    fontWeight: 600,
                                    color: COLORS.text,
                                    marginBottom: "2px",
                                  }}
                                >
                                  {needsAttention.icon} {needsAttention.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: COLORS.textMuted,
                                  }}
                                >
                                  {needsAttention.rate}% · {needsAttention.completed}/{needsAttention.scheduled} days
                                </div>
                              </>
                            ) : (
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: COLORS.textMuted,
                                }}
                              >
                                Nothing slipping — nice!
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Mood strip */}
            {avgMood !== null ? (
              <table
                cellPadding="0"
                cellSpacing="0"
                border={0}
                style={{
                  width: "100%",
                  marginBottom: "20px",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontFamily: FONT_FAMILY,
                        background: "#101015",
                        border: `1px solid ${COLORS.cardBorder}`,
                        borderRadius: "10px",
                        textAlign: "center" as const,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase" as const,
                          color: COLORS.textMuted,
                          marginRight: "8px",
                        }}
                      >
                        Avg mood this week
                      </span>
                      <span
                        style={{
                          fontSize: "20px",
                          fontWeight: 700,
                          color: COLORS.accentSoft,
                        }}
                      >
                        {avgMood}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: COLORS.textMuted,
                          marginLeft: "4px",
                        }}
                      >
                        / 10
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}

            {/* Encouragement line */}
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ width: "100%", marginBottom: "24px" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: "14px",
                      color: COLORS.text,
                      lineHeight: "1.6",
                      padding: "0 4px",
                    }}
                  >
                    {encouragement}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* CTA button */}
            <Section
              style={{
                textAlign: "center" as const,
                paddingBottom: "12px",
              }}
            >
              <Button
                href={dashboardUrl}
                style={{
                  display: "inline-block",
                  background: COLORS.accent,
                  color: "#ffffff",
                  fontFamily: FONT_FAMILY,
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px 28px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                }}
              >
                Open HabitFlow →
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Section
            style={{
              padding: "20px 8px 0",
              textAlign: "center" as const,
            }}
          >
            <Hr
              style={{
                borderColor: COLORS.divider,
                margin: "0 0 16px",
              }}
            />
            <table
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ width: "100%" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: "12px",
                      color: COLORS.textMuted,
                      textAlign: "center" as const,
                      lineHeight: "1.55",
                    }}
                  >
                    You&apos;re receiving this because weekly email reminders are
                    enabled in your HabitFlow settings.
                    <br />
                    <Link
                      href={unsubscribeUrl}
                      style={{
                        color: COLORS.accentSoft,
                        textDecoration: "underline",
                        fontSize: "12px",
                      }}
                    >
                      Unsubscribe
                    </Link>{" "}
                    ·{" "}
                    <Link
                      href={dashboardUrl}
                      style={{
                        color: COLORS.accentSoft,
                        textDecoration: "underline",
                        fontSize: "12px",
                      }}
                    >
                      Manage settings
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: "11px",
                      color: "#5b5b66",
                      textAlign: "center" as const,
                      paddingTop: "12px",
                    }}
                  >
                    © {new Date().getFullYear()} HabitFlow · Built for builders.
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WeeklySummaryEmail;
