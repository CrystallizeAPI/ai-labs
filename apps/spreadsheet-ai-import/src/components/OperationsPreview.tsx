import { MassOperationsFile } from '../types';

interface OperationsPreviewProps {
  operations: MassOperationsFile;
  onDownload: () => void;
}

export function OperationsPreview({ operations, onDownload }: OperationsPreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Generated Operations</h2>
        <button
          onClick={onDownload}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download JSON
        </button>
      </div>
      <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto max-h-96">
        <pre className="text-sm">
          {JSON.stringify(operations, null, 2)}
        </pre>
      </div>
      <p className="text-sm text-gray-500">
        {operations.operations.length} operation(s) generated
      </p>
    </div>
  );
}
