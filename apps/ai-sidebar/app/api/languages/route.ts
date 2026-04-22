import { NextResponse } from "next/server";
import { getAvailableLanguages } from "@/lib/crystallize";

export async function GET() {
  try {
    const languages = await getAvailableLanguages();
    return NextResponse.json({ languages });
  } catch (error) {
    console.error("Failed to fetch languages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch languages" },
      { status: 500 }
    );
  }
}
