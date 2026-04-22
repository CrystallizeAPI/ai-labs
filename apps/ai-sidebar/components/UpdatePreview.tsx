"use client";

import type { ComponentUpdate, ItemDetails, ItemComponent } from "@/lib/types";
import { getComponentPreview } from "@/lib/utils";
import { RichTextPreview } from "./RichTextPreview";
import type { LanguageOption } from "@/lib/languages";

/**
 * Resolve a (possibly nested) component path against an item.
 * Supports "componentId", "parent.child", and "parent[index].child".
 */
function resolvePath(
  item: ItemDetails,
  path: string
): { component?: ItemComponent; label: string } {
  const chunkMatch = path.match(/^([^.[\]]+)\[(\d+)\]\.(.+)$/);
  if (chunkMatch) {
    const [, parentId, idxStr, childId] = chunkMatch;
    const parent = item.components.find((c) => c.componentId === parentId);
    const parentShape = item.shape.components.find((s) => s.id === parentId);
    const chunk = parent?.content.chunks?.[Number(idxStr)];
    const child = chunk?.find((c) => c.componentId === childId);
    const parentLabel = parentShape?.name || parentId;
    return {
      component: child,
      label: `${parentLabel} #${Number(idxStr) + 1} / ${child?.name || childId}`,
    };
  }
  const pieceMatch = path.match(/^([^.[\]]+)\.(.+)$/);
  if (pieceMatch) {
    const [, parentId, childId] = pieceMatch;
    const parent = item.components.find((c) => c.componentId === parentId);
    const parentShape = item.shape.components.find((s) => s.id === parentId);
    const child = parent?.content.components?.find((c) => c.componentId === childId);
    const parentLabel = parentShape?.name || parentId;
    return {
      component: child,
      label: `${parentLabel} / ${child?.name || childId}`,
    };
  }
  const component = item.components.find((c) => c.componentId === path);
  const shape = item.shape.components.find((s) => s.id === path);
  return { component, label: shape?.name || path };
}


interface UpdatePreviewProps {
  updates: ComponentUpdate[];
  item: ItemDetails;
  applyLanguage: string;
  onApplyLanguageChange: (language: string) => void;
  languageOptions: LanguageOption[];
  onApply: (update: ComponentUpdate) => void;
  onApplyAll: () => void;
  onReject: (componentId: string) => void;
  isApplying: boolean;
}

function imageUrl(img: { key?: string; url?: string }): string | undefined {
  if (img.url) return img.url;
  if (img.key) return `https://media.crystallize.com/${img.key}`;
  return undefined;
}

/**
 * Build a key -> url map from all images that exist on the item, so an AI
 * response that only references a `key` resolves to the actual CDN URL and
 * hallucinated keys can be filtered out.
 */
function collectKnownImages(item: ItemDetails): Map<string, { url: string; altText?: string }> {
  const map = new Map<string, { url: string; altText?: string }>();
  const visit = (components?: ItemComponent[]) => {
    if (!components) return;
    for (const c of components) {
      const content = c.content as Record<string, unknown>;
      const imgs = content?.images as
        | Array<{ key?: string; url?: string; altText?: string }>
        | undefined;
      if (Array.isArray(imgs)) {
        for (const img of imgs) {
          if (img.key && img.url) {
            map.set(img.key, { url: img.url, altText: img.altText });
          }
        }
      }
      const paragraphs = content?.paragraphs as
        | Array<{ images?: Array<{ key?: string; url?: string; altText?: string }> | null }>
        | undefined;
      if (Array.isArray(paragraphs)) {
        for (const p of paragraphs) {
          if (Array.isArray(p.images)) {
            for (const img of p.images) {
              if (img.key && img.url) {
                map.set(img.key, { url: img.url, altText: img.altText });
              }
            }
          }
        }
      }
      if (Array.isArray(content?.components)) {
        visit(content.components as ItemComponent[]);
      }
      if (Array.isArray(content?.chunks)) {
        for (const chunk of content.chunks as ItemComponent[][]) {
          visit(chunk);
        }
      }
    }
  };
  visit(item.components);
  return map;
}

function ImageThumbs({
  images,
  knownImages,
}: {
  images: Array<{ key?: string; url?: string; altText?: string }>;
  knownImages?: Map<string, { url: string; altText?: string }>;
}) {
  if (!images?.length) return null;
  const resolved = images
    .map((img) => {
      if (img.url) return { url: img.url, altText: img.altText };
      if (img.key && knownImages?.has(img.key)) {
        const known = knownImages.get(img.key)!;
        return { url: known.url, altText: img.altText || known.altText };
      }
      if (img.key) return { url: imageUrl(img)!, altText: img.altText };
      return null;
    })
    .filter((x): x is { url: string; altText?: string } => !!x);

  if (!resolved.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {resolved.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={img.url}
          alt={img.altText || ""}
          className="w-14 h-14 object-cover rounded border border-gray-200 bg-gray-50"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ))}
    </div>
  );
}

