import { prisma } from '@opspilot/database';
import { OpenAI } from 'openai';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

interface TextChunk {
    content: string;
}

/**
 * Splits text into 500-character blocks with the 100-character semantic overlap.
 */
function chunkRawText(text: string, chunkSize: number = 500, overlap: number = 100): TextChunk[] {
    const chunks: TextChunk[] = [];
    let startIndex = 0;

    const cleanText = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace

    while (startIndex < cleanText.length) {
        const endIndex = startIndex + chunkSize;
        const content = cleanText.substring(startIndex, endIndex);
        chunks.push({ content });
        startIndex += chunkSize - overlap;
    }

    return chunks;
}

/**
 * Downloads a document binary, slices it into semantic nodes,
 * computes OpenAI embeddings for each node, and stores them in the database.
 */
export async function processDocumentToVectors(documentId: string, fileBuffer: Buffer, fileType: string): Promise<void> {

    let rawText: string = '';

    if (fileType === 'application/pdf') {
        const parsedPdf = await pdf(fileBuffer);
        rawText = parsedPdf.text;
    } else if (fileType === 'text/plain') {
        rawText = fileBuffer.toString('utf-8');
    } else {
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (!rawText.trim()) {
        throw new Error('The document is empty or contains only whitespace.');
    }
    
    const textChunks = chunkRawText(rawText);

    for (const chunk of textChunks) {
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small', // Generate the standard 1536-dimensional embedding
            input: chunk.content,
        });

        const vectorArray = embeddingResponse.data[0].embedding;

        const vectorString = `[${vectorArray.join(',')}]`;
        const chunkId = crypto.randomUUID();

        await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (id, "document_id", content, embedding) 
        VALUES (${chunkId}, ${documentId}, ${chunk.content}, ${vectorString}::vector)
        `;
    }
}

