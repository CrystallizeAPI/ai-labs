import { NextRequest, NextResponse } from "next/server";
import { updateItemComponent, getItem } from "@/lib/crystallize";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, language, componentId, type, content } = body;

    if (!itemId || !language || !componentId || !type || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isNestedPath = /[.[]/.test(componentId);
    const item = isNestedPath ? await getItem(itemId, language) : undefined;

    const result = await updateItemComponent(
      itemId,
      language,
      componentId,
      type,
      content,
      item
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, itemId });
  } catch (error) {
    console.error("Failed to update component:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
