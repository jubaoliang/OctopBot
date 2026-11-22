import type { HttpClient } from './http';
import type { CronJob, CronTaskType, CronTrigger, KnowledgeBase, KnowledgeDocument } from './types';

export class KnowledgeApi {
  constructor(private readonly http: HttpClient) {}

  bases(): Promise<KnowledgeBase[]> {
    return this.http.get('/api/knowledge-bases');
  }

  /** Tree children under a prefix; empty prefix lists the roots. */
  documents(kbId: string, prefix = ''): Promise<KnowledgeDocument[]> {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    return this.http.get(`/api/knowledge-bases/${kbId}/documents${qs}`);
  }

  /**
   * Extracted plain text for a file document. The server returns a JSON
   * envelope `{ id, filename, text }` — normalize to the text body so
   * screens stay string-only.
   */
  async preview(kbId: string, docId: string): Promise<string> {
    const raw = await this.http.get<KnowledgePreviewResponse | string>(
      `/api/knowledge-bases/${kbId}/documents/${docId}/preview`,
    );
    if (typeof raw === 'string') {
      return raw;
    }
    return typeof raw?.text === 'string' ? raw.text : '';
  }

  /** Creates a knowledge base owned by the current user (private). */
  createBase(name: string, description = ''): Promise<KnowledgeBase> {
    return this.http.post('/api/knowledge-bases', { name, description, shared: false });
  }

  /** Creates a markdown (default) or plain-text document with initial content. */
  createTextDocument(
    kbId: string,
    body: { name: string; content: string; format?: 'md' | 'txt' },
  ): Promise<KnowledgeDocument> {
    return this.http.post(`/api/knowledge-bases/${kbId}/documents/text`, {
      name: body.name,
      format: body.format ?? 'md',
      content: body.content,
    });
  }

  /** Replaces a markdown / plain-text document's content (server reindexes). */
  updateTextContent(kbId: string, docId: string, content: string): Promise<KnowledgeDocument> {
    return this.http.put(`/api/knowledge-bases/${kbId}/documents/${docId}/content`, { content });
  }
}

/** Envelope for `GET …/documents/{doc_id}/preview`. */
export interface KnowledgePreviewResponse {
  id?: string;
  filename?: string;
  text?: string;
}

export interface CronJobDraft {
  name?: string;
  trigger: CronTrigger;
  prompt: string;
  enabled: boolean;
  /** Defaults to `text` server-side; the builder sends `agent` so routines
   * run as real assistant turns instead of posting the prompt verbatim. */
  task_type?: CronTaskType;
}

export class CronApi {
  constructor(private readonly http: HttpClient) {}

  settings(): Promise<{ timezone: string }> {
    return this.http.get('/api/cron/settings');
  }

  list(agentId: string): Promise<CronJob[]> {
    return this.http.get(`/api/agents/${agentId}/cron`);
  }

  create(agentId: string, draft: CronJobDraft): Promise<CronJob> {
    return this.http.post(`/api/agents/${agentId}/cron`, draft);
  }

  update(agentId: string, cronId: string, patch: Partial<CronJobDraft>): Promise<CronJob> {
    return this.http.patch(`/api/agents/${agentId}/cron/${cronId}`, patch);
  }

  remove(agentId: string, cronId: string): Promise<void> {
    return this.http.delete(`/api/agents/${agentId}/cron/${cronId}`);
  }

  runNow(agentId: string, cronId: string): Promise<void> {
    return this.http.post(`/api/agents/${agentId}/cron/${cronId}/run-now`);
  }
}
