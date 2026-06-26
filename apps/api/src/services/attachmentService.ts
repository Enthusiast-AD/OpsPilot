import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob'
import { prisma } from '@opspilot/database'
import crypto from 'crypto'

const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING 
if (!AZURE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is not set.')
}

const CONTAINER_NAME = 'opspilot-attachments'

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// Convert MIME types to file extensions for validation and storage purposes
const MIMIE_TO_EXTENSION: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
};

function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[^a-zA-Z0-9.\-_]/g, "_") // Swap emojis, control codes, and path traversals with underscores
        .replace(/\.\.+/g, ".");           // Prevent directory traversal attacks
}

// Create a temporary SAS upload URL
export async function generateUploadUrl(organizationId: string, taskId: string, fileName: string, fileType: string) {
    const extension = MIMIE_TO_EXTENSION[fileType] || 'bin';
    const uniqueId = crypto.randomUUID(); 
    const sanitizedName = sanitizeFileName(fileName);

    // Create a structured storage key for the attachment
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storageKey = `tenants/${organizationId}/tasks/${taskId}/${year}/${month}/${uniqueId}-${sanitizedName}.${extension}`;
    
    // Create a block blob client for the specific blob
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    // SAS expires in 15 minutes
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + 15); // Link valid for 15 minutes

    // Generate a SAS URL for the blob with write permissions
    const uploadUrl = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('cw'), // Create and Write permission
        expiresOn,
    });
    

    return {
        storageKey,
        uploadUrl,
        permanentUrl: blockBlobClient.url, // Permanent URL to access the blob after upload
    };
}

export async function verifyAndRecordAttachment(organizationId: string, taskId: string, storageKey: string, fileName: string, fileType: string, fileSize: number) {

    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    // Verification: Check if the blob exists and matches the expected size
    const exists = await blockBlobClient.exists();
    if (!exists) {
        throw new Error('Uploaded file does not exist in storage.');
    }

    const keyParts = storageKey.split('/');
    const lastPart = keyParts[keyParts.length - 1]; // Get the last part of the storage key which contains the unique ID and file name

    if(!lastPart) {
        throw new Error('Invalid storage key format. Expected a unique ID and file name.');
    }

    const fileId = lastPart.split('-')[0]; // Extract the unique ID from the storage key

    if(!fileId) {
        throw new Error('Invalid storage key format. Expected a unique ID in the last part of the storage key.');
    }
    // Record the attachment in the database
    return await prisma.attachment.create({
        data: {
            id: fileId,
            taskId,
            fileName: sanitizeFileName(fileName),
            fileType,
            fileSize,
            fileUrl: blockBlobClient.url, // Store the permanent URL for future access
        },
    });
}

export async function removeAttachment(organizationId: string, attachmentId: string): Promise<void> {
    const attachment = await prisma.attachment.findFirst({
        where: {
            id: attachmentId,
            task: {
                organizationId
            },
        },
    })

    if (!attachment) {
        throw new Error('Attachment not found or does not belong to the specified organization.')
    }

    // Extract the blob name from the file URL
    const urlParts = attachment.fileUrl.split(`/${CONTAINER_NAME}/`);
    const storageKey = decodeURIComponent(urlParts[1]!);
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    await blockBlobClient.deleteIfExists().catch((error) => {
        console.error(`Failed to delete blob ${storageKey} from storage`, error);
    });

    await prisma.attachment.delete({
        where: {
            id: attachmentId,
        },
    });

}