import { azure } from '@ai-sdk/azure';
import { generateObject, streamText } from 'ai';
import { z } from 'zod';

// Schema for intent classification response
export const intentClassificationSchema = z.object({
  isSqlRelated: z.boolean().describe('Whether the user question is related to SQL, databases, or data queries'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the classification'),
  businessDomains: z.array(z.object({
    domain: z.enum(['finance', 'sales', 'marketing', 'hr', 'operations', 'inventory', 'customer-service', 'analytics', 'custom']).describe('Business domain/workspace'),
    relevance: z.number().min(0).max(1).describe('Relevance score for this domain'),
    workspaceType: z.enum(['system', 'custom']).describe('Type of workspace - system (predefined) or custom (user-defined)')
  })).describe('Relevant business domains if SQL-related'),
  reasoning: z.string().describe('Brief explanation of the classification decision')
});

export type IntentClassification = z.infer<typeof intentClassificationSchema>;

export interface BusinessDomain {
  domain: string;
  relevance: number;
  workspaceType: 'system' | 'custom';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Prompts
const INTENT_CLASSIFICATION_PROMPT = `You are an expert at classifying user questions and mapping them to business domains for SQL query assistance.

Your task is to:
1. Determine if the user's question is SQL-related (involves databases, data queries, analytics, reporting, etc.)
2. If SQL-related, identify which business domains/workspaces are most relevant
3. Classify workspaces as either "system" (predefined business areas) or "custom" (user-specific domains)

Available business domains:
- finance: Financial data, accounting, budgets, revenue, expenses
- sales: Sales performance, leads, deals, customer acquisition
- marketing: Campaigns, leads, conversion rates, marketing metrics
- hr: Employee data, payroll, performance, recruitment
- operations: Business processes, logistics, supply chain
- inventory: Stock levels, product management, warehousing
- customer-service: Support tickets, customer satisfaction, service metrics
- analytics: General data analysis, reporting, dashboards
- custom: User-specific or industry-specific domains not covered above

Guidelines:
- Mark as SQL-related if the question involves: data retrieval, database queries, reporting, analytics, data analysis, table operations
- For system workspaces: use predefined domains that clearly match the question
- For custom workspaces: when the domain is very specific to user's business or not well covered by system domains
- Provide relevance scores (0-1) for each domain
- Include confidence score for overall classification
- Be concise but clear in reasoning

Analyze this user question and classify it:`;

const SQL_ASSISTANT_PROMPT = (domains: string[]) => 
  `You are a SQL assistant. The user's question has been classified as SQL-related with these relevant business domains: ${domains.join(', ')}. Focus your responses on these areas.`;

const NON_SQL_PROMPT = 'The user\'s question is not SQL-related. Always reply, "Sorry, I can only assist with SQL-related questions."';

export class SQLAgent {
  private model: any;
  private chatModel: any;

  constructor() {
    this.model = azure('gpt-4o-mini');
    this.chatModel = azure('gpt-4o');
  }

  /**
   * Classifies user intent and maps to business domains
   */
  async classifyIntent(userMessage: string): Promise<IntentClassification> {
    const result = await generateObject({
      model: this.model,
      prompt: `${INTENT_CLASSIFICATION_PROMPT}\n\nUser Question: "${userMessage}"`,
      schema: intentClassificationSchema,
    });

    return result.object;
  }

  /**
   * Filters relevant business domains based on relevance threshold
   */
  getRelevantDomains(classification: IntentClassification, threshold: number = 0.5): string[] {
    return classification.businessDomains
      .filter(domain => domain.relevance > threshold)
      .map(domain => domain.domain);
  }

  /**
   * Generates system prompt based on classification
   */
  generateSystemPrompt(classification: IntentClassification): string {
    if (!classification.isSqlRelated) {
      return NON_SQL_PROMPT;
    }

    const domains = classification.businessDomains.map(d => d.domain);
    return SQL_ASSISTANT_PROMPT(domains);
  }

  /**
   * Streams chat response based on classification and messages
   */
  async streamChat(classification: IntentClassification, messages: ChatMessage[]) {
    const systemPrompt = this.generateSystemPrompt(classification);

    return streamText({
      model: this.chatModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages
      ],
    });
  }

  /**
   * Main method to process a chat request
   */
  async processChat(messages: ChatMessage[]) {
    // Get the latest user message
    const userMessage = messages.at(-1)?.content || '';
    
    // Classify intent
    const classification = await this.classifyIntent(userMessage);
    
    // Log classification for debugging
    console.log('Intent Classification:', classification);
    
    // Get relevant domains for RAG filtering
    if (classification.isSqlRelated) {
      const relevantDomains = this.getRelevantDomains(classification);
      console.log('Relevant domains for RAG:', relevantDomains);
      
      // TODO: Use relevantDomains to filter SQL samples and tables for RAG
      // This would significantly narrow your search radius
    }
    
    // Stream chat response
    return this.streamChat(classification, messages);
  }
}
