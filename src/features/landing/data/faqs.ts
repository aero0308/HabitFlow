export interface FAQ {
  question: string;
  answer: string;
}

export const faqs: FAQ[] = [
  {
    question: "Is it really free?",
    answer:
      "Yes. The core app is free forever. We may add a Pro tier later, but free will always be generous.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No. It runs in your browser. Just sign up and start tracking.",
  },
  {
    question: "Can I track habits with custom schedules?",
    answer:
      "Absolutely. Daily, weekly, or custom days like Mon/Wed/Fri. The streak calculation respects your schedule.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. Your data is yours. We never sell it, and you can export or delete it anytime from settings.",
  },
  {
    question: "What tech is this built with?",
    answer:
      "Next.js, Prisma, React, and TypeScript. Built for speed, reliability, and developer happiness.",
  },
  {
    question: "How do weekly emails work?",
    answer:
      "Every Sunday we send a summary of your week — completion rate, streaks, and personalized insights. You can disable it anytime in settings.",
  },
];
