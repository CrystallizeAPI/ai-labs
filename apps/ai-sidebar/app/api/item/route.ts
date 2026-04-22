import { NextRequest, NextResponse } from "next/server";
import { getItem } from "@/lib/crystallize";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const itemId = searchParams.get("itemId");
  const language = searchParams.get("language") || "en";

  if (!itemId) {
    return NextResponse.json(
      { error: "itemId is required" },
      { status: 400 }
    );
  }

  try {
    const item = await getItem(itemId, language);
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch item" },
      { status: 500 }
    );
  }
}
