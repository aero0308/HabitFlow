import { apiOk } from "@/lib/api";

const EXAMPLE_GOALS = [
    "I want to be healthier",
    "Be more productive",
    "Sleep better",
    "Read more books",
    "Reduce stress",
    "Learn something new",
];

function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export async function GET() {
    return apiOk({ examples: shuffle(EXAMPLE_GOALS).slice(0, 4) });
}