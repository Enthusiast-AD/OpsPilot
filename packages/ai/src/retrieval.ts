import { prisma } from "@opspilot/database";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SemanticSearchResult {
    id: string;
    content: string;
    similarity: number;
}

/**
 * Executes a localized, tenant-locked mathematical similarity search 
 * across the organization's knowledge base.
 */
export async function retrieveGroundedContext(
    organizationId: string,
    userQuestion: string,
    limit: number = 4,
    minSimilarity: number = 0.35
): Promise<SemanticSearchResult[]> {

    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userQuestion,
    });

    const queryVector = `[${embeddingResponse.data[0].embedding.join(',')}]`;
    
    const matchedChunks = await prisma.$queryRaw<any[]>`
        SELECT
            dc.id,
            dc.content,
            1 - (dc.embedding <=> ${queryVector}::vector) AS similarity
        FROM
            "DocumentChunk" dc
        JOIN
            "Document" d ON dc."documentId" = d.id
        WHERE
            d."organization_id" = ${organizationId}
            AND 1 - (dc.embedding <=> ${queryVector}::vector) >= ${minSimilarity}
        ORDER BY
            similarity DESC
        LIMIT
            ${limit}
    `;

    return matchedChunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        similarity: Number(chunk.similarity)
    }));
}