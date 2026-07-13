import { NextRequest, NextResponse } from "next/server";

export async function parseBody<T = Record<string, unknown>>(
  request: NextRequest
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Nieprawidłowy format JSON" },
        { status: 400 }
      ),
    };
  }
}
