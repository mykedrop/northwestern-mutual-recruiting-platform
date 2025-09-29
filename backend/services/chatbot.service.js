const openAIService = require('./openai.service');
const db = require('../db');

class ChatbotService {
    constructor() {
        this.conversations = new Map();
    }

    async startConversation(candidateId, channel) {
        const sessionId = `${candidateId}_${Date.now()}`;
        
        const conversation = {
            candidateId,
            channel,
            sessionId,
            messages: [],
            context: {},
            status: 'active'
        };

        this.conversations.set(sessionId, conversation);

        // Store in database (use NULL for candidateId if not provided)
        await db.query(
            `INSERT INTO chatbot_conversations
            (candidate_id, session_id, channel, status, messages, context)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [candidateId || null, sessionId, channel, 'active', JSON.stringify([]), JSON.stringify({})]
        );

        return sessionId;
    }

    async processMessage(sessionId, message, candidateId, channel) {
        let conversation = this.conversations.get(sessionId) || await this.loadConversation(sessionId);

        if (!conversation) {
            // Start a new conversation when not found
            const newSessionId = await this.startConversation(candidateId || 0, channel || 'web');
            conversation = this.conversations.get(newSessionId);
            sessionId = newSessionId;
        }

        // Add user message to history
        conversation.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // Generate AI response
        const response = await openAIService.generateChatbotResponse(message, conversation.context);

        // Add AI response to history
        conversation.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date()
        });

        // Check for escalation triggers
        const shouldEscalate = await this.checkEscalation(message, response);
        
        if (shouldEscalate) {
            conversation.escalated = true;
            conversation.escalationReason = 'Complex query requiring human assistance';
        }

        // Update conversation in memory and database
        this.conversations.set(sessionId, conversation);
        await this.saveConversation(conversation);

        return { response, escalated: shouldEscalate, sessionId };
    }


    async checkEscalation(message, response) {
        const escalationTriggers = [
            'speak to human',
            'talk to recruiter',
            'urgent',
            'complaint',
            'legal',
            'discrimination',
            'harassment'
        ];

        const lowerMessage = message.toLowerCase();
        return escalationTriggers.some(trigger => lowerMessage.includes(trigger));
    }

    async loadConversation(sessionId) {
        const result = await db.query(
            'SELECT * FROM chatbot_conversations WHERE session_id = $1',
            [sessionId]
        );

        if (result.rows.length === 0) return null;

        const conv = result.rows[0];
        return {
            candidateId: conv.candidate_id,
            channel: conv.channel,
            sessionId: conv.session_id,
            messages: conv.messages,
            context: conv.context,
            status: conv.status,
            escalated: conv.escalated
        };
    }

    async saveConversation(conversation) {
        await db.query(
            `UPDATE chatbot_conversations 
            SET messages = $1, context = $2, status = $3, escalated = $4, updated_at = NOW()
            WHERE session_id = $5`,
            [
                JSON.stringify(conversation.messages),
                JSON.stringify(conversation.context),
                conversation.status,
                conversation.escalated || false,
                conversation.sessionId
            ]
        );
    }

    async endConversation(sessionId) {
        const conversation = this.conversations.get(sessionId);
        if (conversation) {
            conversation.status = 'ended';
            await this.saveConversation(conversation);
            this.conversations.delete(sessionId);
        }

        await db.query(
            `UPDATE chatbot_conversations 
            SET status = 'ended', ended_at = NOW() 
            WHERE session_id = $1`,
            [sessionId]
        );
    }
}

module.exports = new ChatbotService();

