import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Button,
  Link,
} from "@react-email/components";

/**
 * Weekly Coach Letter — React Email template.
 *
 * Plain-text focused email version of the coach letter. Same content as the
 * in-app modal but rendered for email clients (no CSS vars, no JS, no
 * complex layout — just text + one CTA + unsubscribe footer).
 *
 * Props mirror the structured sections of the letter (parsed from the
 * WeeklyCoachLetter.sections JSON string).
 */

export interface WeeklyCoachLetterEmailProps {
  subject: string;
  greeting: string;
  intro: string;
  whatsWorking: string;
  whereYouSlipped: string;
  experiment: string;
  closing: string;
  firstName: string;
  letterUrl: string;
}

// Dark theme palette — all literal hex values (email clients strip CSS vars).
const COLORS = {
  bg: "#0b0b0f",
  card: "#16161d",
  cardBorder: "#26262f",
  text: "#e7e7ee",
  textMuted: "#9b9ba9",
  accent: "#7c3aed",
  accentSoft: "#a78bfa",
  divider: "#26262f",
};

const FONT_FAMILY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const WeeklyCoachLetterEmail = ({
  subject,
  greeting,
  intro,
  whatsWorking,
  whereYouSlipped,
  experiment,
  closing,
  firstName,
  letterUrl,
}: WeeklyCoachLetterEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.bg,
          fontFamily: FONT_FAMILY,
          color: COLORS.text,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "24px 16px 48px",
          }}
        >
          {/* Header */}
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: COLORS.accentSoft,
                fontWeight: 700,
                margin: "0 0 4px",
              }}
            >
              HabitFlow · AI Coach
            </Text>
            <Text
              style={{
                fontSize: "22px",
                lineHeight: 1.25,
                fontWeight: 700,
                color: COLORS.text,
                margin: 0,
              }}
            >
              {subject}
            </Text>
          </Section>

          <Hr style={{ borderColor: COLORS.divider, margin: "0 0 24px" }} />

          {/* Greeting */}
          <Text
            style={{
              fontSize: "15px",
              lineHeight: 1.6,
              color: COLORS.text,
              margin: "0 0 12px",
            }}
          >
            {greeting}
          </Text>

          {/* Intro */}
          <Text
            style={{
              fontSize: "15px",
              lineHeight: 1.6,
              color: "rgba(231,231,238,0.85)",
              margin: "0 0 24px",
            }}
          >
            {intro}
          </Text>

          {/* What's working */}
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.textMuted,
                fontWeight: 700,
                margin: "0 0 8px",
              }}
            >
              What&apos;s working
            </Text>
            <Text
              style={{
                fontSize: "15px",
                lineHeight: 1.6,
                color: "rgba(231,231,238,0.85)",
                margin: 0,
              }}
            >
              {whatsWorking}
            </Text>
          </Section>

          {/* Where you slipped */}
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.textMuted,
                fontWeight: 700,
                margin: "0 0 8px",
              }}
            >
              Where you slipped
            </Text>
            <Text
              style={{
                fontSize: "15px",
                lineHeight: 1.6,
                color: "rgba(231,231,238,0.85)",
                margin: 0,
              }}
            >
              {whereYouSlipped}
            </Text>
          </Section>

          {/* Experiment callout */}
          <Section
            style={{
              marginBottom: "24px",
              background: "rgba(124,58,237,0.08)",
              borderLeft: `3px solid ${COLORS.accent}`,
              padding: "16px 16px 16px 18px",
              borderRadius: "0 8px 8px 0",
            }}
          >
            <Text
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.accentSoft,
                fontWeight: 700,
                margin: "0 0 8px",
              }}
            >
              One experiment for next week
            </Text>
            <Text
              style={{
                fontSize: "15px",
                lineHeight: 1.6,
                color: COLORS.text,
                margin: 0,
              }}
            >
              {experiment}
            </Text>
          </Section>

          {/* Closing */}
          <Text
            style={{
              fontSize: "15px",
              lineHeight: 1.6,
              color: "rgba(231,231,238,0.85)",
              margin: "0 0 24px",
            }}
          >
            {closing}
          </Text>

          <Hr style={{ borderColor: COLORS.divider, margin: "0 0 20px" }} />

          {/* CTA */}
          <Section style={{ textAlign: "center", marginBottom: "32px" }}>
            <Button
              style={{
                backgroundColor: COLORS.accent,
                color: "#ffffff",
                fontFamily: FONT_FAMILY,
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                padding: "12px 24px",
                borderRadius: "10px",
                display: "inline-block",
              }}
              href={letterUrl}
            >
              Read in HabitFlow →
            </Button>
          </Section>

          {/* Footer */}
          <Text
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              color: COLORS.textMuted,
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            You&apos;re receiving this because you enabled weekly AI insights
            in HabitFlow.
          </Text>
          <Text
            style={{
              fontSize: "11px",
              lineHeight: 1.5,
              color: COLORS.textMuted,
              margin: 0,
              textAlign: "center",
            }}
          >
            HabitFlow · Sent to {firstName} ·{" "}
            <Link
              href={`${letterUrl}?unsubscribe=1`}
              style={{ color: COLORS.textMuted, textDecoration: "underline" }}
            >
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WeeklyCoachLetterEmail;
