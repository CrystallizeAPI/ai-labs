// XLS Row data structure matching the spreadsheet columns for Instrument import
export interface XLSRowData {
  sku: string;
  productName: string;
  price: string;
  image: string; // URL to product image
  shortDescription: string;
  description: string;
  relatedItems: string; // comma-separated SKUs
  brand: string;
  color: string;
  material: string;
  seoTitle: string;
  seoDescription: string;
  locationTopLvl: string;
  locationLvl2: string;
  locationLvl3: string;
}

// Validation result for each cell
export interface CellValidation {
  valid: boolean;
  message?: string;
}

// Row with validation status
export interface ValidatedRow {
  data: XLSRowData;
  validation: Record<keyof XLSRowData, CellValidation>;
  isValid: boolean;
}

// Crystallize reference data
export interface CrystallizeBrand {
  id: string;
  name: string;
  path: string;
}

export interface CrystallizeFolder {
  id: string;
  name: string;
  path: string;
  children?: CrystallizeFolder[];
}

export interface CrystallizeReferenceData {
  brands: CrystallizeBrand[];
  folders: CrystallizeFolder[];
}

// Column mapping for XLS
export const XLS_COLUMN_MAPPING: Record<string, keyof XLSRowData> = {
  'Sku': 'sku',
  'Product Name': 'productName',
  'Price': 'price',
  'Image': 'image',
  'Short Description': 'shortDescription',
  'Description': 'description',
  'Related Items': 'relatedItems',
  'Brand': 'brand',
  'Color': 'color',
  'Material': 'material',
  'SEO Title': 'seoTitle',
  'SEO Description': 'seoDescription',
  'Location top lvl': 'locationTopLvl',
  'Location lvl2': 'locationLvl2',
  'Location lvl3': 'locationLvl3',
};

// Mass operation types
export interface MassOperation {
  intent: string;
  [key: string]: unknown;
}

export interface MassOperationsFile {
  version: string;
  operations: MassOperation[];
}
