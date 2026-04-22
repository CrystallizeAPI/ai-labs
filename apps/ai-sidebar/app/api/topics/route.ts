import { NextResponse } from "next/server";
import { getTopicMaps } from "@/lib/crystallize";

export async function GET() {
  try {
    const topicMaps = await getTopicMaps();
    return NextResponse.json(topicMaps);
  } catch (err) {
    console.error("Failed to fetch topic maps:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch topics" },
      { status: 500 }
    );
  }
}
