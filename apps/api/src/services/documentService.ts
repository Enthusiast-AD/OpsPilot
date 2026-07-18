import {BlobServiceClient, BlobSASPermissions} from '@azure/storage-blob';
import {prisma} from '@opspilot/database';
import crypto from 'crypto';
import { processDocumentToVectors } from '@opspilot/ai';

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
if(!CONNECTION_STRING) {
    throw new Error('CRITICAL: AZURE_STORAGE_CONNECTION_STRING environment variable is not set.');
}

const containerName = 'opspilot-knowledge-base';
const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

/**
 * Node.js Stream Helper: Converts Azure's readable web stream body into a physical 
 * binary buffer so libraries like pdf-parse can process it in memory.
 */
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}

// Generates a SAS token for uploading a document to Azure Blob Storage
export async function generateDocumentUploadUrl(organizationId: string, fileName: string, fileType: string){
    const extension = fileType === "application/pdf" ? "pdf" : "txt";
    const uniqueId = crypto.randomUUID();
    const normalizedName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const storageKey = `tenants/${organizationId}/knowledge/${uniqueId}-${normalizedName}.${extension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + 15); // SAS token valid for 15 minutes

    const uploadUrl = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse("cw"), // Create and Write permissions
        expiresOn,
    });

    return {
        storageKey,
        uploadUrl,
    }
}

// Verifies that the document exists in Azure Blob Storage and ingests it into the database
// This function also triggers the background processing of the document for embeddings
export async function verifyAndIngestDocument(organizationId: string, storageKey: string,title: string, fileType: string) {
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    const exists = await blockBlobClient.exists();
    if (!exists) {
        throw new Error('Document does not exist in Azure Blob Storage.');
    }

    // Create the root document mapping within the organization tenant space
    const document = await prisma.document.create({
        data: {
            title,
            fileUrl: blockBlobClient.url,
            organizationId,
        },
    });

    // BACKGROUND AI PIPE HOOK:
    // Fire-and-forget or push to a background job queue to convert PDF -> Text Chunks -> Vector Embeddings
    // We wrap this safely to ensure that if chunking fails, the uploaded document doesn't crash the request
    processDocumentEmbeddings(document.id, storageKey, fileType).catch((err) => {
        console.error('Error processing document embeddings:', err);
    });

    return document;
}


export async function removeDocument(organizationId: string, documentId: string): Promise<void> {
    const document = await prisma.document.findFirst({
        where: {
            id: documentId,
            organizationId,
        },
    });
    
    if (!document) {
        throw new Error('Document not found or does not belong to the organization.');
    }

    const urlParts = document.fileUrl.split(`/${containerName}/`);
    const storageKey = decodeURIComponent(urlParts[1]!);
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);
    
    await blockBlobClient.deleteIfExists();

    await prisma.document.delete({
        where: {
            id: documentId,
        },
    });
}

// BACKGROUND PROCESSOR: Runs completely asynchronously outside the main HTTP thread cycle.
async function processDocumentEmbeddings(documentId: string, storageKey: string, fileType: string): Promise<void> {
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
        throw new Error(`Failed to initialize download stream channel for cloud key: ${storageKey}`);
    }

    const fileBuffer = await streamToBuffer(downloadResponse.readableStreamBody);

    await processDocumentToVectors(documentId, fileBuffer, fileType);

    console.log(`🚀 AI Ingestion Complete: Document [${documentId}] successfully chunked, vectorized, and stored.`);
}