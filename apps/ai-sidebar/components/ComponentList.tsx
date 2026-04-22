"use client";

import type { ItemComponent, ShapeComponent } from "@/lib/types";
import { flattenEditableComponents, truncate, getComponentPreview } from "@/lib/utils";

interface ComponentListProps {
  components: ItemComponent[];
  shapeComponents: ShapeComponent[];
  selectedComponents: string[];
  onSelectionChange: (componentIds: string[]) => void;
}

export function ComponentList({
  components,
  shapeComponents,
  selectedComponents,
  onSelectionChange,
}: ComponentListProps) {
  const leaves = flattenEditableComponents(components, shapeComponents);

  const toggleComponent = (path: string) => {
    if (selectedComponents.includes(path)) {
      onSelectionChange(selectedComponents.filter((id) => id !== path));
    } else {
      onSelectionChange([...selectedComponents, path]);
    }
  };

  if (leaves.length === 0) {
    return (
      <section className="rounded-xl bg-white border border-gray-100 px-4 py-6 text-center">
        <p className="text-gray-500 text-sm">No editable components found</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white border border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.02)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <svg className="w-3.5 h-3.5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-[11px] font-medium text-gray-500">Components</span>
        <span className="ml-auto text-[11px] text-gray-400">
          {leaves.length} editable
        </span>
      </header>

      <div className="divide-y divide-gray-100">
        {leaves.map((leaf) => {
          const isSelected = selectedComponents.includes(leaf.path);
          const preview = getComponentPreview(leaf.content);

          return (
            <div
              key={leaf.path}
              onClick={() => toggleComponent(leaf.path)}
              className={`px-3 py-3 cursor-pointer transition-colors ${
                isSelected ? "bg-cyan-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-cyan-500 border-cyan-500"
                      : "border-gray-300 hover:border-cyan-400"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {leaf.parentLabel && (
                      <>
                        <span className="text-[11px] text-gray-400">
                          {leaf.parentLabel}
                        </span>
                        <span className="text-[11px] text-gray-300">/</span>
                      </>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {leaf.label}
                    </span>
                    <span className="c-tag">{leaf.type}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {truncate(preview, 120)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
