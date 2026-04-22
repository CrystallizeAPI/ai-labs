"use client";

import React from "react";

interface InlineNode {
  kind: "inline";
  type?: string;
  textContent?: string;
  children?: InlineNode[];
}

interface BlockNode {
  kind: "block";
  type: string;
  textContent?: string;
  children?: (BlockNode | InlineNode)[];
  metadata?: { language?: string };
}

type RichTextNode = BlockNode | InlineNode;

interface RichTextPreviewProps {
  json: RichTextNode[];
  className?: string;
}

function renderInline(node: InlineNode, index: number): React.ReactNode {
  const text = node.textContent || "";

  switch (node.type) {
    case "strong":
      return <strong key={index} className="font-semibold text-gray-900">{text}</strong>;
    case "emphasized":
      return <em key={index} className="italic">{text}</em>;
    case "underlined":
      return <span key={index} className="underline decoration-gray-300 underline-offset-2">{text}</span>;
    case "code":
      return (
        <code
          key={index}
          className="px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-[11px] font-mono text-gray-800"
        >
          {text}
        </code>
      );
    case "strikethrough":
      return <span key={index} className="line-through text-gray-400">{text}</span>;
    case "subscript":
      return <sub key={index}>{text}</sub>;
    case "superscript":
      return <sup key={index}>{text}</sup>;
    case "line-break":
      return <br key={index} />;
    default:
      return <span key={index}>{text}</span>;
  }
}

function renderChildren(children: (BlockNode | InlineNode)[] | undefined): React.ReactNode {
  if (!children) return null;
  return children.map((child, index) => {
    if (child.kind === "inline") {
      return renderInline(child as InlineNode, index);
    }
    return renderBlock(child as BlockNode, index);
  });
}

function renderBlock(node: BlockNode, index: number): React.ReactNode {
  const textContent = node.textContent;
  const hasChildren = node.children && node.children.length > 0;
  const inner = hasChildren ? renderChildren(node.children) : textContent;

  switch (node.type) {
    case "paragraph":
      return (
        <p key={index} className="leading-relaxed text-gray-700 [&:not(:last-child)]:mb-2">
          {inner}
        </p>
      );

    case "heading1":
      return <h1 key={index} className="text-base font-semibold text-gray-900 mt-1 mb-2">{inner}</h1>;
    case "heading2":
      return <h2 key={index} className="text-sm font-semibold text-gray-900 mt-1 mb-1.5">{inner}</h2>;
    case "heading3":
      return <h3 key={index} className="text-[13px] font-semibold text-gray-800 mt-1 mb-1.5">{inner}</h3>;

    case "unordered-list":
      return (
        <ul key={index} className="list-disc pl-4 text-gray-700 [&:not(:last-child)]:mb-2 marker:text-cyan-400 space-y-1">
          {renderChildren(node.children)}
        </ul>
      );

    case "ordered-list":
      return (
        <ol key={index} className="list-decimal pl-4 text-gray-700 [&:not(:last-child)]:mb-2 marker:text-cyan-500 space-y-1">
          {renderChildren(node.children)}
        </ol>
      );

    case "list-item":
      return (
        <li key={index} className="leading-relaxed pl-0.5">
          {inner}
        </li>
      );

    case "preformatted":
    case "code":
      return (
        <pre
          key={index}
          className="p-2 bg-gray-50 border border-gray-200 rounded text-[11px] font-mono text-gray-800 overflow-x-auto [&:not(:last-child)]:mb-2"
        >
          <code>{inner}</code>
        </pre>
      );

    case "quote":
    case "blockquote":
      return (
        <blockquote
          key={index}
          className="border-l-2 border-cyan-300 pl-3 italic text-gray-600 [&:not(:last-child)]:mb-2"
        >
          {inner}
        </blockquote>
      );

    case "hr":
    case "divider":
      return <hr key={index} className="border-gray-100 my-3" />;

    default:
      return (
        <div key={index} className="[&:not(:last-child)]:mb-2">
          {inner}
        </div>
      );
  }
}

export function RichTextPreview({ json, className = "" }: RichTextPreviewProps) {
  if (!json || !Array.isArray(json) || json.length === 0) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <div className={`text-[12px] leading-relaxed text-gray-700 ${className}`}>
      {json.map((node, index) => renderBlock(node as BlockNode, index))}
    </div>
  );
}

/**
 * Extract plain text from rich text JSON for simple previews
 */
export function getPlainTextFromRichText(json: RichTextNode[]): string {
  if (!json || !Array.isArray(json)) return "";
  
  const extractText = (nodes: RichTextNode[]): string => {
    return nodes.map(node => {
      if (node.textContent) return node.textContent;
      if ('children' in node && node.children) {
        return extractText(node.children as RichTextNode[]);
      }
      return "";
    }).join(" ");
  };
  
  return extractText(json).trim();
}
