/**
 * Debounce a function to prevent excessive calls
 */
export function debounce<T>(
  fn: (payload: T) => Promise<void> | void,
  delay: number
): (payload: T) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (payload: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(payload);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Get plain text preview from component content
 */
export function getComponentPreview(content: Record<string, unknown>): string {
  if (!content) return "—";
  
  if (typeof content.text === "string") {
    return content.text;
  }
  
  if (Array.isArray(content.plainText) && content.plainText.length > 0) {
    return content.plainText.join("\n");
  }
  
  if (typeof content.number === "number") {
    return `${content.number}${content.unit ? ` ${content.unit}` : ""}`;
  }
  
  if (typeof content.value === "boolean") {
    return content.value ? "Yes" : "No";
  }
  
  if (Array.isArray(content.paragraphs)) {
    return content.paragraphs
      .map((p: { title?: { text: string }; body?: { plainText?: string[] } }) => 
        p.title?.text || p.body?.plainText?.[0] || ""
      )
      .filter(Boolean)
      .join("\n");
  }
  
  if (Array.isArray(content.images)) {
    return `${content.images.length} image(s)`;
  }

  // Piece preview: show nested component previews joined
  if (Array.isArray(content.components)) {
    return content.components
      .map((c: { name?: string; content?: Record<string, unknown> }) => {
        const inner = c.content ? getComponentPreview(c.content) : "";
        return inner && inner !== "—" ? `${c.name ?? ""}: ${inner}`.trim() : "";
      })
      .filter(Boolean)
      .join(" · ");
  }

  // Chunk preview: summarize count
  if (Array.isArray(content.chunks)) {
    return `${content.chunks.length} chunk(s)`;
  }

  return "—";
}

/**
 * A flattened, editable leaf component with a path-aware identifier.
 */
export interface EditableLeaf {
  /** Path-aware id: "title" | "meta.title" | "specs[0].width" */
  path: string;
  /** Original componentId of the leaf */
  componentId: string;
  type: string;
  content: Record<string, unknown>;
  /** Display label, including parent prefix when nested */
  label: string;
  /** Parent piece/chunk label, if any */
  parentLabel?: string;
}

const EDITABLE_LEAF_TYPES = ["singleLine", "richText", "paragraphCollection"];

interface FlattenableComponent {
  componentId: string;
  type: string;
  name?: string;
  content?: Record<string, unknown>;
}

interface ShapeLike {
  id: string;
  name: string;
  type: string;
}

/**
 * Flatten top-level components, descending into pieces and content chunks,
 * producing a list of leaves that the UI can render as editable rows.
 */
export function flattenEditableComponents(
  components: FlattenableComponent[],
  shapeComponents: ShapeLike[]
): EditableLeaf[] {
  const leaves: EditableLeaf[] = [];

  for (const component of components) {
    const shapeDef = shapeComponents.find((s) => s.id === component.componentId);
    const label = shapeDef?.name || component.name || component.componentId;
    const content = (component.content || {}) as Record<string, unknown>;

    if (EDITABLE_LEAF_TYPES.includes(component.type)) {
      leaves.push({
        path: component.componentId,
        componentId: component.componentId,
        type: component.type,
        content,
        label,
      });
      continue;
    }

    if (component.type === "piece" && Array.isArray(content.components)) {
      const children = content.components as FlattenableComponent[];
      for (const child of children) {
        if (!EDITABLE_LEAF_TYPES.includes(child.type)) continue;
        const childLabel = child.name || child.componentId;
        leaves.push({
          path: `${component.componentId}.${child.componentId}`,
          componentId: child.componentId,
          type: child.type,
          content: (child.content || {}) as Record<string, unknown>,
          label: childLabel,
          parentLabel: label,
        });
      }
      continue;
    }

    if (component.type === "contentChunk" && Array.isArray(content.chunks)) {
      const chunks = content.chunks as FlattenableComponent[][];
      chunks.forEach((chunk, idx) => {
        for (const child of chunk) {
          if (!EDITABLE_LEAF_TYPES.includes(child.type)) continue;
          const childLabel = child.name || child.componentId;
          leaves.push({
            path: `${component.componentId}[${idx}].${child.componentId}`,
            componentId: child.componentId,
            type: child.type,
            content: (child.content || {}) as Record<string, unknown>,
            label: childLabel,
            parentLabel: chunks.length > 1 ? `${label} #${idx + 1}` : label,
          });
        }
      });
    }
  }

  return leaves;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
