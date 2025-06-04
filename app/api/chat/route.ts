import { ChatSDKError } from '@/lib/errors';
import { SQLAgent } from '@/lib/agent';

export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages } = await request.json();
  
  try {
    // Initialize the SQL agent
    const agent = new SQLAgent();
    
    // Process the chat request through the agent
    const result = await agent.processChat(messages);

    return result.toDataStreamResponse();
    
  } catch (error) {
    console.error('Chat processing error:', error);
    throw new ChatSDKError('bad_request:chat');
  }
}