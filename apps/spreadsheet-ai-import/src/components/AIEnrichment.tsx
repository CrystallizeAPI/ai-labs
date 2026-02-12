import { useState, useCallback } from 'react';
import { ValidatedRow } from '../types';
import { enrichProductsBatch, EnrichmentResult, isOpenAIConfigured } from '../api/openai';

interface AIEnrichmentProps {
  rows: ValidatedRow[];
  onEnrichmentComplete: (enrichedRows: ValidatedRow[]) => void;
  onSkip: () => void;
}

interface EnrichmentPreview {
  sku: string;
  productName: string;
  original: {
    shortDescription: string;
    seoTitle: string;
    seoDescription: string;
  };
  suggested: EnrichmentResult;
  accepted: {
    shortDescription: boolean;
    seoTitle: boolean;
    seoDescription: boolean;
  };
}

export function AIEnrichment({ rows, onEnrichmentComplete, onSkip }: AIEnrichmentProps) {
  const [status, setStatus] = useState<'idle' | 'enriching' | 'reviewing' | 'applying'>('idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [previews, setPreviews] = useState<EnrichmentPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => {
    // Pre-select rows that are missing any of the enrichable fields
    const needsEnrichment = new Set<string>();
    rows.forEach(row => {
      if (!row.data.shortDescription || !row.data.seoTitle || !row.data.seoDescription) {
        needsEnrichment.add(row.data.sku);
      }
    });
    return needsEnrichment;
  });

  const isConfigured = isOpenAIConfigured();

  const handleStartEnrichment = useCallback(async () => {
    if (selectedRows.size === 0) {
      setError('Please select at least one row to enrich');
      return;
    }

    setStatus('enriching');
    setError(null);
    
    const rowsToEnrich = rows.filter(r => selectedRows.has(r.data.sku));
    setProgress({ completed: 0, total: rowsToEnrich.length });

    try {
      const results = await enrichProductsBatch(
        rowsToEnrich.map(r => ({
          sku: r.data.sku,
          productName: r.data.productName,
          description: r.data.description,
          brand: r.data.brand,
          color: r.data.color,
          material: r.data.material,
          currentShortDescription: r.data.shortDescription,
          currentSeoTitle: r.data.seoTitle,
          currentSeoDescription: r.data.seoDescription,
        })),
        customPrompt,
        (completed, total) => setProgress({ completed, total })
      );

      // Build previews from results
      const newPreviews: EnrichmentPreview[] = [];
      rowsToEnrich.forEach(row => {
        const suggested = results.get(row.data.sku);
        if (suggested) {
          newPreviews.push({
            sku: row.data.sku,
            productName: row.data.productName,
            original: {
              shortDescription: row.data.shortDescription || '',
              seoTitle: row.data.seoTitle || '',
              seoDescription: row.data.seoDescription || '',
            },
            suggested,
            accepted: {
              shortDescription: !row.data.shortDescription || row.data.shortDescription.trim() === '',
              seoTitle: !row.data.seoTitle || row.data.seoTitle.trim() === '',
              seoDescription: !row.data.seoDescription || row.data.seoDescription.trim() === '',
            },
          });
        }
      });

      setPreviews(newPreviews);
      setStatus('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich products');
      setStatus('idle');
    }
  }, [rows, selectedRows]);

  const handleToggleAccept = useCallback((sku: string, field: keyof EnrichmentPreview['accepted']) => {
    setPreviews(prev => prev.map(p => {
      if (p.sku === sku) {
        return {
          ...p,
          accepted: {
            ...p.accepted,
            [field]: !p.accepted[field],
          },
        };
      }
      return p;
    }));
  }, []);

  const handleUpdateSuggested = useCallback((sku: string, field: keyof EnrichmentResult, value: string) => {
    setPreviews(prev => prev.map(p => {
      if (p.sku === sku) {
        return {
          ...p,
          suggested: {
            ...p.suggested,
            [field]: value,
          },
        };
      }
      return p;
    }));
  }, []);

  const handleApplyEnrichments = useCallback(() => {
    setStatus('applying');
    
    // Create a map of accepted enrichments
    const enrichments = new Map<string, Partial<EnrichmentResult>>();
    previews.forEach(preview => {
      const accepted: Partial<EnrichmentResult> = {};
      if (preview.accepted.shortDescription) {
        accepted.shortDescription = preview.suggested.shortDescription;
      }
      if (preview.accepted.seoTitle) {
        accepted.seoTitle = preview.suggested.seoTitle;
      }
      if (preview.accepted.seoDescription) {
        accepted.seoDescription = preview.suggested.seoDescription;
      }
      if (Object.keys(accepted).length > 0) {
        enrichments.set(preview.sku, accepted);
      }
    });

    // Apply enrichments to rows
    const enrichedRows = rows.map(row => {
      const enrichment = enrichments.get(row.data.sku);
      if (enrichment) {
        return {
          ...row,
          data: {
            ...row.data,
            ...(enrichment.shortDescription && { shortDescription: enrichment.shortDescription }),
            ...(enrichment.seoTitle && { seoTitle: enrichment.seoTitle }),
            ...(enrichment.seoDescription && { seoDescription: enrichment.seoDescription }),
          },
        };
      }
      return row;
    });

    onEnrichmentComplete(enrichedRows);
  }, [previews, rows, onEnrichmentComplete]);

  const handleToggleRowSelection = useCallback((sku: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRows(new Set(rows.map(r => r.data.sku)));
  }, [rows]);

  const handleSelectNone = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  if (!isConfigured) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">AI Enrichment</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-yellow-800">
            <strong>OpenAI API key not configured.</strong>
          </p>
          <p className="text-yellow-700 text-sm mt-2">
            To enable AI enrichment, add your OpenAI API key to a <code className="bg-yellow-100 px-1 rounded">.env</code> file:
          </p>
          <pre className="bg-yellow-100 p-2 rounded mt-2 text-sm">
            VITE_OPENAI_API_KEY=your-api-key-here
          </pre>
        </div>
        <button
          onClick={onSkip}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Skip AI Enrichment
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">AI Enrichment</h2>
      <p className="text-gray-600 mb-4">
        Use AI to generate or improve Short Description, SEO Title, and SEO Description for your products.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {status === 'idle' && (
        <>
          {/* Custom prompt input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Context (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add any additional context to guide the AI, e.g., 'These are vintage guitars from the 1970s' or 'Target audience is professional musicians' or 'Use a playful, casual tone'"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              rows={6}
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Select rows to enrich ({selectedRows.size} of {rows.length} selected)
              </span>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === rows.length}
                        onChange={() => selectedRows.size === rows.length ? handleSelectNone() : handleSelectAll()}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Product Name</th>
                    <th className="px-3 py-2 text-left">Has Short Desc</th>
                    <th className="px-3 py-2 text-left">Has SEO Title</th>
                    <th className="px-3 py-2 text-left">Has SEO Desc</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(row => (
                    <tr 
                      key={row.data.sku}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedRows.has(row.data.sku) ? 'bg-blue-50' : ''}`}
                      onClick={() => handleToggleRowSelection(row.data.sku)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.data.sku)}
                          onChange={() => handleToggleRowSelection(row.data.sku)}
                          onClick={e => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.data.sku}</td>
                      <td className="px-3 py-2">{row.data.productName}</td>
                      <td className="px-3 py-2">
                        {row.data.shortDescription ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.data.seoTitle ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.data.seoDescription ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStartEnrichment}
              disabled={selectedRows.size === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Enrich with AI ({selectedRows.size} rows)
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Skip
            </button>
          </div>
        </>
      )}

      {status === 'enriching' && (
        <div className="text-center py-8">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">
            Enriching products with AI... {progress.completed} of {progress.total}
          </p>
          <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto mt-4">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {status === 'reviewing' && (
        <>
          <p className="text-gray-600 mb-4">
            Review the AI suggestions below. Check the boxes for suggestions you want to accept.
          </p>
          <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
            {previews.map(preview => (
              <div key={preview.sku} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{preview.sku}</span>
                  <span className="font-medium">{preview.productName}</span>
                </div>
                
                <div className="space-y-3">
                  {/* Short Description */}
                  <div className="bg-gray-50 p-3 rounded">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={preview.accepted.shortDescription}
                        onChange={() => handleToggleAccept(preview.sku, 'shortDescription')}
                        className="mt-1 rounded"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm block mb-1">Short Description</span>
                        {preview.original.shortDescription && (
                          <p className="text-xs text-gray-500 mb-1">
                            <span className="font-medium">Current:</span> {preview.original.shortDescription}
                          </p>
                        )}
                        <textarea
                          value={preview.suggested.shortDescription}
                          onChange={(e) => handleUpdateSuggested(preview.sku, 'shortDescription', e.target.value)}
                          className="w-full text-sm text-purple-700 bg-purple-50 p-2 rounded border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
                          rows={2}
                        />
                      </div>
                    </label>
                  </div>

                  {/* SEO Title */}
                  <div className="bg-gray-50 p-3 rounded">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={preview.accepted.seoTitle}
                        onChange={() => handleToggleAccept(preview.sku, 'seoTitle')}
                        className="mt-1 rounded"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm block mb-1">SEO Title</span>
                        {preview.original.seoTitle && (
                          <p className="text-xs text-gray-500 mb-1">
                            <span className="font-medium">Current:</span> {preview.original.seoTitle}
                          </p>
                        )}
                        <div className="relative">
                          <input
                            type="text"
                            value={preview.suggested.seoTitle}
                            onChange={(e) => handleUpdateSuggested(preview.sku, 'seoTitle', e.target.value)}
                            className="w-full text-sm text-purple-700 bg-purple-50 p-2 rounded border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 pr-20"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                            {preview.suggested.seoTitle.length}/60
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* SEO Description */}
                  <div className="bg-gray-50 p-3 rounded">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={preview.accepted.seoDescription}
                        onChange={() => handleToggleAccept(preview.sku, 'seoDescription')}
                        className="mt-1 rounded"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm block mb-1">SEO Description</span>
                        {preview.original.seoDescription && (
                          <p className="text-xs text-gray-500 mb-1">
                            <span className="font-medium">Current:</span> {preview.original.seoDescription}
                          </p>
                        )}
                        <div className="relative">
                          <textarea
                            value={preview.suggested.seoDescription}
                            onChange={(e) => handleUpdateSuggested(preview.sku, 'seoDescription', e.target.value)}
                            className="w-full text-sm text-purple-700 bg-purple-50 p-2 rounded border border-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y pr-20"
                            rows={2}
                          />
                          <span className="absolute right-2 bottom-2 text-xs text-gray-500">
                            {preview.suggested.seoDescription.length}/155
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleApplyEnrichments}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Apply Selected Suggestions
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Discard & Continue
            </button>
          </div>
        </>
      )}

      {status === 'applying' && (
        <div className="text-center py-8">
          <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Applying enrichments...</p>
        </div>
      )}
    </div>
  );
}
