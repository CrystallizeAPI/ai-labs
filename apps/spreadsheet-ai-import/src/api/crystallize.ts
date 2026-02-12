import { CrystallizeReferenceData, CrystallizeBrand, CrystallizeFolder } from '../types';

const TENANT_IDENTIFIER = import.meta.env.VITE_CRYSTALLIZE_TENANT_IDENTIFIER;
const ACCESS_TOKEN_ID = import.meta.env.VITE_CRYSTALLIZE_ACCESS_TOKEN_ID;
const ACCESS_TOKEN_SECRET = import.meta.env.VITE_CRYSTALLIZE_ACCESS_TOKEN_SECRET;

const CATALOGUE_API_URL = `https://api.crystallize.com/${TENANT_IDENTIFIER}/catalogue`;
// Use proxy in development to avoid CORS issues
const CORE_API_URL = import.meta.env.DEV 
  ? `/api/core/@${TENANT_IDENTIFIER}`
  : `https://api.crystallize.com/@${TENANT_IDENTIFIER}`;

console.log('Crystallize API URL:', CATALOGUE_API_URL);
console.log('Crystallize Core API URL:', CORE_API_URL);

async function crystallizeQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  console.log('Executing query:', query.slice(0, 100) + '...');
  
  const response = await fetch(CATALOGUE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crystallize-Access-Token-Id': ACCESS_TOKEN_ID,
      'X-Crystallize-Access-Token-Secret': ACCESS_TOKEN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  console.log('Response status:', response.status);

  if (!response.ok) {
    throw new Error(`Crystallize API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Response data:', result);
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch all brands from /brands
export async function fetchBrands(): Promise<CrystallizeBrand[]> {
  const query = `
    query FetchBrands {
      catalogue(path: "/brands", language: "en") {
        id
        name
        children {
          id
          name
        }
      }
    }
  `;

  const data = await crystallizeQuery<{ catalogue: { children: CrystallizeBrand[] } }>(query);
  return data.catalogue?.children || [];
}

// Folder node from subtree query
interface FolderEdge {
  node: {
    id: string;
    name: string;
    subtree?: {
      edges: FolderEdge[];
    };
  };
}

// Fetch folder structure from /instruments
// Returns structure with "Instruments" as top-level to match spreadsheet
export async function fetchFolders(): Promise<CrystallizeFolder[]> {
  const query = `
    query FetchCategories {
      catalogue(path: "/instruments", language: "en") {
        id
        name
        subtree(type: folder) {
          edges {
            node {
              id
              name
              subtree(type: folder) {
                edges {
                  node {
                    id
                    name
                    subtree(type: folder) {
                      edges {
                        node {
                          id
                          name
                          subtree(type: folder) {
                            edges {
                              node {
                                id
                                name
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  interface CatalogueResponse {
    catalogue: {
      id: string;
      name: string;
      subtree?: {
        edges: FolderEdge[];
      };
    };
  }

  const data = await crystallizeQuery<CatalogueResponse>(query);
  
  // Convert the edge/node structure to our folder structure
  const convertEdgesToFolders = (edges?: FolderEdge[]): CrystallizeFolder[] => {
    if (!edges) return [];
    return edges.map(edge => ({
      id: edge.node.id,
      name: edge.node.name,
      path: '',
      children: convertEdgesToFolders(edge.node.subtree?.edges),
    }));
  };

  // Wrap in "Instruments" top-level folder to match spreadsheet structure
  // Spreadsheet has: Location top lvl = "Instruments", Location lvl2 = "Guitars", etc.
  const instrumentsFolder: CrystallizeFolder = {
    id: data.catalogue?.id || '',
    name: data.catalogue?.name || 'Instruments',
    path: '/instruments',
    children: convertEdgesToFolders(data.catalogue?.subtree?.edges),
  };

  return [instrumentsFolder];
}

// Fetch all reference data
export async function fetchAllReferenceData(): Promise<CrystallizeReferenceData> {
  console.log('Fetching all reference data from Crystallize...');
  
  const [brands, folders] = await Promise.all([
    fetchBrands().catch(e => { console.error('Failed to fetch brands:', e); return []; }),
    fetchFolders().catch(e => { console.error('Failed to fetch folders:', e); return []; }),
  ]);

  console.log('Reference data loaded:');
  console.log('- Brands:', brands.length, brands.map(b => b.name));
  console.log('- Folders:', folders.length, folders.map(f => f.name));

  return { brands, folders };
}

// Validate SKUs exist in Crystallize (batch query)
export async function validateSkusInCrystallize(skus: string[]): Promise<Set<string>> {
  if (skus.length === 0) return new Set();
  
  const query = `
    query FetchSkus($skus: [String!]!) {
      productVariants(language: "en", skus: $skus) {
        sku
        name
        productId
      }
    }
  `;

  try {
    const data = await crystallizeQuery<{ productVariants: { sku: string; name: string; productId: string }[] }>(
      query,
      { skus }
    );
    const validSkus = new Set(data.productVariants?.map(v => v.sku) || []);
    console.log(`Validated ${skus.length} SKUs, found ${validSkus.size} in Crystallize`);
    return validSkus;
  } catch (e) {
    console.error('Failed to validate SKUs in Crystallize:', e);
    return new Set();
  }
}

// Validate SKUs in batches (20 at a time)
export async function validateSkusBatched(skus: string[], batchSize = 20): Promise<Set<string>> {
  const validSkus = new Set<string>();
  
  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize);
    const batchValid = await validateSkusInCrystallize(batch);
    batchValid.forEach(sku => validSkus.add(sku));
  }
  
  return validSkus;
}

// ============================================
// Mass Operations - Core API
// ============================================

async function crystallizeCoreQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  console.log('Executing Core API query:', query.slice(0, 100) + '...');
  
  const response = await fetch(CORE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crystallize-Access-Token-Id': ACCESS_TOKEN_ID,
      'X-Crystallize-Access-Token-Secret': ACCESS_TOKEN_SECRET,
      'X-Crystallize-Tenant-Identifier': TENANT_IDENTIFIER,
    },
    body: JSON.stringify({ query, variables }),
  });

  console.log('Core API Response status:', response.status);

  if (!response.ok) {
    throw new Error(`Crystallize Core API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Core API Response data:', result);
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

export interface BulkTaskStatus {
  id: string;
  key: string;
  status: 'pending' | 'started' | 'complete' | 'error';
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  progress?: {
    finished: number;
    total: number;
  };
  info?: {
    error?: string;
    errorName?: string;
    stack?: string;
  };
}

// Step 1: Generate presigned upload request
async function generatePresignedUploadRequest(filename: string): Promise<{ url: string; fields: Record<string, string>; key: string }> {
  const query = `
    mutation GetPresignedUrl($file: String!, $contentType: String!, $type: FileUploadType!) {
      generatePresignedUploadRequest(
        filename: $file
        contentType: $contentType
        type: $type
      ) {
        ... on PresignedUploadRequest {
          url
          fields {
            name
            value
          }
        }
        ... on BasicError {
          error: message
        }
      }
    }
  `;

  const data = await crystallizeCoreQuery<{
    generatePresignedUploadRequest: {
      url?: string;
      fields?: { name: string; value: string }[];
      error?: string;
    };
  }>(query, { 
    file: filename, 
    contentType: 'application/json',
    type: 'MASS_OPERATIONS',
  });

  const result = data.generatePresignedUploadRequest;
  
  if (result.error) {
    throw new Error(`Presigned upload error: ${result.error}`);
  }
  
  if (!result.url || !result.fields) {
    throw new Error('Failed to get presigned upload URL');
  }
  
  // Convert fields array to object and extract the key
  const fields: Record<string, string> = {};
  result.fields.forEach(field => {
    fields[field.name] = field.value;
  });
  
  // The key is in the fields
  const key = fields['key'];
  if (!key) {
    throw new Error('No key found in presigned upload fields');
  }

  return {
    url: result.url,
    fields,
    key,
  };
}

// Step 2: Upload file to presigned URL
async function uploadToPresignedUrl(
  url: string, 
  fields: Record<string, string>, 
  fileContent: string
): Promise<void> {
  const formData = new FormData();
  
  // Add all fields from the presigned request
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  // Add the file content
  const blob = new Blob([fileContent], { type: 'application/json' });
  formData.append('file', blob);

  // In development, proxy through Vite to avoid CORS issues with S3
  let uploadUrl = url;
  if (import.meta.env.DEV) {
    // Replace the S3 URL with our proxy
    const s3Url = new URL(url);
    uploadUrl = `/api/s3-upload${s3Url.pathname}${s3Url.search}`;
    console.log('Using proxy URL for S3 upload:', uploadUrl);
  }

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  // S3 returns 204 No Content on successful upload
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${text}`);
  }
  
  console.log('File uploaded successfully');
}

// Step 3: Create bulk task
async function createMassOperationBulkTask(key: string): Promise<{ id: string; status: string }> {
  const query = `
    mutation RegisterBulkTask($key: String!) {
      createMassOperationBulkTask(input: { key: $key, autoStart: false }) {
        ... on BulkTaskMassOperation {
          id
          status
        }
        ... on BasicError {
          error: message
        }
      }
    }
  `;

  const data = await crystallizeCoreQuery<{
    createMassOperationBulkTask: { id?: string; status?: string; error?: string };
  }>(query, { key });

  const result = data.createMassOperationBulkTask;
  if (result.error) {
    throw new Error(`Create bulk task error: ${result.error}`);
  }
  if (!result.id) {
    throw new Error('Failed to create bulk task');
  }

  return { id: result.id, status: result.status || 'pending' };
}

// Step 3b: Start bulk task
async function startMassOperationBulkTask(taskId: string): Promise<{ id: string; status: string }> {
  const query = `
    mutation StartBulkTask($id: ID!) {
      startMassOperationBulkTask(id: $id) {
        ... on BulkTaskMassOperation {
          id
          status
        }
        ... on BasicError {
          error: message
        }
      }
    }
  `;

  const data = await crystallizeCoreQuery<{
    startMassOperationBulkTask: { id?: string; status?: string; error?: string };
  }>(query, { id: taskId });

  const result = data.startMassOperationBulkTask;
  if (result.error) {
    throw new Error(`Start bulk task error: ${result.error}`);
  }
  if (!result.id) {
    throw new Error('Failed to start bulk task');
  }

  return { id: result.id, status: result.status || 'started' };
}

// Step 4: Get bulk task status
export async function getBulkTaskStatus(taskId: string): Promise<BulkTaskStatus> {
  const query = `
    query GetBulkTask($id: ID!) {
      bulkTask(id: $id) {
        ... on BulkTaskMassOperation {
          id
          type
          status
          key
          info
        }
        ... on BasicError {
          error: message
        }
      }
    }
  `;

  const data = await crystallizeCoreQuery<{
    bulkTask: BulkTaskStatus & { error?: string };
  }>(query, { id: taskId });

  if (data.bulkTask.error) {
    throw new Error(`Get bulk task error: ${data.bulkTask.error}`);
  }

  return data.bulkTask;
}

// Main function: Run mass operations
export async function runMassOperations(
  operationsJson: string,
  onProgress?: (status: BulkTaskStatus) => void
): Promise<BulkTaskStatus> {
  const filename = `mass-operations-${Date.now()}.json`;
  
  // Step 1: Get presigned URL
  console.log('Step 1: Generating presigned upload URL...');
  const { url, fields, key } = await generatePresignedUploadRequest(filename);
  
  // Step 2: Upload the file
  console.log('Step 2: Uploading operations file...');
  await uploadToPresignedUrl(url, fields, operationsJson);
  
  // Step 3: Create the bulk task
  console.log('Step 3: Creating bulk task...');
  const createdTask = await createMassOperationBulkTask(key);
  console.log(`Task created with ID: ${createdTask.id}`);
  
  // Step 3b: Start the bulk task
  console.log('Step 3b: Starting bulk task...');
  const startedTask = await startMassOperationBulkTask(createdTask.id);
  
  // Create initial status for progress callback
  const initialStatus: BulkTaskStatus = {
    id: startedTask.id,
    key,
    status: startedTask.status as BulkTaskStatus['status'],
    createdAt: new Date().toISOString(),
  };
  
  if (onProgress) {
    onProgress(initialStatus);
  }
  
  // Step 4: Poll for completion
  console.log('Step 4: Monitoring task progress...');
  let currentStatus = initialStatus;
  
  while (currentStatus.status === 'pending' || currentStatus.status === 'started') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
    currentStatus = await getBulkTaskStatus(startedTask.id);
    
    if (onProgress) {
      onProgress(currentStatus);
    }
    
    console.log(`Task status: ${currentStatus.status}`, currentStatus.progress);
  }
  
  return currentStatus;
}