function renderContent(
  content: Record<string, unknown>,
  type: string,
  isNew: boolean,
  knownImages?: Map<string, { url: string; altText?: string }>,
  fallbackParagraphs?: Array<{
    images?: Array<{ key?: string; url?: string; altText?: string }> | null;
  }>
) {
  // For richText, render formatted content
  if (type === "richText" && content?.json && Array.isArray(content.json)) {
    return (
      <RichTextPreview
        json={content.json}
        className={isNew ? "text-gray-800" : "text-gray-700"}
      />
    );
  }

  // For paragraphCollection, render each section Crystallize-style
  if (type === "paragraphCollection" && content?.paragraphs && Array.isArray(content.paragraphs)) {
    const paragraphs = content.paragraphs as Array<{
      title?: { text?: string };
      body?: { json?: unknown[] };
      images?: Array<{ key?: string; url?: string; altText?: string }> | null;
    }>;
    return (
      <div className="space-y-3">
        {paragraphs.map((p, i) => {
          // If AI-provided image keys don't resolve, fall back to the current
          // paragraph's images at the same index (text-only rewrites shouldn't lose imagery)
          let images = p.images || [];
          if (isNew && knownImages && images.length > 0) {
            const hasUnknown = images.some(
              (img) => !img.url && (!img.key || !knownImages.has(img.key))
            );
            if (hasUnknown && fallbackParagraphs?.[i]?.images?.length) {
              images = fallbackParagraphs[i].images!;
            }
          }

          return (
            <div
              key={i}
              className={`rounded-md border px-3 py-2.5 ${
                isNew
                  ? "border-cyan-200/70 bg-white/70"
                  : "border-gray-100 bg-white"
              }`}
            >
              {p.title?.text && (
                <p className="text-[14px] font-semibold text-gray-900 mb-1.5 leading-snug">
                  {p.title.text}
                </p>
              )}
              {p.body?.json && Array.isArray(p.body.json) && (
                <RichTextPreview
                  json={p.body.json as Parameters<typeof RichTextPreview>[0]["json"]}
                  className={isNew ? "text-gray-800" : "text-gray-700"}
                />
              )}
              {images.length > 0 && (
                <ImageThumbs images={images} knownImages={knownImages} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Images component — show thumbnails directly
  if (type === "images" && Array.isArray(content?.images)) {
    return (
      <ImageThumbs
        images={content.images as Array<{ key?: string; url?: string; altText?: string }>}
        knownImages={knownImages}
      />
    );
  }

  // For other types, use plain text preview
  const text = getComponentPreview(content);
  return (
    <p className={`leading-relaxed whitespace-pre-wrap ${isNew ? "text-gray-800" : "text-gray-700"}`}>
      {text}
    </p>
  );
}

export function UpdatePreview({
  updates,
  item,
  applyLanguage,
  onApplyLanguageChange,
  languageOptions,
  onApply,
  onApplyAll,
  onReject,
  isApplying,
}: UpdatePreviewProps) {
  if (updates.length === 0) return null;

  const knownImages = collectKnownImages(item);

  return (
    <div className="border-b border-gray-200 bg-amber-50">
      <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          Pending Updates ({updates.length})
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-amber-700">
            Apply to
            <select
              value={applyLanguage}
              onChange={(e) => onApplyLanguageChange(e.target.value)}
              className="c-input py-1 px-2 text-xs w-auto"
              disabled={isApplying}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name} ({option.code})
                </option>
              ))}
            </select>
          </label>
          {updates.length > 1 && (
            <button
              onClick={onApplyAll}
              disabled={isApplying}
              className="c-btn c-btn-primary c-btn-sm"
            >
              Apply All
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-amber-200/50">
        {updates.map((update) => {
          const { component: currentComponent, label } = resolvePath(
            item,
            update.componentId
          );

          return (
            <div key={update.componentId} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {label}
                  </span>
                  <span className="c-tag">
                    {update.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReject(update.componentId)}
                    disabled={isApplying}
                    className="c-btn c-btn-danger c-btn-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => onApply(update)}
                    disabled={isApplying}
                    className="c-btn c-btn-primary c-btn-sm"
                  >
                    {isApplying ? (
                      <>
                        <div className="w-3 h-3 border border-gray-700/30 border-t-gray-700 rounded-full animate-spin" />
                        Applying
                      </>
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>
              </div>

              {/* Before/After */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className={`p-3 bg-white rounded-lg border border-gray-200 overflow-y-auto ${
                    update.type === "paragraphCollection" ? "max-h-[27rem]" : "max-h-72"
                  }`}
                >
                  <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-2 font-semibold">
                    Current
                  </p>
                  {renderContent(
                    currentComponent?.content as Record<string, unknown> || {},
                    update.type,
                    false,
                    knownImages
                  )}
                </div>
                <div
                  className={`p-3 bg-cyan-50/60 rounded-lg border border-cyan-200 overflow-y-auto ${
                    update.type === "paragraphCollection" ? "max-h-[27rem]" : "max-h-72"
                  }`}
                >
                  <p className="text-cyan-700 text-[10px] uppercase tracking-wide mb-2 font-semibold">
                    New
                  </p>
                  {renderContent(
                    update.content as Record<string, unknown>,
                    update.type,
                    true,
                    knownImages,
                    (currentComponent?.content as { paragraphs?: Array<{ images?: Array<{ key?: string; url?: string; altText?: string }> | null }> })?.paragraphs
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
