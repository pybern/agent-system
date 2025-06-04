import { ChatSDKError } from '@/lib/errors';
import classifyIntent from '@/lib/ai/agent/intent-agent';
import suggestTables from '@/lib/ai/agent/table-agent';
import { azure } from '@ai-sdk/azure';
import { streamText, generateText, generateObject } from 'ai';


export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages } = await request.json();

  try {
    // Initialize the SQL agent
    const intent = await classifyIntent(messages[messages.length - 1].content);

    console.log(intent)

    if (intent.isSqlRelated) {
      // Get table suggestions using streaming agent with tool calls
      const tableAgentResult = await suggestTables(messages[messages.length - 1].content, intent, messages);
      
      // Return the streaming result from the table agent
      const results = streamText({
        model: azure('gpt-4o-mini'),
        messages: messages,
        system: `You are an expert SQL analyst and query architect. Your role is to help users build effective SQL queries based on database schema information discovered by a table agent.

## Your Task:
Analyze the table agent results below and provide actionable SQL insights to help the user answer their question.

## Table Agent Analysis Results:
${tableAgentResult}

## Instructions:
1. **Interpret the Results**: Review the tables, columns, and relationships identified by the table agent
2. **Assess Relevance**: Determine which tables are most relevant to the user's specific question
3. **Suggest Query Structure**: Recommend SQL query patterns, JOINs, and WHERE clauses
4. **Provide Examples**: Give concrete SQL examples when possible
5. **Explain Reasoning**: Explain why certain tables/columns are recommended
6. **Identify Gaps**: Point out any missing information or assumptions

## Response Format:
- Start with a brief summary of the most relevant tables for their question
- Suggest 1-2 specific SQL query approaches with example code
- Explain any important relationships between tables
- Mention key columns they should focus on
- Provide tips for filtering, sorting, or aggregating data as needed

## Guidelines:
- Be specific and actionable
- Use proper SQL syntax in examples
- Explain complex JOINs or concepts clearly
- Consider performance implications
- Suggest alternative approaches when applicable

Focus on helping the user write effective SQL queries based on the discovered schema information.`
      })

      return results.toDataStreamResponse();
    }

    console.log("Not SQL related")

    // Return a streaming response without LLM call
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const message = "Sorry, I can only answer questions related to SQL.";
        controller.enqueue(encoder.encode(`0:"${message}"\n`));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-vercel-ai-data-stream': 'v1'
      }
    });

  } catch (error) {
    console.error('Chat processing error:', error);
    throw new ChatSDKError('bad_request:chat');
  }
}