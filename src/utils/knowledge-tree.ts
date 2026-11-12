import type { KnowledgeDocument } from '@/core/api/types';

/** Stable document id (`id` or alias `document_id`). */
export function knowledgeDocumentId(doc: Pick<KnowledgeDocument, 'id' | 'document_id'>): string {
  return doc.id || doc.document_id || '';
}

/** Folder rows are marked `is_dir: true`; missing/false means a file. */
export function isKnowledgeFolder(doc: Pick<KnowledgeDocument, 'is_dir'>): boolean {
  return doc.is_dir === true;
}

/** Prefix used to list this folder's immediate children. */
export function knowledgeChildPrefix(doc: Pick<KnowledgeDocument, 'path'>): string {
  return doc.path;
}

/** Human-readable label for a document row. */
export function knowledgeDocumentLabel(
  doc: Pick<KnowledgeDocument, 'filename' | 'path'> & { name?: string },
): string {
  const named = (doc.filename || doc.name || '').trim();
  if (named) {
    return named;
  }
  const path = doc.path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(slash + 1) : path;
}
