import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export function FileDropZone({ onFileSelect, isLoading }: FileDropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <svg
          className="w-16 h-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {isLoading ? (
          <p className="text-lg text-gray-600">Processing file...</p>
        ) : isDragActive ? (
          <p className="text-lg text-blue-600">Drop the file here...</p>
        ) : (
          <>
            <p className="text-lg text-gray-600">
              Drag & drop an XLS/XLSX file here, or click to select
            </p>
            <p className="text-sm text-gray-400">
              Supports .xls and .xlsx files
            </p>
          </>
        )}
      </div>
    </div>
  );
}
