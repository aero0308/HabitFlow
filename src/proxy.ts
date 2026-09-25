import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
    "https://habit-flow-nine-eta.vercel.app",
    "http://localhost:3000",
    "https://localhost",
    "capacitor://localhost",
];

export function proxy(req: NextRequest) {
    // Only handle API routes
    if (!req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    const origin = req.headers.get("origin") || "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    // Handle preflight (OPTIONS) requests
    if (req.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": isAllowed ? origin : "",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers":
                    "Content-Type, X-Browser-Timezone, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    // Handle normal requests — attach CORS headers to the response
    const res = NextResponse.next();
    if (isAllowed) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Access-Control-Allow-Credentials", "true");
        res.headers.set(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Browser-Timezone, Authorization",
        );
        res.headers.set(
            "Access-Control-Allow-Methods",
            "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        );
    }
    return res;
}

export const config = {
    matcher: "/api/:path*",
};