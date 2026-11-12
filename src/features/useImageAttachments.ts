import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AgentsApi } from '@/core/api/agents';
import {
  exceedsUploadLimit,
  toTurnAttachment,
  type AttachSource,
  type PendingAttachment,
} from '@/core/api/attachments';
import type { HttpClient } from '@/core/api/http';
import { SettingsApi } from '@/core/api/settings';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { MediaPickerError, pickImages } from '@/platform/media-picker';

interface PendingState {
  /** Chips belong to one expert + login generation; a switch hides them. */
  agentId: string;
  generation: number;
  items: PendingAttachment[];
}

// Per-session cap cache: one fetch per client + login generation.
const limitCache = new WeakMap<HttpClient, { generation: number; mb: Promise<number> }>();

function maxUploadMb(client: HttpClient, generation: number): Promise<number> {
  const hit = limitCache.get(client);
  if (hit && hit.generation === generation) {
    return hit.mb;
  }
  const mb = new SettingsApi(client).getMaxUploadMb();
  limitCache.set(client, { generation, mb });
  return mb;
}

let nextId = 0;

/**
 * Screen-level image attachment flow: pick (via the platform wrapper),
 * enforce the server size cap, upload to the expert workspace, and expose
 * chips for the composer. The composer itself stays presentational.
 */
export function useImageAttachments(agentId: string) {
  const { httpClient, sessionGeneration } = useAuth();
  const { t: strings } = useI18n();
  const [state, setState] = useState<PendingState>({
    agentId,
    generation: sessionGeneration,
    items: [],
  });
  // Hide chips from a previous expert/session without an effect setState.
  const pending =
    state.agentId === agentId && state.generation === sessionGeneration ? state.items : [];

  // Late uploads from a previous session or expert must not land in a new one.
  const scopeRef = useRef({ agentId, sessionGeneration });
  useEffect(() => {
    scopeRef.current = { agentId, sessionGeneration };
  }, [agentId, sessionGeneration]);

  const patch = useCallback(
    (targetAgent: string, generation: number, id: string, next: Partial<PendingAttachment>) => {
      setState(prev =>
        prev.agentId !== targetAgent || prev.generation !== generation
          ? prev
          : {
              ...prev,
              items: prev.items.map(item => (item.id === id ? { ...item, ...next } : item)),
            },
      );
    },
    [],
  );

  const alertProblem = useCallback(
    (message: string) => {
      Alert.alert(strings.attachments.errorTitle, message);
    },
    [strings.attachments.errorTitle],
  );

  const pickAsync = useCallback(
    async (source: AttachSource) => {
      const startScope = { ...scopeRef.current };
      const stale = () =>
        scopeRef.current.agentId !== startScope.agentId ||
        scopeRef.current.sessionGeneration !== startScope.sessionGeneration;

      let picked;
      try {
        picked = await pickImages(source);
      } catch (cause) {
        alertProblem(
          cause instanceof MediaPickerError && cause.code === 'denied'
            ? strings.attachments.permissionDenied
            : strings.attachments.unavailable,
        );
        return;
      }
      if (picked.length === 0 || stale()) {
        return;
      }

      const limitMb = await maxUploadMb(httpClient, startScope.sessionGeneration);
      if (stale()) {
        return;
      }
      const oversize = picked.filter(image => exceedsUploadLimit(image.byteSize, limitMb));
      if (oversize.length > 0) {
        alertProblem(
          strings.attachments.oversize(oversize.map(i => i.filename).join(', '), limitMb),
        );
      }
      const accepted = picked.filter(image => !oversize.includes(image));
      if (accepted.length === 0) {
        return;
      }

      const items: PendingAttachment[] = accepted.map(image => {
        nextId += 1;
        return {
          id: `att-${nextId}`,
          uri: image.uri,
          filename: image.filename,
          status: 'uploading',
        };
      });
      setState(prev => ({
        agentId: startScope.agentId,
        generation: startScope.sessionGeneration,
        items:
          prev.agentId === startScope.agentId && prev.generation === startScope.sessionGeneration
            ? [...prev.items, ...items]
            : items,
      }));

      const api = new AgentsApi(httpClient);
      const failed: string[] = [];
      await Promise.all(
        accepted.map(async (image, index) => {
          const id = items[index].id;
          try {
            const result = await api.upload(startScope.agentId, {
              uri: image.uri,
              name: image.filename,
              type: image.mimeType,
            });
            if (!stale()) {
              patch(startScope.agentId, startScope.sessionGeneration, id, {
                status: 'ready',
                attachment: toTurnAttachment(result),
              });
            }
          } catch {
            if (!stale()) {
              failed.push(image.filename);
              patch(startScope.agentId, startScope.sessionGeneration, id, { status: 'failed' });
            }
          }
        }),
      );
      if (failed.length > 0) {
        alertProblem(strings.attachments.uploadFailed(failed.join(', ')));
      }
    },
    [alertProblem, httpClient, patch, strings.attachments],
  );

  /** Fire-and-forget for UI callbacks; problems surface as alerts. */
  const pick = useCallback(
    (source: AttachSource) => {
      void pickAsync(source);
    },
    [pickAsync],
  );

  const remove = useCallback((id: string) => {
    setState(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  }, []);

  const clear = useCallback(() => {
    setState(prev => ({ ...prev, items: [] }));
  }, []);

  return { pending, pick, remove, clear };
}
