import { azure } from '@ai-sdk/azure';
import { generateObject, streamText } from 'ai';
import { intentClassificationSchema, type IntentClassification, type ChatMessage } from './types';
import { INTENT_CLASSIFICATION_PROMPT, SQL_ASSISTANT_PROMPT, NON_SQL_PROMPT } from './prompts';

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
