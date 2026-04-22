"use client";

import { useEffect, useState } from "react";
import type { ItemDetails, ComponentUpdate } from "@/lib/types";
import type { LanguageOption } from "@/lib/languages";
import { flattenEditableComponents } from "@/lib/utils";


interface AIPromptProps {
  item: ItemDetails;
  language: string;
  languageOptions: LanguageOption[];
  selectedComponents: string[];
  onSelectionChange: (componentIds: string[]) => void;
  onUpdatesGenerated: (updates: ComponentUpdate[]) => void;
}

const PROMPT_SUGGESTIONS = [
  "Make the description more compelling",
  "Add bullet points highlighting key features",
  "Make it more SEO-friendly",
  "Summarize in 2 sentences",
  "Make it sound more premium",
];

export function AIPrompt({
  item,
  language,
  languageOptions,
  selectedComponents,
  onSelectionChange,
  onUpdatesGenerated,
}: AIPromptProps) {
  const [prompt, setPrompt] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState(language);
  const [targetLanguage, setTargetLanguage] = useState(language);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    setSourceLanguage(language);
    setTargetLanguage(language);
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setExplanation(null);
    setStatus("Analyzing your content...");

    try {
      // Simulate progress messages
      const statusMessages = [
        "Analyzing your content...",
        "Understanding your request...",
        "Generating improvements...",
        "Crafting the perfect update...",
      ];
      
      let messageIndex = 0;
      const statusInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % statusMessages.length;
        setStatus(statusMessages[messageIndex]);
      }, 2000);

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          prompt: prompt.trim(),
          sourceLanguage,
          targetLanguage,
          targetComponents:
            selectedComponents.length > 0 ? selectedComponents : undefined,
        }),
      });

      clearInterval(statusInterval);
      setStatus("Processing response...");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setStatus(null);
      onUpdatesGenerated(data.updates);
      setExplanation(data.explanation);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  const leaves = flattenEditableComponents(
    item.components as unknown as Array<{
      componentId: string;
      type: string;
      name?: string;
      content?: Record<string, unknown>;
    }>,
    item.shape.components
  );
  const toggleLeaf = (path: string) => {
    if (selectedComponents.includes(path)) {
      onSelectionChange(selectedComponents.filter((p) => p !== path));
    } else {
      onSelectionChange([...selectedComponents, path]);
    }
  };
  const isAll = selectedComponents.length === 0;

  return (
    <section className="rounded-xl bg-white border border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.02)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <svg className="w-3.5 h-3.5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-[11px] font-medium text-gray-500">AI Prompt</span>
      </header>
      <div className="px-3 py-3">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="text-xs text-gray-500 font-medium">
              From
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="c-input mt-1 py-1.5 text-xs"
                disabled={isGenerating}
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name} ({option.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500 font-medium">
              To
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="c-input mt-1 py-1.5 text-xs"
                disabled={isGenerating}
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name} ({option.code})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Component selection — choose what to work on */}
          {leaves.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 font-medium">Components</span>
                {!isAll && (
                  <button
                    type="button"
                    onClick={() => onSelectionChange([])}
                    className="text-[11px] text-cyan-600 hover:text-cyan-700 font-medium"
                    disabled={isGenerating}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectionChange([])}
                  disabled={isGenerating}
                  className={`c-tag transition-colors ${
                    isAll
                      ? "!bg-cyan-100 !border-cyan-300 !text-cyan-800"
                      : "hover:bg-gray-50"
                  }`}
                >
                  All
                </button>
                {leaves.map((leaf) => {
                  const selected = selectedComponents.includes(leaf.path);
                  const label = leaf.parentLabel
                    ? `${leaf.parentLabel} / ${leaf.label}`
                    : leaf.label;
                  return (
                    <button
                      key={leaf.path}
                      type="button"
                      onClick={() => toggleLeaf(leaf.path)}
                      disabled={isGenerating}
                      className={`c-tag transition-colors ${
                        selected
                          ? "!bg-cyan-100 !border-cyan-300 !text-cyan-800"
                          : "hover:bg-gray-50"
                      }`}
                      title={leaf.type}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to change..."
            className="c-input resize-none"
            rows={3}
            disabled={isGenerating}
          />
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="c-tag hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 transition-colors cursor-pointer"
              disabled={isGenerating}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Submit button — Crystallize primary */}
        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className="c-btn c-btn-primary c-btn-md mt-3 w-full"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-700/30 border-t-gray-700 rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Updates"
          )}
        </button>

        {/* Status indicator */}
        {isGenerating && status && (
          <div className="mt-3 p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-cyan-700 font-medium">{status}</span>
            </div>
          </div>
        )}
      </form>

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-700 text-xs">
          {explanation}
        </div>
      )}
      </div>
    </section>
  );
}
