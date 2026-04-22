import { NextRequest, NextResponse } from "next/server";
import { updateItemComponent, getTenantId, getItem } from "@/lib/crystallize";
import type { Paragraph } from "@/lib/types";

const CRYSTALLIZE_TENANT = process.env.CRYSTALLIZE_TENANT_IDENTIFIER!;
const CRYSTALLIZE_TOKEN_ID = process.env.CRYSTALLIZE_ACCESS_TOKEN_ID!;
const CRYSTALLIZE_TOKEN_SECRET = process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET!;

const PIM_API_URL = `https://pim.crystallize.com/graphql`;

interface ParagraphSelection {
  componentId: string;
  componentName: string;
  paragraphIndex: number;
  paragraphTitle: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function pimApiQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(PIM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Crystallize-Access-Token-Id": CRYSTALLIZE_TOKEN_ID,
      "X-Crystallize-Access-Token-Secret": CRYSTALLIZE_TOKEN_SECRET,
      "X-Crystallize-Tenant-Identifier": CRYSTALLIZE_TENANT,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error("No data returned from API");
  }

  return json.data;
}

/**
 * Upload image to Crystallize using presigned URL
 */
async function uploadImageToCrystallize(
  imageBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ key: string }> {
  // Step 1: Get presigned upload URL from Crystallize
  const generateUploadUrlMutation = `
    mutation GeneratePresignedRequest($tenantId: ID!, $filename: String!, $contentType: String!) {
      fileUpload {
        generatePresignedRequest(
          tenantId: $tenantId
          filename: $filename
          contentType: $contentType
        ) {
          url
          fields {
            name
            value
          }
        }
      }
    }
  `;

  const tenantId = await getTenantId();

  const presignedData = await pimApiQuery<{
    fileUpload: {
      generatePresignedRequest: {
        url: string;
        fields: Array<{ name: string; value: string }>;
      };
    };
  }>(generateUploadUrlMutation, {
    tenantId: tenantId,
    filename: fileName,
    contentType: contentType,
  });

  const { url, fields } = presignedData.fileUpload.generatePresignedRequest;
  
  // Extract the key from the fields
  const keyField = fields.find((f) => f.name === "key");
  if (!keyField) {
    throw new Error("No key field in presigned response");
  }

  // Step 2: Upload the file using the presigned URL
  const formData = new FormData();
  for (const field of fields) {
    formData.append(field.name, field.value);
  }
  // Convert Buffer to Uint8Array for Blob compatibility
  const uint8Array = new Uint8Array(imageBuffer);
  formData.append("file", new Blob([uint8Array], { type: contentType }), fileName);

  const uploadRes = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed: ${uploadRes.status} ${text}`);
  }

  console.log("Image uploaded to Crystallize, key:", keyField.value);

  return { key: keyField.value };
}

/**
 * Assign topics to an uploaded image using topic.addImages
 */
async function assignTopicsToImage(
  imageKey: string,
  topicIds: string[]
): Promise<void> {
  if (!topicIds || topicIds.length === 0) return;

  // Build dynamic mutation with aliases for each topic
  const mutations = topicIds.map((topicId, index) => 
    `add_topic_${index}: addImages(topicId: "${topicId}", imageKeys: ["${imageKey}"]) { modified }`
  ).join("\n    ");

  const mutation = `
    mutation UPDATE_TOPICS_ON_IMAGE {
      topic {
        ${mutations}
      }
    }
  `;

  try {
    const result = await pimApiQuery<{
      topic: Record<string, { modified: string }>;
    }>(mutation, {});
    console.log("Topics assigned to image:", result.topic);
  } catch (err) {
    console.error("Failed to assign topics to image:", err);
    // Don't throw - topic assignment is optional
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const itemId = formData.get("itemId") as string;
    const language = formData.get("language") as string;
    const altText = formData.get("altText") as string;
    const caption = formData.get("caption") as string;
    const componentsJson = formData.get("components") as string;
    const paragraphsJson = formData.get("paragraphs") as string;
    const topicsJson = formData.get("topics") as string;

    if (!imageFile || !itemId || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const selectedComponents: string[] = JSON.parse(componentsJson || "[]");
    const selectedParagraphs: ParagraphSelection[] = JSON.parse(paragraphsJson || "[]");
    const suggestedTopics = JSON.parse(topicsJson || "[]");

    // Need at least one target (component or paragraph)
    if (selectedComponents.length === 0 && selectedParagraphs.length === 0) {
      return NextResponse.json(
        { error: "No components or paragraphs selected" },
        { status: 400 }
      );
    }

    // Convert image to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Upload image to Crystallize
    const contentType = imageFile.type || "image/jpeg";
    const { key } = await uploadImageToCrystallize(imageBuffer, imageFile.name, contentType);

    console.log(
      "Associating image - Components:",
      selectedComponents,
      "Paragraphs:",
      selectedParagraphs,
      "Topics:",
      suggestedTopics
    );

    // Track all updates
    const updates: Array<{ 
      success: boolean; 
      componentId: string; 
      type: "component" | "paragraph";
      paragraphIndex?: number;
      error?: string 
    }> = [];

    // For each selected image component, update it with the image
    for (const componentId of selectedComponents) {
      try {
        // Build image content for the component using the uploaded key
        // Note: topics are assigned to the asset separately, not in the component
        const imageContent = [
          {
            key: key,
            altText: altText || imageFile.name,
            caption: caption ? { json: null, html: caption } : undefined,
          },
        ];

        console.log("Image content being sent:", JSON.stringify(imageContent, null, 2));

        const result = await updateItemComponent(
          itemId,
          language,
          componentId,
          "images",
          imageContent
        );

        console.log("Update result:", result);

        if (result.success) {
          updates.push({ success: true, componentId, type: "component" });
        } else {
          updates.push({
            success: false,
            componentId,
            type: "component",
            error: result.error,
          });
        }
      } catch (err) {
        console.error(`Failed to update component ${componentId}:`, err);
        updates.push({
          success: false,
          componentId,
          type: "component",
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    }

    // For each selected paragraph, add the image to it
    if (selectedParagraphs.length > 0) {
      // Group paragraphs by component
      const paragraphsByComponent = selectedParagraphs.reduce((acc, p) => {
        if (!acc[p.componentId]) {
          acc[p.componentId] = [];
        }
        acc[p.componentId].push(p.paragraphIndex);
        return acc;
      }, {} as Record<string, number[]>);

      // Fetch current item to get existing paragraph content
      const currentItem = await getItem(itemId, language);

      for (const [componentId, paragraphIndices] of Object.entries(paragraphsByComponent)) {
        try {
          // Find existing content for this component
          const itemComp = currentItem.components.find(
            (c) => c.componentId === componentId
          );
          const existingParagraphs = (itemComp?.content?.paragraphs as Paragraph[]) || [];

          // Build updated paragraphs array with new image added to selected paragraphs
          const updatedParagraphs = existingParagraphs.map((para, idx) => {
            const paraUpdate: Record<string, unknown> = {
              title: para.title ? { text: para.title.text } : undefined,
              // RichTextContentInput only accepts json, not plainText
              body: para.body?.json ? { json: para.body.json } : undefined,
            };

            // Copy existing images
            const currentImages = para.images || [];
            const imagesList: Array<{
              key: string;
              altText?: string;
              caption?: { html?: string; json?: unknown } | undefined;
            }> = currentImages.map((img) => ({
              key: img.key,
              altText: img.altText,
              // Copy caption as html if available
              caption: img.caption?.html ? { html: img.caption.html } : 
                       img.caption?.json ? { json: img.caption.json } : undefined,
            }));

            // If this paragraph is selected, add the new image
            if (paragraphIndices.includes(idx)) {
              imagesList.push({
                key: key,
                altText: altText || imageFile.name,
                caption: caption ? { html: caption } : undefined,
              });
            }

            if (imagesList.length > 0) {
              paraUpdate.images = imagesList;
            }

            // Copy existing videos if any
            if (para.videos && para.videos.length > 0) {
              paraUpdate.videos = para.videos.map((v) => ({
                key: v.key,
                title: v.title,
              }));
            }

            return paraUpdate;
          });

          console.log(
            `Updating paragraphCollection ${componentId} with images at indices:`,
            paragraphIndices
          );

          const result = await updateItemComponent(
            itemId,
            language,
            componentId,
            "paragraphCollection",
            { paragraphs: updatedParagraphs }
          );

          if (result.success) {
            for (const idx of paragraphIndices) {
              updates.push({
                success: true,
                componentId,
                type: "paragraph",
                paragraphIndex: idx,
              });
            }
          } else {
            for (const idx of paragraphIndices) {
              updates.push({
                success: false,
                componentId,
                type: "paragraph",
                paragraphIndex: idx,
                error: result.error,
              });
            }
          }
        } catch (err) {
          console.error(`Failed to update paragraph collection ${componentId}:`, err);
          for (const idx of paragraphIndices) {
            updates.push({
              success: false,
              componentId,
              type: "paragraph",
              paragraphIndex: idx,
              error: err instanceof Error ? err.message : "Update failed",
            });
          }
        }
      }
    }

    // Check if at least one update succeeded
    const successCount = updates.filter((u) => u.success).length;

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: "Failed to associate image",
          details: updates,
        },
        { status: 500 }
      );
    }

    // Assign topics to the uploaded image (after component update confirms image is available)
    const topicIds = suggestedTopics.map((t: { id: string }) => t.id);
    if (topicIds.length > 0) {
      await assignTopicsToImage(key, topicIds);
    }

    const componentCount = updates.filter((u) => u.success && u.type === "component").length;
    const paragraphCount = updates.filter((u) => u.success && u.type === "paragraph").length;
    let message = "Image associated with";
    if (componentCount > 0) message += ` ${componentCount} component(s)`;
    if (componentCount > 0 && paragraphCount > 0) message += " and";
    if (paragraphCount > 0) message += ` ${paragraphCount} paragraph(s)`;

    // Construct the media URL from the key
    const imageUrl = `https://media.crystallize.com/${key}`;

    return NextResponse.json({
      success: true,
      message,
      updates,
      imageKey: key,
      imageUrl,
    });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
