import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import DataEditor, {
  GridColumn,
  GridCell,
  GridCellKind,
  Item,
  Theme,
  GridMouseEventArgs,
  GridSelection,
  CompactSelection,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { ValidatedRow, XLSRowData } from '../types';

interface ValidationGridProps {
  rows: ValidatedRow[];
  onSelectionChange?: (selectedRows: ValidatedRow[]) => void;
}

type FilterType = 'all' | 'valid' | 'invalid';

// Column definitions matching XLS structure for Instrument import
// Note: 'image' field is used twice - once for preview, once for URL text
const INITIAL_COLUMNS: { key: keyof XLSRowData | 'imagePreview'; title: string; width: number }[] = [
  { key: 'sku', title: 'SKU', width: 100 },
  { key: 'productName', title: 'Product Name', width: 200 },
  { key: 'price', title: 'Price', width: 80 },
  { key: 'imagePreview', title: 'Image Preview', width: 80 },
  { key: 'image', title: 'Image URL', width: 200 },
  { key: 'shortDescription', title: 'Short Description', width: 180 },
  { key: 'description', title: 'Description', width: 250 },
  { key: 'relatedItems', title: 'Related Items', width: 120 },
  { key: 'brand', title: 'Brand', width: 100 },
  { key: 'color', title: 'Color', width: 100 },
  { key: 'material', title: 'Material', width: 150 },
  { key: 'seoTitle', title: 'SEO Title', width: 180 },
  { key: 'seoDescription', title: 'SEO Description', width: 200 },
  { key: 'locationTopLvl', title: 'Location Top Level', width: 140 },
  { key: 'locationLvl2', title: 'Location Level 2', width: 140 },
  { key: 'locationLvl3', title: 'Location Level 3', width: 140 },
];

// Custom theme for invalid cells
const customTheme: Partial<Theme> = {
  bgCell: '#ffffff',
  textDark: '#1f2937',
  textHeader: '#374151',
  bgHeader: '#f3f4f6',
  borderColor: '#e5e7eb',
};

export function ValidationGrid({ rows, onSelectionChange }: ValidationGridProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    INITIAL_COLUMNS.forEach(col => {
      widths[col.key] = col.width;
    });
    return widths;
  });
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // Filter rows based on selected filter
  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'valid':
        return rows.filter(r => r.isValid);
      case 'invalid':
        return rows.filter(r => !r.isValid);
      default:
        return rows;
    }
  }, [rows, filter]);

  // Handle selection changes
  const onGridSelectionChange = useCallback((newSelection: GridSelection) => {
    setSelection(newSelection);
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selectedIndices = selection.rows.toArray();
      const selectedRows = selectedIndices.map(i => filteredRows[i]).filter(Boolean);
      onSelectionChange(selectedRows);
    }
  }, [selection, filteredRows, onSelectionChange]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelection({
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
    });
  }, [filter]);

  const columns: GridColumn[] = useMemo(
    () =>
      INITIAL_COLUMNS.map((col) => ({
        id: col.key,
        title: col.title,
        width: columnWidths[col.key] || col.width,
      })),
    [columnWidths]
  );

  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [column.id as string]: newSize,
    }));
  }, []);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const row = filteredRows[rowIndex];
      const column = INITIAL_COLUMNS[colIndex];

      if (!row || !column) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      // Handle image preview column specially
      if (column.key === 'imagePreview') {
        const imageUrl = row.data.image;
        if (imageUrl && imageUrl.trim() !== '') {
          return {
            kind: GridCellKind.Image,
            data: [imageUrl],
            displayData: [imageUrl],
            allowOverlay: true,
          };
        }
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '(no image)',
          allowOverlay: false,
        };
      }

      const value = row.data[column.key as keyof typeof row.data] || '';
      const validation = row.validation[column.key as keyof typeof row.validation];
      const isInvalid = validation && !validation.valid;

      return {
        kind: GridCellKind.Text,
        data: value,
        displayData: value,
        allowOverlay: true,
        themeOverride: isInvalid
          ? {
              bgCell: '#fee2e2',
              textDark: '#991b1b',
            }
          : undefined,
      };
    },
    [filteredRows]
  );

  // Track mouse position for tooltip
  const mousePos = useRef({ x: 0, y: 0 });
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onItemHovered = useCallback((args: GridMouseEventArgs) => {
    if (args.kind === 'cell') {
      const [colIndex, rowIndex] = args.location;
      const row = filteredRows[rowIndex];
      const column = INITIAL_COLUMNS[colIndex];
      
      if (row && column) {
        // Handle imagePreview column specially
        if (column.key === 'imagePreview') {
          const imageUrl = row.data.image;
          setTooltip({
            content: imageUrl || '(no image)',
            x: mousePos.current.x,
            y: mousePos.current.y,
          });
          return;
        }

        const value = row.data[column.key as keyof typeof row.data] || '';
        const validation = row.validation[column.key as keyof typeof row.validation];
        let content = value || '(empty)';
        
        if (validation && !validation.valid && validation.message) {
          content = `${value || '(empty)'}\n\n⚠️ ${validation.message}`;
        }
        
        setTooltip({
          content,
          x: mousePos.current.x,
          y: mousePos.current.y,
        });
      }
    } else {
      setTooltip(null);
    }
  }, [filteredRows]);

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Validation Results</h2>
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">✓ {validCount} valid rows</span>
          {invalidCount > 0 && (
            <span className="text-red-600">✗ {invalidCount} invalid rows</span>
          )}
        </div>
      </div>
      
      {/* Filter radio buttons */}
      <div className="flex gap-6 items-center bg-gray-50 p-3 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Show:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="filter"
            value="all"
            checked={filter === 'all'}
            onChange={() => setFilter('all')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm">All ({rows.length})</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="filter"
            value="invalid"
            checked={filter === 'invalid'}
            onChange={() => setFilter('invalid')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-red-600">Invalid ({invalidCount})</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="filter"
            value="valid"
            checked={filter === 'valid'}
            onChange={() => setFilter('valid')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-green-600">Valid ({validCount})</span>
        </label>
      </div>

      <div 
        className="border rounded-lg overflow-hidden relative" 
        style={{ height: 500, width: '100%' }}
        onMouseLeave={() => setTooltip(null)}
        onMouseMove={handleMouseMove}
      >
        <DataEditor
          getCellContent={getCellContent}
          columns={columns}
          rows={filteredRows.length}
          theme={customTheme}
          smoothScrollX
          smoothScrollY
          getCellsForSelection={true}
          rowMarkers="checkbox"
          rowSelectionMode="multi"
          gridSelection={selection}
          onGridSelectionChange={onGridSelectionChange}
          width="100%"
          height="100%"
          onColumnResize={onColumnResize}
          onItemHovered={onItemHovered}
        />
      </div>
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 max-w-md p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none whitespace-pre-wrap"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          {tooltip.content}
        </div>
      )}
      
      <div className="text-sm text-gray-500">
        <span className="inline-block w-4 h-4 bg-red-100 border border-red-200 mr-2 align-middle"></span>
        Red cells indicate validation errors. Hover over cells to see error details.
      </div>
    </div>
  );
}
