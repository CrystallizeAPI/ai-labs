import { NextRequest, NextResponse } from "next/server";
import { generateComponentUpdates } from "@/lib/ai";
import type { ItemDetails } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item, prompt, targetComponents, sourceLanguage, targetLanguage } = body as {
      item: ItemDetails;
      prompt: string;
      sourceLanguage?: string;
      targetLanguage?: string;
      targetComponents?: string[];
    };

    const fromLanguage = sourceLanguage || "en";
    const toLanguage = targetLanguage || fromLanguage;

    if (!item || !prompt) {
      return NextResponse.json(
        { error: "item and prompt are required" },
        { status: 400 }
      );
    }

    const result = await generateComponentUpdates(
      item,
      prompt,
      targetComponents,
      fromLanguage,
      toLanguage
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
