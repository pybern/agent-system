import { azure } from '@ai-sdk/azure';
import { streamText, smoothStream, generateText } from 'ai';
import { z } from 'zod';
import { generateEmbedding } from '../embeddings';
import { supabase } from '@/lib/supabase';

interface IntentResult {
  isSqlRelated: boolean;
  confidence: number;
  businessDomains: Array<{
    domain: string;
    relevance: number;
    workspaceType: 'system' | 'custom';
  }>;
  reasoning: string;
}

export default async function suggestTables(userMessage: string, intent: IntentResult, messages: any[]) {

  const {text: result} = await generateText({
    model: azure('gpt-4o'),
    system: `You are a database schema expert. Your job is to help users find relevant database tables and columns.

When the user asks about database tables, you should:
1. Use the find_relevant_tables tool to search for relevant tables
2. After getting the results, provide a clear, helpful response that explains:
   - Which tables are most relevant to their question
   - What columns are available in those tables
   - How the tables could be used to answer their question
   - Suggest potential SQL queries if appropriate

Always respond with a clear explanation after using the tool. Don't just call the tool and stop.

User's context:
- Question: "${userMessage}"
- Business domains: ${intent.businessDomains.map(d => `${d.domain} (${Math.round(d.relevance * 100)}% relevant)`).join(', ')}`,
    messages: messages,
    tools: {
      find_relevant_tables: {
        description: 'Search for relevant database tables using embedding similarity',
        parameters: z.object({
          query: z.string().describe('The search query to find relevant tables'),
          limit: z.number().optional().default(5).describe('Maximum number of tables to return')
        }),
        execute: async ({ query, limit = 5 }) => {
          console.log("Searching for tables")
          try {
            // Generate embedding for the search query
            const queryEmbedding = await generateEmbedding(query);
            
            // Search for similar tables in Supabase using vector similarity
            const { data: results, error } = await supabase.rpc('match_table_embeddings', {
              query_embedding: queryEmbedding,
              match_threshold: 0.3,
              match_count: limit
            });

            if (error) {
              console.error('Supabase search error:', error);
              return {
                error: 'Failed to search for table embeddings',
                results: []
              };
            }

            // Group results by table_name for better organization
            const tableGroups = (results || []).reduce((acc: any, row: any) => {
              const tableName = row.table_name;
              if (!acc[tableName]) {
                acc[tableName] = {
                  table_name: tableName,
                  db_id: row.db_id,
                  columns: [],
                  similarity: row.similarity
                };
              }
              acc[tableName].columns.push({
                column_name: row.column_name,
                column_type: row.column_type,
                text_content: row.text_content,
                similarity: row.similarity
              });
              return acc;
            }, {});

            console.log(Object.values(tableGroups))

            return {
              tables: Object.values(tableGroups),
              searchQuery: query,
              resultsCount: results?.length || 0
            };
          } catch (error) {
            console.error('Table search error:', error);
            return {
              error: 'Failed to search for table embeddings',
              results: []
            };
          }
        }
      }
    },
  });

  console.log(result)
  return result;
}
