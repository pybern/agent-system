import { embed, embedMany } from 'ai';
import { azure } from '@ai-sdk/azure';

const embeddingModel = azure.embedding('text-embedding-3-small');

const generateChunks = (input: string): string[] => {
  return input
    .trim()
    .split('.')
    .filter(i => i !== '');
};

export async function generateEmbedding(message: string) {

    const { embedding, usage } = await embed({
      model: embeddingModel,
      value: message,
    });
  
    return embedding;
  }

  export async function generateMultipleEmbeddings(messages: string[]) {
    const { embeddings, usage } = await embedMany({
      model: embeddingModel,
      values: messages,
    });
  
    return embeddings;
  }