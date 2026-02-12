import {
  XLSRowData,
  ValidatedRow,
  CellValidation,
  CrystallizeReferenceData,
} from '../types';
import { validateSkusBatched } from '../api/crystallize';

// Required fields for Instrument import
const REQUIRED_FIELDS: (keyof XLSRowData)[] = [
  'sku',
  'productName',
  'price',
  'description',
  'brand',
  'locationTopLvl',
  'locationLvl2',
  'locationLvl3',
];

// Optional fields
const OPTIONAL_FIELDS: (keyof XLSRowData)[] = [
  'image',
  'shortDescription',
  'relatedItems',
  'color',
  'material',
  'seoTitle',
  'seoDescription',
];

export function validateRow(
  row: XLSRowData,
  referenceData: CrystallizeReferenceData,
  _allSkus: Set<string>
): ValidatedRow {
  const validation: Record<keyof XLSRowData, CellValidation> = {} as Record<
    keyof XLSRowData,
    CellValidation
  >;

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].trim() === '') {
      validation[field] = { valid: false, message: 'Required field is empty' };
    } else {
      validation[field] = { valid: true };
    }
  }

  // Initialize optional fields as valid
  for (const field of OPTIONAL_FIELDS) {
    validation[field] = { valid: true };
  }

  // Validate price is a valid number
  if (row.price && row.price.trim() !== '') {
    const priceNum = parseFloat(row.price);
    if (isNaN(priceNum) || priceNum < 0) {
      validation.price = {
        valid: false,
        message: 'Price must be a valid positive number',
      };
    }
  }

  // Validate brand against reference data
  if (row.brand && row.brand.trim() !== '') {
    const brandExists = referenceData.brands.some(
      (b) => b.name.toLowerCase() === row.brand.toLowerCase()
    );
    if (!brandExists) {
      validation.brand = {
        valid: false,
        message: `Brand "${row.brand}" not found in Crystallize`,
      };
    }
  }

  // Related items validation is handled separately in validateAllRows
  // Just mark as valid here - will be updated after batch validation
  if (row.relatedItems && row.relatedItems.trim() !== '') {
    validation.relatedItems = { valid: true };
  }

  // Validate folder structure (all 3 levels must exist and match)
  // Only validate if we have reference data and all location fields are provided
  if (
    referenceData.folders.length > 0 &&
    row.locationTopLvl &&
    row.locationLvl2 &&
    row.locationLvl3
  ) {
    const folderExists = findFolderByPath(
      referenceData.folders,
      row.locationTopLvl,
      row.locationLvl2,
      row.locationLvl3
    );

    if (!folderExists) {
      validation.locationTopLvl = {
        valid: false,
        message: `Folder path not found`,
      };
      validation.locationLvl2 = {
        valid: false,
        message: `Folder path not found`,
      };
      validation.locationLvl3 = {
        valid: false,
        message: `Folder path not found`,
      };
    }
  }

  // Check if all validations passed
  const isValid = Object.values(validation).every((v) => v.valid);

  return { data: row, validation, isValid };
}

function findFolderByPath(
  folders: CrystallizeReferenceData['folders'],
  lvl1: string,
  lvl2: string,
  lvl3: string
): boolean {
  if (!folders || folders.length === 0) return true; // Skip validation if no folder data
  if (!lvl1 || !lvl2 || !lvl3) return false;

  const lvl1Folder = folders.find(
    (f) => f.name?.toLowerCase() === lvl1.toLowerCase()
  );
  if (!lvl1Folder) return false;

  const lvl2Folder = lvl1Folder.children?.find(
    (f) => f.name?.toLowerCase() === lvl2.toLowerCase()
  );
  if (!lvl2Folder) return false;

  const lvl3Folder = lvl2Folder.children?.find(
    (f) => f.name?.toLowerCase() === lvl3.toLowerCase()
  );
  return !!lvl3Folder;
}

export async function validateAllRows(
  rows: XLSRowData[],
  referenceData: CrystallizeReferenceData
): Promise<ValidatedRow[]> {
  // Collect all SKUs from the file for related items validation
  const fileSkus = new Set(rows.map((r) => r.sku));

  // First pass: basic validation
  const validatedRows = rows.map((row) => validateRow(row, referenceData, fileSkus));

  // Collect all related item SKUs that need validation
  const allRelatedSkus = new Set<string>();
  rows.forEach((row) => {
    if (row.relatedItems && row.relatedItems.trim() !== '') {
      row.relatedItems.split(',').forEach((sku) => {
        const trimmedSku = sku.trim();
        // Only add SKUs not found in the file
        if (!fileSkus.has(trimmedSku)) {
          allRelatedSkus.add(trimmedSku);
        }
      });
    }
  });

  // Batch validate SKUs not found in the file against Crystallize
  let crystallizeSkus = new Set<string>();
  if (allRelatedSkus.size > 0) {
    console.log(`Validating ${allRelatedSkus.size} related SKUs against Crystallize...`);
    crystallizeSkus = await validateSkusBatched(Array.from(allRelatedSkus), 20);
  }

  // Combine valid SKUs: file SKUs + Crystallize SKUs
  const allValidSkus = new Set([...fileSkus, ...crystallizeSkus]);

  // Second pass: update related items validation
  validatedRows.forEach((validatedRow, index) => {
    const row = rows[index];
    if (row.relatedItems && row.relatedItems.trim() !== '') {
      const relatedSkus = row.relatedItems.split(',').map((s) => s.trim());
      const invalidSkus = relatedSkus.filter((sku) => !allValidSkus.has(sku));
      
      if (invalidSkus.length > 0) {
        validatedRow.validation.relatedItems = {
          valid: false,
          message: `Invalid SKU(s) not found in file or Crystallize: ${invalidSkus.join(', ')}`,
        };
        validatedRow.isValid = false;
      }
    }
  });

  return validatedRows;
}
