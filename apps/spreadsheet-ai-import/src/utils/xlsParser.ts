import * as XLSX from 'xlsx';
import { XLSRowData, XLS_COLUMN_MAPPING } from '../types';

export function parseXLSFile(file: File): Promise<XLSRowData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
          defval: '', // Default empty string for missing values
        });

        console.log('Sheet name:', sheetName);
        console.log('Raw rows count:', jsonData.length);
        if (jsonData.length > 0) {
          console.log('Column headers found:', Object.keys(jsonData[0]));
          console.log('Expected mappings:', Object.keys(XLS_COLUMN_MAPPING));
          console.log('First raw row:', jsonData[0]);
        }

        // Map the columns to our data structure
        const rows: XLSRowData[] = jsonData.map((row) => {
          const mappedRow: Partial<XLSRowData> = {};
          
          // Initialize all fields with empty strings
          Object.values(XLS_COLUMN_MAPPING).forEach((field) => {
            mappedRow[field] = '';
          });

          // Map each column from the XLS to our structure
          Object.entries(row).forEach(([columnName, value]) => {
            const fieldName = XLS_COLUMN_MAPPING[columnName.trim()];
            if (fieldName) {
              mappedRow[fieldName] = String(value || '').trim();
            }
          });

          return mappedRow as XLSRowData;
        });

        console.log('Mapped rows count:', rows.length);
        if (rows.length > 0) {
          console.log('First mapped row:', rows[0]);
        }

        resolve(rows);
      } catch (error) {
        console.error('XLS parsing error:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
