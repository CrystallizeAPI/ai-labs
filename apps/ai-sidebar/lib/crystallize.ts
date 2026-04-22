import type { ItemDetails, ItemComponent, ComponentContent } from "./types";

const CRYSTALLIZE_TENANT = process.env.CRYSTALLIZE_TENANT_IDENTIFIER!;
const CRYSTALLIZE_TOKEN_ID = process.env.CRYSTALLIZE_ACCESS_TOKEN_ID!;
const CRYSTALLIZE_TOKEN_SECRET = process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET!;

const PIM_API_URL = `https://pim.crystallize.com/graphql`;

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
 * Fetch item details including shape and components
 */
export async function getItem(
  itemId: string,
  language: string
): Promise<ItemDetails> {
  // Leaf content fragment — flat component types only (no piece/chunk recursion)
  const leafContent = `
    __typename
    ...on SingleLineContent { text }
    ...on RichTextContent { plainText json }
    ...on NumericContent { number unit }
    ...on BooleanContent { value }
    ...on ImageContent {
      images { key url altText caption { plainText } }
    }
    ...on ParagraphCollectionContent {
      paragraphs {
        title { text }
        body { plainText json }
        images { key url altText caption { plainText } }
      }
    }
  `;

  const query = `
    query GetItem($itemId: ID!, $language: String!) {
      item {
        get(id: $itemId, language: $language) {
          id
          name
          type
          tree { path }
          shape {
            identifier
            name
            components {
              id
              name
              type
              description
              config {
                ...on ContentChunkComponentConfig {
                  repeatable
                  components { id name type description }
                }
              }
            }
          }
          components {
            componentId
            type
            name
            content {
              ${leafContent}
              ...on PieceContent {
                identifier
                components {
                  componentId
                  type
                  name
                  content { ${leafContent} }
                }
              }
              ...on ContentChunkContent {
                chunks {
                  componentId
                  type
                  name
                  content { ${leafContent} }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await pimApiQuery<{
    item: {
      get: {
        id: string;
        name: string;
        type: string;
        tree: { path: string };
        shape: {
          identifier: string;
          name: string;
          components: Array<{
            id: string;
            name: string;
            type: string;
            description?: string;
          }>;
        };
        components: Array<{
          componentId: string;
          type: string;
          content: Record<string, unknown>;
        }>;
      } | null;
    };
  }>(query, { itemId, language });

  if (!data.item.get) {
    throw new Error(`Item not found: ${itemId} (language: ${language})`);
  }

  const item = data.item.get;
  
  // Normalize item type (handle translated values)
  const normalizeType = (type: string): ItemDetails["type"] => {
    const typeMap: Record<string, ItemDetails["type"]> = {
      product: "product",
      producten: "product",
      document: "document",
      folder: "folder",
    };
    return typeMap[type.toLowerCase()] || "document";
  };
  
  return {
    id: item.id,
    name: item.name,
    type: normalizeType(item.type),
    path: item.tree.path,
    shape: item.shape,
    components: item.components,
  };
}

/**
 * Convert output-format component content back to ComponentInput content payload.
 * Used when reconstructing piece/chunk parent inputs from existing item data.
 */
function componentContentToInputPayload(
  type: string,
  content: ComponentContent | undefined
): Record<string, unknown> | unknown[] | undefined {
  if (!content) return undefined;
  switch (type) {
    case "singleLine":
      return content.text !== undefined ? { text: content.text } : undefined;
    case "richText":
      return content.json ? { json: content.json } : undefined;
    case "numeric":
      return typeof content.number === "number"
        ? { number: content.number, unit: content.unit }
        : undefined;
    case "boolean":
      return typeof content.value === "boolean" ? { value: content.value } : undefined;
    case "images":
      return Array.isArray(content.images)
        ? content.images.map((img) => ({ key: img.key, altText: img.altText }))
        : undefined;
    case "paragraphCollection":
      return content.paragraphs
        ? {
            paragraphs: content.paragraphs.map((p) => ({
              title: p.title ? { text: p.title.text } : undefined,
              body: p.body?.json ? { json: p.body.json } : undefined,
              images: p.images
                ? p.images.map((img) => ({ key: img.key, altText: img.altText }))
                : undefined,
            })),
          }
        : undefined;
    default:
      return undefined;
  }
}

/**
 * Build a ComponentInput payload slot ({ singleLine: {...} } etc.) for a given type + content.
 */
function buildTypedInputSlot(
  type: string,
  content: Record<string, unknown> | unknown[]
): Record<string, unknown> | null {
  switch (type) {
    case "singleLine":
      return { singleLine: content };
    case "richText":
      return { richText: content };
    case "paragraphCollection":
      return { paragraphCollection: content };
    case "numeric":
      return { numeric: content };
    case "boolean":
      return { boolean: content };
    case "images":
      return { images: content };
    default:
      return null;
  }
}

/**
 * Parse a component path like "meta.title" or "specs[0].width" into parts.
 */
function parseComponentPath(
  path: string
): { parentId: string; chunkIndex?: number; childId: string } | null {
  const chunkMatch = path.match(/^([^.[\]]+)\[(\d+)\]\.(.+)$/);
  if (chunkMatch) {
    return {
      parentId: chunkMatch[1],
      chunkIndex: Number(chunkMatch[2]),
      childId: chunkMatch[3],
    };
  }
  const pieceMatch = path.match(/^([^.[\]]+)\.(.+)$/);
  if (pieceMatch) {
    return { parentId: pieceMatch[1], childId: pieceMatch[2] };
  }
  return null;
}

/**
 * Build ComponentInput for updating a single child within a piece parent.
 */
function buildPieceUpdateInput(
  parent: ItemComponent,
  childId: string,
  childType: string,
  newChildContent: Record<string, unknown> | unknown[]
): Record<string, unknown> {
  const identifier = parent.content.identifier;
  if (!identifier) {
    throw new Error(`Piece ${parent.componentId} is missing identifier`);
  }
  const children = parent.content.components || [];
  const components = children.map((child) => {
    const input: Record<string, unknown> = { componentId: child.componentId };
    if (child.componentId === childId) {
      const slot = buildTypedInputSlot(childType, newChildContent);
      if (!slot) throw new Error(`Unsupported child type: ${childType}`);
      Object.assign(input, slot);
    } else {
      const payload = componentContentToInputPayload(child.type, child.content);
      if (payload !== undefined) {
        const slot = buildTypedInputSlot(child.type, payload);
        if (slot) Object.assign(input, slot);
      }
    }
    return input;
  });
  return {
    componentId: parent.componentId,
    piece: { identifier, components },
  };
}

/**
 * Build ComponentInput for updating a single child within a content chunk.
 */
function buildChunkUpdateInput(
  parent: ItemComponent,
  chunkIndex: number,
  childId: string,
  childType: string,
  newChildContent: Record<string, unknown> | unknown[]
): Record<string, unknown> {
  const chunks = parent.content.chunks || [];
  const newChunks = chunks.map((chunk, idx) =>
    chunk.map((child) => {
      const input: Record<string, unknown> = { componentId: child.componentId };
      if (idx === chunkIndex && child.componentId === childId) {
        const slot = buildTypedInputSlot(childType, newChildContent);
        if (!slot) throw new Error(`Unsupported child type: ${childType}`);
        Object.assign(input, slot);
      } else {
        const payload = componentContentToInputPayload(child.type, child.content);
        if (payload !== undefined) {
          const slot = buildTypedInputSlot(child.type, payload);
          if (slot) Object.assign(input, slot);
        }
      }
      return input;
    })
  );
  return {
    componentId: parent.componentId,
    contentChunk: { chunks: newChunks },
  };
}

/**
 * Update a component on an item. Supports nested paths for pieces ("meta.title")
 * and content chunks ("specs[0].width"). For nested updates, `item` must be
 * provided so the parent piece/chunk can be reconstructed.
 */
export async function updateItemComponent(
  itemId: string,
  language: string,
  componentPath: string,
  componentType: string,
  content: Record<string, unknown> | unknown[],
  item?: ItemDetails
): Promise<{ success: boolean; error?: string }> {
  let input: Record<string, unknown>;

  const parsed = parseComponentPath(componentPath);
  if (parsed) {
    if (!item) {
      return {
        success: false,
        error: "Nested component updates require the current item state",
      };
    }
    const parent = item.components.find((c) => c.componentId === parsed.parentId);
    if (!parent) {
      return { success: false, error: `Parent component not found: ${parsed.parentId}` };
    }
    try {
      if (parent.type === "piece") {
        input = buildPieceUpdateInput(parent, parsed.childId, componentType, content);
      } else if (parent.type === "contentChunk") {
        if (parsed.chunkIndex === undefined) {
          return { success: false, error: "Chunk index missing in path" };
        }
        input = buildChunkUpdateInput(
          parent,
          parsed.chunkIndex,
          parsed.childId,
          componentType,
          content
        );
      } else {
        return {
          success: false,
          error: `Parent component ${parent.componentId} is not a piece or chunk`,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to build update",
      };
    }
  } else {
    const slot = buildTypedInputSlot(componentType, content);
    if (!slot) {
      return { success: false, error: `Unsupported component type: ${componentType}` };
    }
    input = { componentId: componentPath, ...slot };
  }

  console.log("PIM Update - Input:", JSON.stringify({ itemId, language, input }, null, 2));

  const mutation = `
    mutation UpdateComponent($itemId: ID!, $language: String!, $input: ComponentInput!) {
      item {
        updateComponent(itemId: $itemId, language: $language, input: $input) {
          id
          name
        }
      }
    }
  `;

  try {
    const data = await pimApiQuery<{
      item: {
        updateComponent: { id?: string; name?: string } | null;
      };
    }>(mutation, { itemId, language, input });

    console.log("PIM Update - Response:", JSON.stringify(data, null, 2));

    if (!data.item.updateComponent?.id) {
      return { success: false, error: "Update failed - no item returned" };
    }

    return { success: true };
  } catch (err) {
    console.error("PIM Update - Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Update failed",
    };
  }
}

/**
 * Fetch all topic maps from Crystallize tenant (recursively gets all nested topics)
 */
export interface Topic {
  id: string;
  name: string;
  path: string;
  children?: Topic[];
}

export interface TopicMap {
  id: string;
  name: string;
  children: Topic[];
}

// Cache for tenant ID
let cachedTenantId: string | null = null;

/**
 * Get the actual tenant ID (MongoDB ObjectId) from the API
 */
export async function getTenantId(): Promise<string> {
  if (cachedTenantId) {
    return cachedTenantId;
  }

  const query = `
    query GetTenant($identifier: String!) {
      tenant {
        get(identifier: $identifier) {
          id
          identifier
        }
      }
    }
  `;

  const data = await pimApiQuery<{
    tenant: {
      get: {
        id: string;
        identifier: string;
      };
    };
  }>(query, { identifier: CRYSTALLIZE_TENANT });

  cachedTenantId = data.tenant.get.id;
  return cachedTenantId;
}

export async function getTopicMaps(language: string = "en"): Promise<TopicMap[]> {
  const tenantId = await getTenantId();
  
  const query = `
    query GetTopicMaps($language: String!, $tenantId: ID!) {
      topic {
        getRootTopics(language: $language, tenantId: $tenantId) {
          id
          name
          path
          children {
            id
            name
            path
            children {
              id
              name
              path
            }
          }
        }
      }
    }
  `;

  const data = await pimApiQuery<{
    topic: {
      getRootTopics: TopicMap[];
    };
  }>(query, { language, tenantId });

  return data.topic.getRootTopics || [];
}

/**
 * Flatten all topics from topic maps into a single array
 */
export function flattenTopics(rootTopics: TopicMap[]): Topic[] {
  const topics: Topic[] = [];
  
  function collectTopics(items: Topic[]) {
    for (const item of items) {
      topics.push({ id: item.id, name: item.name, path: item.path || "" });
      if (item.children && item.children.length > 0) {
        collectTopics(item.children);
      }
    }
  }
  
  // Root topics are also topics themselves
  collectTopics(rootTopics);
  
  return topics;
}

/**
 * Fetch available languages configured for the tenant
 * Following the pattern from https://github.com/CrystallizeAPI/translation-app
 */
export interface TenantLanguage {
  code: string;
  name: string;
  system: boolean;
}

export async function getAvailableLanguages(): Promise<TenantLanguage[]> {
  const query = `
    query GetAvailableLanguages($identifier: String!) {
      tenant {
        get(identifier: $identifier) {
          availableLanguages {
            name
            code
            system
          }
        }
      }
    }
  `;

  const data = await pimApiQuery<{
    tenant: {
      get: {
        availableLanguages: TenantLanguage[];
      };
    };
  }>(query, { identifier: CRYSTALLIZE_TENANT });

  return data.tenant.get.availableLanguages;
}

/**
 * Upload image file to Crystallize asset storage
 */
export async function uploadImageAsset(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ url: string; key: string }> {
  // For now, we'll use a simple approach: store as base64 in a temporary location
  // In production, you'd use Crystallize's asset upload endpoint
  // The image URL will be returned from the AI analysis and stored directly in components

  const key = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    key,
    url: `data:image/jpeg;base64,${fileBuffer.toString("base64")}`,
  };
}

