import Anthropic from "@anthropic-ai/sdk";
import type { ItemDetails, ComponentUpdate } from "./types";
import { flattenEditableComponents } from "./utils";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a content editor assistant for a Crystallize PIM system. You help users improve their product and document content through natural language instructions.

COMPONENT FORMATS:

SingleLine:
{ "text": "Your single line text" }

RichText (ALWAYS use JSON format, NEVER HTML):

Simple paragraph:
{ "json": [{ "kind": "block", "type": "paragraph", "textContent": "Your text here" }] }

Multiple paragraphs:
{ "json": [
  { "kind": "block", "type": "paragraph", "textContent": "First paragraph" },
  { "kind": "block", "type": "paragraph", "textContent": "Second paragraph" }
] }

Paragraph with mixed formatting (bold, italic, underline, code):
{ "json": [{ "kind": "block", "type": "paragraph", "children": [
  { "kind": "inline", "textContent": "Normal text, " },
  { "kind": "inline", "type": "strong", "textContent": "bold text" },
  { "kind": "inline", "textContent": ", " },
  { "kind": "inline", "type": "emphasized", "textContent": "italic text" },
  { "kind": "inline", "textContent": ", " },
  { "kind": "inline", "type": "underlined", "textContent": "underlined text" },
  { "kind": "inline", "textContent": ", " },
  { "kind": "inline", "type": "code", "textContent": "inline code" }
] }] }

Bullet list (unordered):
{ "json": [{ "kind": "block", "type": "unordered-list", "children": [
  { "kind": "block", "type": "list-item", "textContent": "First item" },
  { "kind": "block", "type": "list-item", "textContent": "Second item" },
  { "kind": "block", "type": "list-item", "textContent": "Third item" }
] }] }

Numbered list (ordered):
{ "json": [{ "kind": "block", "type": "ordered-list", "children": [
  { "kind": "block", "type": "list-item", "textContent": "First" },
  { "kind": "block", "type": "list-item", "textContent": "Second" },
  { "kind": "block", "type": "list-item", "textContent": "Third" }
] }] }

Code block:
{ "json": [{ "kind": "block", "type": "preformatted", "children": [
  { "kind": "block", "type": "code", "textContent": "const example = true;", "metadata": { "language": "javascript" } }
] }] }

ParagraphCollection (for repeating content sections with title, body, images, videos):
{
  "paragraphs": [
    {
      "title": { "text": "First Section Title" },
      "body": {
        "json": [
          { "kind": "block", "type": "paragraph", "textContent": "First section content." }
        ]
      },
      "images": null,
      "videos": null
    },
    {
      "title": { "text": "Second Section Title" },
      "body": {
        "json": [
          { "kind": "block", "type": "paragraph", "children": [
            { "kind": "inline", "textContent": "Content with " },
            { "kind": "inline", "type": "strong", "textContent": "bold" },
            { "kind": "inline", "textContent": " and " },
            { "kind": "inline", "type": "emphasized", "textContent": "italic" },
            { "kind": "inline", "textContent": " text." }
          ] },
          { "kind": "block", "type": "unordered-list", "children": [
            { "kind": "block", "type": "list-item", "textContent": "Bullet point one" },
            { "kind": "block", "type": "list-item", "textContent": "Bullet point two" }
          ] }
        ]
      },
      "images": [
        { "key": "tenant/path/to/image.jpg", "altText": "Description of the image" }
      ],
      "videos": null
    }
  ]
}

ParagraphCollection RULES:
- Each paragraph must have "title" with { "text": "..." } and "body" with { "json": [...] }
- Set "images" to null unless you have actual image keys from the AVAILABLE IMAGES list
- To add images to a paragraph, use: "images": [{ "key": "the-image-key", "altText": "description" }]
- **Only use image keys that are listed in AVAILABLE IMAGES** — NEVER invent, modify, or guess keys. Never synthesize a key from the alt text. If no suitable key exists in AVAILABLE IMAGES, set "images" to null.
- **Preserve existing images by default**: if you are only rewriting text in a paragraph that currently has images, keep the EXACT same image keys in the same order — do not drop or replace them unless the user explicitly asks.
- Use rich text formatting in body just like richText components
- Create multiple paragraphs for distinct sections
- If user asks to add/associate images with paragraphs, pick relevant images based on their alt text and the paragraph content

FORMATTING TIPS:
- Use "strong" for important words or key features
- Use "emphasized" (italic) for product names or emphasis
- Use bullet lists for features, benefits, or specifications
- Use numbered lists for steps, instructions, or rankings
- Keep paragraphs focused and readable

