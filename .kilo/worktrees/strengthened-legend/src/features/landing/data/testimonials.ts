import { Star } from "lucide-react";

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatarUrl: string;
  rating: number;
}

export const testimonials: Testimonial[] = [
  {
    name: "Sarah K.",
    role: "Product Designer",
    quote:
      "I've tried every habit app. This is the first one that actually stuck. The streak visualizations are oddly addictive.",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    rating: 5,
  },
  {
    name: "Marcus T.",
    role: "Software Engineer",
    quote:
      "The weekly insights email is a game-changer. It tells me exactly which day I slack on and keeps me accountable.",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
    rating: 5,
  },
  {
    name: "Elena R.",
    role: "Startup Founder",
    quote:
      "Simple, beautiful, and it just works. I set up 5 habits in under 2 minutes and haven't missed a day since.",
    avatarUrl: "https://i.pravatar.cc/150?img=32",
    rating: 5,
  },
];
