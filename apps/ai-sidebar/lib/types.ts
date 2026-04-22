// Item types

export interface ShapeComponent {
  id: string;
  name: string;
  type: string;
  description?: string;
  config?: {
    identifier?: string;
    components?: ShapeComponent[];
  };
}

export interface ItemComponent {
  componentId: string;
  type: string;
  name?: string;
  content: ComponentContent;
}

export interface ComponentContent {
  text?: string;
  plainText?: string[];
  json?: RichTextNode[];
  number?: number;
  unit?: string;
  value?: boolean;
  paragraphs?: Paragraph[];
  images?: Image[];
  // Piece
  identifier?: string;
  components?: ItemComponent[];
  // Content chunk - array of chunks, each chunk is array of components
  chunks?: ItemComponent[][];
}

export interface RichTextNode {
  kind: "block" | "inline";
  type: string;
  textContent?: string;
  children?: RichTextNode[];
}

export interface Paragraph {
  title?: { text: string };
  body?: { plainText?: string[]; json?: RichTextNode[] };
  images?: Array<{ key: string; altText?: string; caption?: { json?: RichTextNode[] | null; html?: string } }> | null;
  videos?: Array<{ key: string; title?: string }> | null;
}

export interface ParagraphCollectionContent {
  paragraphs: Paragraph[];
}

export interface Image {
  key?: string;
  url: string;
  altText?: string;
  caption?: { plainText?: string[] };
}

export interface ItemShape {
  identifier: string;
  name: string;
  components: ShapeComponent[];
}

export interface ItemDetails {
  id: string;
  name: string;
  type: "product" | "document" | "folder";
  path: string;
  shape: ItemShape;
  components: ItemComponent[];
}

// Update types

export interface ComponentUpdate {
  componentId: string;
  type: string;
  content: ComponentContent;
  preview?: string;
}

export interface AIGenerationResponse {
  updates: ComponentUpdate[];
  explanation: string;
}
