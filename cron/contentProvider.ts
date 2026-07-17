export interface DocumentReference {
  /** Repo-relative path, stable identifier passed back into getDocument(). */
  path: string;
  /**
   * Resolved source URL, persisted as documents.source_url. Just a TEXT UNIQUE
   * column, not necessarily http(s) — a future S3Provider/LocalFileProvider
   * can use s3://... / file://... instead.
   */
  url: string;
}

export interface ContentProvider {
  listDocuments(): Promise<DocumentReference[]>;
  getDocument(path: string): Promise<string>;
}
