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
        system: `You are a helpful agent presents insights about SQL in a clear and concise manner.\n\nTable Agent Result: ${tableAgentResult}`
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