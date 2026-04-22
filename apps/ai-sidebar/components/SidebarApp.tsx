"use client";

import { useState, useEffect } from "react";
import { signal } from "@crystallize/app-signal";
import { ItemContext } from "./ItemContext";
import { AIPrompt } from "./AIPrompt";
import { UpdatePreview } from "./UpdatePreview";
import { ImageUpload } from "./ImageUpload";
import type { ItemDetails, ComponentUpdate } from "@/lib/types";
import { debounce } from "@/lib/utils";
import type { LanguageOption } from "@/lib/languages";

type TabType = "content" | "images";

interface SidebarAppProps {
  itemId: string;
  language: string;
  variantId?: string;
}

const debouncedRefresh = debounce(
  (payload: { itemId: string; itemLanguage: string }) => {
    signal.send("refetchItemComponents", payload);
  },
  600
);

export function SidebarApp({ itemId, language, variantId }: SidebarAppProps) {
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const [tab, setTab] = useState<TabType>("content");
  const [item, setItem] = useState<ItemDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<ComponentUpdate[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [applyLanguage, setApplyLanguage] = useState(language);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setApplyLanguage(language);
  }, [language]);

  // Fetch available languages from Crystallize tenant
  useEffect(() => {
    async function fetchLanguages() {
      try {
        const res = await fetch("/api/languages");
        if (res.ok) {
          const data = await res.json();
          setLanguageOptions(data.languages);
        }
      } catch (err) {
        console.error("Failed to fetch languages:", err);
      }
    }
    fetchLanguages();
  }, []);

  // Fetch item details
  useEffect(() => {
    async function fetchItem() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          itemId,
          language,
          ...(variantId && { variantId }),
        });
        const res = await fetch(`/api/item?${params}`);
        if (!res.ok) throw new Error("Failed to fetch item");
        const data = await res.json();
        setItem(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load item");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [itemId, language, variantId]);

  // Handle AI-generated updates
  const handleUpdatesGenerated = (updates: ComponentUpdate[]) => {
    setPendingUpdates(updates);
  };

  // Apply a single update
  const applyUpdate = async (update: ComponentUpdate) => {
    setIsApplying(true);
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          language: applyLanguage,
          variantId,
          componentId: update.componentId,
          type: update.type,
          content: update.content,
        }),
      });

      if (!res.ok) throw new Error("Failed to apply update");

      // Signal Crystallize to refresh
      debouncedRefresh({ itemId, itemLanguage: applyLanguage });

      // Remove from pending updates
      setPendingUpdates((prev) =>
        prev.filter((u) => u.componentId !== update.componentId)
      );

      // Refresh our item data
      const params = new URLSearchParams({ itemId, language });
      const itemRes = await fetch(`/api/item?${params}`);
      if (itemRes.ok) {
        const data = await itemRes.json();
        setItem(data);
      }
    } catch (err) {
      console.error("Failed to apply update:", err);
    } finally {
      setIsApplying(false);
    }
  };

  // Reject an update
  const rejectUpdate = (componentId: string) => {
    setPendingUpdates((prev) =>
      prev.filter((u) => u.componentId !== componentId)
    );
  };

  // Apply all pending updates
  const applyAllUpdates = async () => {
    for (const update of pendingUpdates) {
      await applyUpdate(update);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading item...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8">
          <p className="text-pink-600 text-sm">{error || "Item not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header — compact: title + tabs on one row */}
      <header className="px-3 pt-2 pb-0 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3 border-b border-gray-100">
          <div className="flex items-center gap-1.5 py-1.5 pr-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-cyan-100 text-cyan-700">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </span>
            <h1 className="text-xs font-semibold text-gray-700 tracking-tight whitespace-nowrap">AI Assistant</h1>
          </div>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setTab("content")}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === "content"
                  ? "border-cyan-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              Content
            </button>
            <button
              onClick={() => setTab("images")}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === "images"
                  ? "border-cyan-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              Images
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 pb-24 space-y-3">
        {tab === "content" ? (
          <>
            <ItemContext item={item} language={language} />

            <AIPrompt
              item={item}
              language={language}
              languageOptions={languageOptions}
              selectedComponents={selectedComponents}
              onSelectionChange={setSelectedComponents}
              onUpdatesGenerated={handleUpdatesGenerated}
            />

            {pendingUpdates.length > 0 && (
              <UpdatePreview
                updates={pendingUpdates}
                item={item}
                applyLanguage={applyLanguage}
                onApplyLanguageChange={setApplyLanguage}
                languageOptions={languageOptions}
                onApply={applyUpdate}
                onApplyAll={applyAllUpdates}
                onReject={rejectUpdate}
                isApplying={isApplying}
              />
            )}
          </>
        ) : (
          <>
            <ItemContext item={item} language={language} />
            <ImageUpload item={item} language={language} />
          </>
        )}
      </div>
    </div>
  );
}