CRITICAL RULES:
1. Rich text MUST use "json" format, NEVER "html"
2. Always use lowercase componentId values
3. Only update components the user mentions or clearly implies
4. For simple text without formatting, use "textContent" directly on the block
5. For mixed formatting in a paragraph, use "children" array with inline elements
6. NESTED COMPONENTS: When a component sits inside a piece or content chunk, the listing shows a dotted path (e.g. "meta.title" for a field inside the "meta" piece, or "specs[0].width" for a field inside a content chunk). Use that EXACT path as the componentId in your response — do not invent a different id and do not strip the prefix.
7. COMPONENT-AWARE OUTPUT: The parent and child names are your primary clue to a field's purpose. Adapt length, style, and format accordingly:
   - **SEO / meta fields** (parent is "meta", "seo", or similar, OR child is named "meta title", "seo title", "meta description", "keywords", etc.):
     - meta title: 50–60 characters, include the primary keyword near the front, no trailing punctuation
     - meta description: 140–160 characters, one or two complete sentences, include primary keyword, avoid clickbait
     - meta keywords: 5–10 comma-separated short phrases
     - OpenGraph / social title: 40–70 characters
     - OpenGraph / social description: 2–4 short sentences, ~200 chars max
   - **Content titles / headings** (e.g. top-level "title", "heading", "name"): editorial tone, 40–80 characters, no forced keyword stuffing
   - **Intros / summaries / excerpts**: 1–3 sentences, no SEO padding
   - **Slugs / URL parts**: lowercase-kebab-case, no punctuation, <60 chars
   - **Body / description / story**: full editorial length, natural structure
   - **A Meta Title must NEVER be identical to the page Title** — it should be a search-optimized rewrite that reads well in a SERP
   - When multiple target components are selected, write each one for its own purpose; do NOT reuse the same text across different fields

OUTPUT FORMAT:
Respond with valid JSON only (no markdown code blocks):
{
  "updates": [
    {
      "componentId": "component-id",
      "type": "componentType",
      "content": { ... component content ... },
      "preview": "Plain text preview of the new content"
    }
  ],
  "explanation": "Brief explanation of what you changed and why"
}`;

function getFullComponentContent(content: Record<string, unknown> | undefined): string {
  if (!content) return "(empty)";
  
  // Single line text
  if (content.text && typeof content.text === "string") {
    return content.text;
  }
  
  // Rich text - extract plain text
  if (content.plainText && Array.isArray(content.plainText)) {
    return content.plainText.join("\n");
  }
  
  // Numeric
  if (typeof content.number === "number") {
    return `${content.number}${content.unit ? ` ${content.unit}` : ""}`;
  }
  
  // Boolean
  if (typeof content.value === "boolean") {
    return content.value ? "true" : "false";
  }
  
  // Paragraph collection - include full content with images + keys
  if (content.paragraphs && Array.isArray(content.paragraphs)) {
    return content.paragraphs.map((p: { 
      title?: { text?: string }; 
      body?: { plainText?: string[] };
      images?: Array<{ key?: string; altText?: string }>;
    }, i: number) => {
      const title = p.title?.text || `Section ${i + 1}`;
      const body = p.body?.plainText?.join("\n") || "(no body)";
      const imageInfo = p.images?.length
        ? `\nimages: ${JSON.stringify(p.images.map((img) => ({ key: img.key, altText: img.altText })))}`
        : "";
      return `### ${title}\n${body}${imageInfo}`;
    }).join("\n\n");
  }
  
  // Images - list with keys
  if (content.images && Array.isArray(content.images)) {
    const images = content.images as Array<{ key?: string; altText?: string; url?: string }>;
    return images.map((img, i) => 
      `Image ${i + 1}: key="${img.key || 'unknown'}", alt="${img.altText || 'no alt text'}"`
    ).join("\n");
  }
  
  return "(empty)";
}

