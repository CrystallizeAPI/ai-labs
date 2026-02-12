import { useState, useCallback } from 'react';
import { FileDropZone, ValidationGrid, OperationsPreview, AIEnrichment } from './components';
import { parseXLSFile } from './utils/xlsParser';
import { validateAllRows } from './utils/validation';
import { generateMassOperations, downloadOperationsFile } from './utils/operationsGenerator';
import { fetchAllReferenceData, runMassOperations, BulkTaskStatus } from './api/crystallize';
import {
  XLSRowData,
  ValidatedRow,
  CrystallizeReferenceData,
  MassOperationsFile,
} from './types';

type AppState = 'upload' | 'validating' | 'validated' | 'enriching' | 'generated' | 'running' | 'completed';

function App() {
  const [state, setState] = useState<AppState>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setRawData] = useState<XLSRowData[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [referenceData, setReferenceData] = useState<CrystallizeReferenceData | null>(null);
  const [operations, setOperations] = useState<MassOperationsFile | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [selectedRows, setSelectedRows] = useState<ValidatedRow[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<BulkTaskStatus | null>(null);

  const handleSelectionChange = useCallback((rows: ValidatedRow[]) => {
    setSelectedRows(rows);
  }, []);

  const handleProceedToEnrichment = useCallback(() => {
    setState('enriching');
  }, []);

  const handleEnrichmentComplete = useCallback((enrichedRows: ValidatedRow[]) => {
    setValidatedRows(enrichedRows);
    // After enrichment, proceed to generate operations
    if (!referenceData) return;
    const rowsToProcess = selectedRows.length > 0 ? 
      enrichedRows.filter(r => selectedRows.some(sr => sr.data.sku === r.data.sku)) : 
      enrichedRows;
    const ops = generateMassOperations(rowsToProcess, referenceData, skipInvalid);
    setOperations(ops);
    setState('generated');
  }, [referenceData, selectedRows, skipInvalid]);

  const handleSkipEnrichment = useCallback(() => {
    // Skip enrichment and generate operations directly
    if (!referenceData) return;
    const rowsToProcess = selectedRows.length > 0 ? selectedRows : validatedRows;
    const ops = generateMassOperations(rowsToProcess, referenceData, skipInvalid);
    setOperations(ops);
    setState('generated');
  }, [validatedRows, selectedRows, referenceData, skipInvalid]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setState('validating');

    try {
      // Parse XLS file
      const data = await parseXLSFile(file);
      console.log('Parsed data:', data.length, 'rows');
      setRawData(data);

      // Fetch reference data from Crystallize (or use empty data if API not configured)
      let refData: CrystallizeReferenceData;
      try {
        refData = await fetchAllReferenceData();
        console.log('Reference data loaded:', refData);
      } catch (apiError) {
        console.warn('Crystallize API not configured or failed, using empty reference data:', apiError);
        refData = { brands: [], folders: [] };
      }
      setReferenceData(refData);

      // Validate all rows (including async SKU validation against Crystallize)
      const validated = await validateAllRows(data, refData);
      console.log('Validated rows:', validated.length, 'valid:', validated.filter(r => r.isValid).length);
      setValidatedRows(validated);
      setState('validated');
    } catch (err) {
      console.error('File processing error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setState('upload');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGenerateOperations = useCallback(() => {
    // Now this just proceeds to enrichment step instead of generating directly
    handleProceedToEnrichment();
  }, [handleProceedToEnrichment]);

  const handleDownload = useCallback(() => {
    if (operations) {
      downloadOperationsFile(operations);
    }
  }, [operations]);

  const handleRunOperations = useCallback(async () => {
    if (!operations) return;
    
    setIsRunning(true);
    setRunStatus(null);
    setState('running');
    setError(null);
    
    try {
      const operationsJson = JSON.stringify(operations, null, 2);
      
      const finalStatus = await runMassOperations(operationsJson, (status) => {
        setRunStatus(status);
      });
      
      setRunStatus(finalStatus);
      setState('completed');
      
      if (finalStatus.status === 'error') {
        setError('Some operations failed. Check the Crystallize dashboard for details.');
      }
    } catch (err) {
      console.error('Failed to run operations:', err);
      setError(err instanceof Error ? err.message : 'Failed to run operations');
      setState('generated');
    } finally {
      setIsRunning(false);
    }
  }, [operations]);

  const handleReset = useCallback(() => {
    setState('upload');
    setRawData([]);
    setValidatedRows([]);
    setOperations(null);
    setError(null);
    setSkipInvalid(false);
    setSelectedRows([]);
    setRunStatus(null);
  }, []);

  const hasInvalidRows = validatedRows.some((r) => !r.isValid);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Instrument Import</h1>
          <p className="text-gray-600 mt-2">
            Upload an XLS file to import instruments into Crystallize
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Step number={1} label="Upload" active={state === 'upload'} completed={state !== 'upload'} />
            <Connector completed={state !== 'upload'} />
            <Step number={2} label="Validate" active={state === 'validating' || state === 'validated'} completed={state === 'enriching' || state === 'generated' || state === 'running' || state === 'completed'} />
            <Connector completed={state === 'enriching' || state === 'generated' || state === 'running' || state === 'completed'} />
            <Step number={3} label="Enrich" active={state === 'enriching'} completed={state === 'generated' || state === 'running' || state === 'completed'} />
            <Connector completed={state === 'generated' || state === 'running' || state === 'completed'} />
            <Step number={4} label="Generate" active={state === 'generated'} completed={state === 'running' || state === 'completed'} />
            <Connector completed={state === 'running' || state === 'completed'} />
            <Step number={5} label="Run" active={state === 'running'} completed={state === 'completed'} />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Main content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {state === 'upload' && (
            <FileDropZone onFileSelect={handleFileSelect} isLoading={isLoading} />
          )}

          {(state === 'validating' || state === 'validated') && (
            <>
              <ValidationGrid rows={validatedRows} onSelectionChange={handleSelectionChange} />
              
              <div className="mt-6 flex items-center justify-between border-t pt-6">
                <div className="flex items-center gap-4">
                  {hasInvalidRows && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipInvalid}
                        onChange={(e) => setSkipInvalid(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Skip invalid rows</span>
                    </label>
                  )}
                  {selectedRows.length > 0 && (
                    <span className="text-sm text-blue-600 font-medium">
                      {selectedRows.length} row{selectedRows.length !== 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={handleGenerateOperations}
                    disabled={hasInvalidRows && !skipInvalid && selectedRows.length === 0}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      hasInvalidRows && !skipInvalid && selectedRows.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {selectedRows.length > 0 
                      ? `Continue with Selection (${selectedRows.length})`
                      : 'Continue to Enrichment'}
                  </button>
                </div>
              </div>
            </>
          )}

          {state === 'enriching' && (
            <AIEnrichment 
              rows={selectedRows.length > 0 ? selectedRows : validatedRows.filter(r => skipInvalid ? r.isValid : true)}
              onEnrichmentComplete={handleEnrichmentComplete}
              onSkip={handleSkipEnrichment}
            />
          )}

          {(state === 'generated' || state === 'running' || state === 'completed') && operations && (
            <>
              <OperationsPreview operations={operations} onDownload={handleDownload} />
              
              {/* Run status */}
              {runStatus && (
                <div className={`mt-4 p-4 rounded-lg ${
                  runStatus.status === 'complete' ? 'bg-green-50 border border-green-200' :
                  runStatus.status === 'error' ? 'bg-red-50 border border-red-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {(runStatus.status === 'pending' || runStatus.status === 'started') && (
                        <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                      )}
                      {runStatus.status === 'complete' && (
                        <span className="text-green-600 text-xl">✓</span>
                      )}
                      {runStatus.status === 'error' && (
                        <span className="text-red-600 text-xl">✗</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {runStatus.status === 'pending' && 'Preparing operations...'}
                        {runStatus.status === 'started' && 'Running operations...'}
                        {runStatus.status === 'complete' && 'Operations completed successfully!'}
                        {runStatus.status === 'error' && 'Operations failed'}
                      </p>
                      {runStatus.progress && (
                        <p className="text-sm text-gray-600">
                          Progress: {runStatus.progress.finished} / {runStatus.progress.total} operations
                        </p>
                      )}
                      {/* Error details from bulk task info */}
                      {runStatus.status === 'error' && runStatus.info?.error && (
                        <div className="mt-3 p-3 bg-red-100 rounded text-sm">
                          <p className="font-medium text-red-800">
                            {runStatus.info.errorName || 'Error'}: {runStatus.info.error}
                          </p>
                          {runStatus.info.stack && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-red-700 hover:text-red-900">
                                Show stack trace
                              </summary>
                              <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap overflow-x-auto">
                                {runStatus.info.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Task ID: {runStatus.id}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-between border-t pt-6">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Start Over
                </button>
                
                {state === 'generated' && (
                  <button
                    onClick={handleRunOperations}
                    disabled={isRunning}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      isRunning
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isRunning ? 'Running...' : 'Run Operations in Crystallize'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Step indicator component
function Step({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          completed
            ? 'bg-green-500 text-white'
            : active
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {completed ? '✓' : number}
      </div>
      <span className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

// Connector line between steps
function Connector({ completed }: { completed: boolean }) {
  return (
    <div className={`flex-1 h-0.5 ${completed ? 'bg-green-500' : 'bg-gray-200'}`} />
  );
}

export default App;
