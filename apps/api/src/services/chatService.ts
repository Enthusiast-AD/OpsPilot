import {prisma} from '@opspilot/database';


// Saves a chat interaction to the database
export async function archiveChatInteraction(
    userId: string,
    question: string,
    answer: string,
    confidence: number
){
    return await prisma.aiChat.create({
        data: {
            userId,
            question,
            answer,
            confidence
        }
    });
}

// Retrieves the chat history for a specific operator from the database
export async function getOperatorChatHistory(userId: string){
    return await prisma.aiChat.findMany({
        where: {
            userId
        },
        include:{
            escalation: {
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
            }
        }
        },
        orderBy: {
            createdAt: 'desc'
        }
    })
}