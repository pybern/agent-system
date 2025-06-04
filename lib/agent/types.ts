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
