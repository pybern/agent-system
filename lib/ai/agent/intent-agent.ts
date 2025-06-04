import { azure } from '@ai-sdk/azure';
import { generateObject } from 'ai';
import { z } from 'zod';

export default async function classifyIntent(userMessage: string) {

    const {object : intent} = await generateObject({
        model: azure('gpt-4o-mini'),
        schema: z.object({
            isSqlRelated: z.boolean().describe('Whether the user question is related to SQL, databases, or data queries'),
            confidence: z.number().min(0).max(1).describe('Confidence score for the classification'),
            businessDomains: z.array(z.object({
                domain: z.enum(['finance', 'sales', 'marketing', 'hr', 'operations', 'inventory', 'customer-service', 'analytics', 'custom']).describe('Business domain/workspace'),
                relevance: z.number().min(0).max(1).describe('Relevance score for this domain'),
                workspaceType: z.enum(['system', 'custom']).describe('Type of workspace - system (predefined) or custom (user-defined)')
            })).describe('Relevant business domains if SQL-related'),
            reasoning: z.string().describe('Brief explanation of the classification decision')
        }),
        prompt: `You are an expert at classifying user questions and mapping them to business domains for SQL query assistance.

Your task is to:
1. Determine if the user's question is SQL-related (involves databases, tables, data exploration, data queries, analytics, reporting, etc.)
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

Analyze this user question and classify it:\n\nUser Question: ${userMessage}`,
    })

    return intent;
}
