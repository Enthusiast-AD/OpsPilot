import OpenAI from "openai";
import { retrieveGroundedContext } from "./retrieval.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates an answer to a worker's question using the OpsPilot model.
 * @param OrganizationId - The ID of the organization for context retrieval.
 * @param workerQuestion - The question posed by the worker.
 * @returns An object containing the answer and a confidence score.
 */
export async function generateCopilotAnswer(OrganizationId: string, workerQuestion: string) {

    // Pull down only relevant text nodes matching this organization assests 
    const contextRecords = await retrieveGroundedContext(OrganizationId, workerQuestion);

    // Format the context records into a string for the model prompt
    const formattedContext = contextRecords.map(record => `- ${record.content}`).join("\n");

    // If no matching documentation exists, fail early or switch to a safe fallback state
    if (contextRecords.length === 0) {
        return {
            answer: "I'm sorry, I couldn't find any specifc instructions regarding this issue in the company manuals. Escalte this issue to a human supervisor if you require immediate assistance.",
            confidence: 0.0
        };
    }

    // Compute average similarity metrics to establish a reliable baseline confidence rating
    const averageConfidence = contextRecords.reduce((acc, curr) => acc + curr.similarity, 0) / contextRecords.length;

    const modelResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are OpsPilot, an expert operational copilot for field engineers. 
Your job is to answer the worker's question using only the provided company reference documents. 

Guidelines:
- Rely strictly on the facts listed inside the context blocks below.
- If the context blocks do not contain the answer, state clearly that the info is missing and recommend human escalation.
- Never make up information or invent error codes outside of the provided text.
- Keep your instructions clear, safe, and step-by-step.

Context Documentation:\n${formattedContext}`
            },
            {
                role: "user",
                content: workerQuestion
            }
        ],
        temperature: 0.1,  // Lower temperature for more deterministic responses
    });

    return {
        answer: modelResponse.choices[0].message.content || "An unexpected error occurred while generating the answer.",
        confidence: Math.round(averageConfidence * 100) / 100
    };
}