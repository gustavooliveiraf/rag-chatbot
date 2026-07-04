export interface Chunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  headingPath: string;
  content: string;
  tokenCount: number;
  embedding: number[];
}

export interface RetrievedChunk extends Chunk {
  documentTitle: string;
  sourceUrl: string;
  similarity: number;
}

export interface SourceRef {
  title: string;
  headingPath: string;
  url: string;
}

export interface Answer {
  text: string;
  grounded: boolean;
  sources: SourceRef[];
}

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
  grounded: boolean;
  sources: SourceRef[];
}

export interface ErrorResponse {
  error: string;
}

export interface EvaluationCase {
  id: string;
  question: string;
  expect_answered: boolean;
  expected_source_titles: string[];
}
