"use client";

import { useState, useEffect } from "react";
import { signal } from "@crystallize/app-signal";
import type { ItemDetails, Paragraph } from "@/lib/types";

interface ImageAnalysis {
  altText: string;
  caption: string;
  suggestedTopics: Array<{ id: string; name: string }>;
}

interface ImageUploadProps {
  item: ItemDetails;
  language: string;
}

// Paragraph selection: componentId + paragraph index
interface ParagraphSelection {
  componentId: string;
  componentName: string;
  paragraphIndex: number;
  paragraphTitle: string;
}

const STATUS_MESSAGES = [
  "Examining image...",
  "Identifying content...",
  "Analyzing composition...",
  "Generating suggestions...",
  "Matching topics...",
];

export function ImageUpload({ item, language }: ImageUploadProps) {
  const [uploadedImage, setUploadedImage] = useState<{
    url: string;
    file: File;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedParagraphs, setSelectedParagraphs] = useState<ParagraphSelection[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);

  // Get available image components from the item
  const imageComponents = item.shape.components.filter(
    (comp) => comp.type === "images"
  );

  // Get paragraph collection components with their paragraphs
  const paragraphCollections = item.shape.components
    .filter((comp) => comp.type === "paragraphCollection")
    .map((shapeComp) => {
      // Find the content for this component
      const itemComp = item.components.find(
        (c) => c.componentId === shapeComp.id
      );
      const paragraphs = (itemComp?.content?.paragraphs as Paragraph[]) || [];
      return {
        id: shapeComp.id,
        name: shapeComp.name,
        paragraphs,
      };
    })
    .filter((pc) => pc.paragraphs.length > 0); // Only show if has paragraphs

  // Cycle through status messages while analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setStatusIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a preview URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setUploadedImage({ url, file });
      setAnalysis(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!uploadedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadedImage.file);
      formData.append("itemName", item.name);
      formData.append("itemType", item.type);
      if (userPrompt.trim()) {
        formData.append("userPrompt", userPrompt.trim());
      }

      const res = await fetch("/api/ai/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAssociateImage = async () => {
    if (!uploadedImage || !analysis) return;
    
    // Need at least one component or one paragraph selected
    if (selectedComponents.length === 0 && selectedParagraphs.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadedImage.file);
      formData.append("itemId", item.id);
      formData.append("language", language);
      formData.append("altText", analysis.altText);
      formData.append("caption", analysis.caption);
      formData.append("components", JSON.stringify(selectedComponents));
      formData.append("paragraphs", JSON.stringify(selectedParagraphs));
      formData.append("topics", JSON.stringify(analysis.suggestedTopics));

      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload and associate image");
      }

      const result = await res.json();
      
      // Poll the image URL until it's available, then refresh
      if (result.imageUrl) {
        const pollImageReady = async () => {
          const maxAttempts = 20; // Max 10 seconds (20 * 500ms)
          for (let i = 0; i < maxAttempts; i++) {
            try {
              const headRes = await fetch(result.imageUrl, { method: "HEAD" });
              if (headRes.ok) {
                // Image is ready, send refresh signal
                signal.send("refetchItemComponents", {
                  itemId: item.id,
                  itemLanguage: language,
                });
                return;
              }
            } catch {
              // Ignore errors, keep polling
            }
            // Wait 500ms before next attempt
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          // Max attempts reached, send refresh anyway
          signal.send("refetchItemComponents", {
            itemId: item.id,
            itemLanguage: language,
          });
        };
        pollImageReady();
      } else {
        // No URL returned, fallback to timeout
        setTimeout(() => {
          signal.send("refetchItemComponents", {
            itemId: item.id,
            itemLanguage: language,
          });
        }, 1500);
      }

      // Show success and reset
      setSuccess(true);
      setUploadedImage(null);
      setAnalysis(null);
      setSelectedComponents([]);
      setSelectedParagraphs([]);
      
      // Clear success after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Step 1: Upload */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">
          Step 1: Upload Image
        </h3>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-cyan-400 transition-colors cursor-pointer relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          {uploadedImage ? (
            <div className="space-y-2">
              <img
                src={uploadedImage.url}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded"
              />
              <p className="text-xs text-gray-600">{uploadedImage.file.name}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600">
                Click or drag image here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Analyze */}
      {uploadedImage && !analysis && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">
            Step 2: Analyze with AI
          </h3>
          
          {isAnalyzing ? (
            <div className="py-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-sm text-gray-600">{STATUS_MESSAGES[statusIndex]}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAnalyze}
              className="c-btn c-btn-primary c-btn-md w-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze with AI
            </button>
          )}
        </div>
      )}

      {/* Step 3: Review Analysis Results */}
      {analysis && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-sm text-gray-900">
            Step 3: Review & Adjust
          </h3>

          {/* Alt Text */}
          <div>
            <label className="c-label block mb-1 text-xs">
              Alt Text
            </label>
            <textarea
              value={analysis.altText}
              onChange={(e) =>
                setAnalysis({ ...analysis, altText: e.target.value })
              }
              className="c-input text-xs"
              rows={2}
            />
          </div>

          {/* Caption */}
          <div>
            <label className="c-label block mb-1 text-xs">
              Caption
            </label>
            <textarea
              value={analysis.caption}
              onChange={(e) =>
                setAnalysis({ ...analysis, caption: e.target.value })
              }
              className="c-input text-xs"
              rows={2}
            />
          </div>

          {/* Topics */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">
              Suggested Topics <span className="text-gray-400 font-normal">(click to toggle)</span>
            </label>
            <div className="flex flex-wrap gap-1">
              {analysis.suggestedTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => {
                    // Toggle topic selection by removing it from the list
                    setAnalysis({
                      ...analysis,
                      suggestedTopics: analysis.suggestedTopics.filter(
                        (t) => t.id !== topic.id
                      ),
                    });
                  }}
                  className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-xs hover:bg-cyan-200 flex items-center gap-1 transition-colors"
                  title="Click to remove"
                >
                  {topic.name}
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {analysis.suggestedTopics.length === 0 && (
                <span className="text-xs text-gray-400 italic">No topics selected</span>
              )}
            </div>
          </div>

          {/* Regenerate with feedback */}
          <div className="border-t border-gray-200 pt-4">
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Refine suggestions
            </label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="E.g., Make the alt text shorter, use a more playful tone in the caption, focus on the product..."
              className="c-input text-sm"
              rows={2}
              disabled={isAnalyzing}
            />
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !userPrompt.trim()}
              className="c-btn c-btn-neutral c-btn-md w-full mt-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate with feedback
                </>
              )}
            </button>
          </div>

          {/* Select Image Components */}
          {imageComponents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Image Components
              </label>
              <div className="space-y-2">
                {imageComponents.map((comp) => (
                  <label
                    key={comp.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedComponents.includes(comp.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedComponents([
                            ...selectedComponents,
                            comp.id,
                          ]);
                        } else {
                          setSelectedComponents(
                            selectedComponents.filter((id) => id !== comp.id)
                          );
                        }
                      }}
                      className="w-4 h-4 border border-gray-300 rounded cursor-pointer accent-cyan-500"
                    />
                    <span className="text-xs text-gray-700">{comp.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Select Paragraph Collections */}
          {paragraphCollections.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Paragraph Collections
              </label>
              <div className="space-y-3">
                {paragraphCollections.map((pc) => (
                  <div key={pc.id} className="border border-gray-200 rounded p-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">{pc.name}</p>
                    <div className="space-y-1 pl-2">
                      {pc.paragraphs.map((paragraph, idx) => {
                        const isSelected = selectedParagraphs.some(
                          (sp) => sp.componentId === pc.id && sp.paragraphIndex === idx
                        );
                        const paragraphTitle = paragraph.title?.text || `Paragraph ${idx + 1}`;
                        return (
                          <label
                            key={idx}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedParagraphs([
                                    ...selectedParagraphs,
                                    {
                                      componentId: pc.id,
                                      componentName: pc.name,
                                      paragraphIndex: idx,
                                      paragraphTitle,
                                    },
                                  ]);
                                } else {
                                  setSelectedParagraphs(
                                    selectedParagraphs.filter(
                                      (sp) => !(sp.componentId === pc.id && sp.paragraphIndex === idx)
                                    )
                                  );
                                }
                              }}
                              className="w-4 h-4 border border-gray-300 rounded cursor-pointer accent-cyan-500"
                            />
                            <span className="text-xs text-gray-600">{paragraphTitle}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No targets available */}
          {imageComponents.length === 0 && paragraphCollections.length === 0 && (
            <p className="text-xs text-gray-500">
              No image components or paragraph collections available in this item
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setUploadedImage(null);
                setAnalysis(null);
                setSelectedComponents([]);
                setSelectedParagraphs([]);
              }}
              className="c-btn c-btn-neutral c-btn-md flex-1"
            >
              Reset
            </button>
            <button
              onClick={handleAssociateImage}
              disabled={
                isUploading || (selectedComponents.length === 0 && selectedParagraphs.length === 0)
              }
              className="c-btn c-btn-primary c-btn-md flex-1"
            >
              {isUploading ? "Uploading..." : "Upload & Associate"}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-green-700">Image uploaded and associated successfully!</p>
        </div>
      )}

      {/* Empty State */}
      {!uploadedImage && !analysis && !error && !success && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Start by uploading an image</p>
          <p className="text-xs mt-1">AI will suggest alt text, caption, and matching topics</p>
        </div>
      )}
    </div>
  );
}
