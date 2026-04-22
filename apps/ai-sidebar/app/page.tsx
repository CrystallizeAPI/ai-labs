import { Suspense } from "react";
import { SidebarApp } from "@/components/SidebarApp";

interface PageProps {
  searchParams: Promise<{
    itemId?: string;
    language?: string;
    fromLanguage?: string;
    variantId?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const { itemId, language, fromLanguage, variantId } = params;
  
  // Crystallize sends "fromLanguage", fallback to "language" or "en"
  const itemLanguage = fromLanguage || language || "en";

  if (!itemId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8">
          <h1 className="text-xl font-semibold text-gray-200 mb-2">
            No Item Selected
          </h1>
          <p className="text-gray-400 text-sm">
            Open this sidebar from an item in Crystallize to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SidebarApp itemId={itemId} language={itemLanguage} variantId={variantId} />
    </Suspense>
  );
}
