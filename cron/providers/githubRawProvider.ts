import type { ContentProvider, DocumentReference } from "../contentProvider.js";

export interface GitHubSourcesConfig {
  repository: string;
  branch: string;
  documents: string[];
}

function rawUrl(config: GitHubSourcesConfig, path: string): string {
  return `https://raw.githubusercontent.com/${config.repository}/${config.branch}/${path}`;
}

export class GitHubRawProvider implements ContentProvider {
  constructor(private readonly config: GitHubSourcesConfig) {}

  async listDocuments(): Promise<DocumentReference[]> {
    return this.config.documents.map((path) => ({ path, url: rawUrl(this.config, path) }));
  }

  async getDocument(path: string): Promise<string> {
    const url = rawUrl(this.config, path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
}