// Extract all available images from item components (descends into pieces/chunks and paragraphs)
function getAvailableImages(item: ItemDetails): Array<{ key: string; altText?: string; componentId: string }> {
  const images: Array<{ key: string; altText?: string; componentId: string }> = [];

  const visit = (
    components: Array<{ componentId: string; content?: Record<string, unknown> }> | undefined,
    parentPath: string
  ) => {
    if (!components) return;
    for (const component of components) {
      const path = parentPath ? `${parentPath}.${component.componentId}` : component.componentId;
      const content = component.content as Record<string, unknown> | undefined;
      if (!content) continue;

      if (Array.isArray(content.images)) {
        for (const img of content.images as Array<{ key?: string; altText?: string }>) {
          if (img.key) images.push({ key: img.key, altText: img.altText, componentId: path });
        }
      }
      if (Array.isArray(content.paragraphs)) {
        for (const p of content.paragraphs as Array<{
          images?: Array<{ key?: string; altText?: string }>;
        }>) {
          if (Array.isArray(p.images)) {
            for (const img of p.images) {
              if (img.key) images.push({ key: img.key, altText: img.altText, componentId: path });
            }
          }
        }
      }
      if (Array.isArray(content.components)) {
        visit(
          content.components as Array<{ componentId: string; content?: Record<string, unknown> }>,
          path
        );
      }
      if (Array.isArray(content.chunks)) {
        (content.chunks as Array<Array<{ componentId: string; content?: Record<string, unknown> }>>).forEach(
          (chunk, idx) => visit(chunk, `${path}[${idx}]`)
        );
      }
    }
  };

  visit(item.components, "");
  return images;
}

function buildContextMessage(
  item: ItemDetails,
  prompt: string,
  targetComponents?: string[],
  sourceLanguage: string = "en",
  targetLanguage: string = "en"
): string {
  // Build detailed component listing with full content. Flatten pieces/chunks so
  // nested editable leaves (e.g. SEO fields inside a "meta" piece) show up as
  // addressable components with dotted paths like "meta.title".
  const leaves = flattenEditableComponents(
    item.components as unknown as Array<{
      componentId: string;
      type: string;
      name?: string;
      content?: Record<string, unknown>;
    }>,
    item.shape.components
  );
  const componentDetails = leaves
    .map((leaf) => {
      const fullContent = getFullComponentContent(leaf.content);
      const prefix = leaf.parentLabel ? `${leaf.parentLabel} / ` : "";
      return `### ${leaf.path} (${prefix}${leaf.label}) [${leaf.type}]
${fullContent}`;
    })
    .join("\n\n---\n\n");

  // Get available images that can be used in paragraph collections
  const availableImages = getAvailableImages(item);
  const imageList = availableImages.length > 0 
    ? `\nAVAILABLE IMAGES (can be used in paragraphCollection):\n${availableImages.map((img, i) => 
        `${i + 1}. key: "${img.key}" | alt: "${img.altText || 'none'}" | from: ${img.componentId}`
      ).join("\n")}\n`
    : "";

  let context = `ITEM CONTEXT:
Item Name: ${item.name}
Item Type: ${item.type}
Shape: ${item.shape.name} (${item.shape.identifier})
SOURCE LANGUAGE: ${sourceLanguage}
TARGET LANGUAGE: ${targetLanguage}
${imageList}
FULL COMPONENT CONTENT:
Use this content as context when generating new content. For example, use the title and intro to inform the style and content of a story.

${componentDetails}

---

`;

  if (sourceLanguage !== targetLanguage) {
    context += `TRANSLATION MODE: Translate and rewrite content from ${sourceLanguage} to ${targetLanguage}. Preserve meaning, tone, and structure while making it natural in ${targetLanguage}.

`;
  }

  if (targetComponents?.length) {
    const targets = targetComponents
      .map((path) => {
        const leaf = leaves.find((l) => l.path === path);
        if (!leaf) return `- ${path}`;
        const parent = leaf.parentLabel ? `${leaf.parentLabel} / ` : "";
        return `- ${path} — ${parent}${leaf.label} [${leaf.type}]`;
      })
      .join("\n");
    context += `TARGET COMPONENTS TO UPDATE (only update these, using each field's specific role):
${targets}

`;
  }

  context += `USER REQUEST: ${prompt}`;

  return context;
}

export interface AIGenerationResult {
  updates: ComponentUpdate[];
  explanation: string;
}

export async function generateComponentUpdates(
  item: ItemDetails,
  prompt: string,
  targetComponents?: string[],
  sourceLanguage: string = "en",
  targetLanguage: string = sourceLanguage
): Promise<AIGenerationResult> {
  const userMessage = buildContextMessage(
    item,
    prompt,
    targetComponents,
    sourceLanguage,
    targetLanguage
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Parse JSON response
    const result = JSON.parse(text);
    return {
      updates: result.updates || [],
      explanation: result.explanation || "Updates generated.",
    };
  } catch {
    // If JSON parsing fails, try to extract from code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[1]);
      return {
        updates: result.updates || [],
        explanation: result.explanation || "Updates generated.",
      };
    }
    throw new Error("Failed to parse AI response");
  }
}
