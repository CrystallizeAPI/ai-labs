import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getTopicMaps, flattenTopics, type Topic } from "@/lib/crystallize";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const itemName = formData.get("itemName") as string;
    const itemType = formData.get("itemType") as string;
    const userPrompt = formData.get("userPrompt") as string | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = imageFile.type || "image/jpeg";

    // Fetch available topics from Crystallize
    let allTopics: Topic[] = [];
    let topicMap = new Map<string, Topic>();
    
    try {
      const topicMaps = await getTopicMaps();
      allTopics = flattenTopics(topicMaps);
      
      // Build a map for quick lookup by name (case insensitive)
      allTopics.forEach((topic) => {
        topicMap.set(topic.name.toLowerCase(), topic);
      });
    } catch (err) {
      console.error("Failed to fetch topics:", err);
      // Continue without topics if fetch fails
    }

    const availableTopicNames = allTopics.map((t) => t.name);

    // Analyze image with Claude Vision
    const topicsPrompt =
      availableTopicNames.length > 0
        ? `\n\nAvailable topics in the system: ${availableTopicNames.join(", ")}\n\nSuggest topics that best match this image and exist in the available topics list. Only suggest topics from this list.`
        : "\n\nSuggest relevant topics for this image.";

    const userInstructions = userPrompt
      ? `\n\nAdditional instructions from the user: ${userPrompt}`
      : "";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `You are an image analyst for a product/content management system. Analyze this image for an item called "${itemName}" (type: ${itemType}).${userInstructions}

Provide:
1. Alt text: A concise, descriptive alt text for accessibility. IMPORTANT: Must be under 125 characters. Be direct and descriptive.
2. Caption: A compelling caption for the image (1-2 sentences)
3. Topics: Relevant topics/categories${topicsPrompt}

Respond in JSON format:
{
  "altText": "...",
  "caption": "...",
  "suggestedTopics": ["topic1", "topic2", "topic3"]
}`,
            },
          ],
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from Claude response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Ensure alt text is under 125 characters
    let altText = analysis.altText || "";
    if (altText.length > 125) {
      altText = altText.substring(0, 122) + "...";
    }

    // Match suggested topics to actual topics from Crystallize
    const suggestedTopics = (analysis.suggestedTopics || [])
      .map((topicName: string) => {
        const topic = topicMap.get(topicName.toLowerCase());
        return topic ? { id: topic.id, name: topic.name, path: topic.path } : null;
      })
      .filter(Boolean)
      .slice(0, 5); // Limit to 5 topics

    return NextResponse.json({
      altText,
      caption: analysis.caption,
      suggestedTopics,
    });
  } catch (err) {
    console.error("Image analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
