import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AgentsApi } from '@/core/api/agents';
import {
  exceedsUploadLimit,
  toTurnAttachment,
  type AttachSource,
  type PendingAttachment,
} from '@/core/api/attachments';
import { OctopApiError } from '@/core/api/errors';
import type { HttpClient } from '@/core/api/http';
import { SettingsApi } from '@/core/api/settings';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { pickDocuments } from '@/platform/document-picker';
import { openAppSettings } from '@/platform/linking';
import { MediaPickerError, pickImages } from '@/platform/media-picker';
import { localFilePart } from '@/platform/multipart';

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
 * Screen-level attachment flow: system photo / camera / Files pickers
 * (via platform wrappers), size-cap check, upload to the expert workspace,
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

  const alertPermissionDenied = useCallback(() => {
    Alert.alert(strings.attachments.errorTitle, strings.attachments.permissionDenied, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: strings.attachments.openSettings, onPress: () => openAppSettings() },
    ]);
  }, [
    strings.attachments.errorTitle,
    strings.attachments.openSettings,
    strings.attachments.permissionDenied,
    strings.common.cancel,
  ]);

  const pickAsync = useCallback(
    async (source: AttachSource) => {
      const startScope = { ...scopeRef.current };
      const stale = () =>
        scopeRef.current.agentId !== startScope.agentId ||
        scopeRef.current.sessionGeneration !== startScope.sessionGeneration;

      let picked;
      try {
        picked = source === 'files' ? await pickDocuments() : await pickImages(source);
      } catch (cause) {
        if (cause instanceof MediaPickerError && cause.code === 'denied') {
          alertPermissionDenied();
        } else {
          alertProblem(strings.attachments.unavailable);
        }
        return;
      }
      if (picked.length === 0 || stale()) {
        return;
      }

      const limitMb = await maxUploadMb(httpClient, startScope.sessionGeneration);
      if (stale()) {
        return;
      }
      const oversize = picked.filter(file => exceedsUploadLimit(file.byteSize, limitMb));
      if (oversize.length > 0) {
        alertProblem(
          strings.attachments.oversize(oversize.map(i => i.filename).join(', '), limitMb),
        );
      }
      const accepted = picked.filter(file => !oversize.includes(file));
      if (accepted.length === 0) {
        return;
      }

      const kind = source === 'files' ? 'file' : 'image';
      const items: PendingAttachment[] = accepted.map(file => {
        nextId += 1;
        return {
          id: `att-${nextId}`,
          uri: file.uri,
          filename: file.filename,
          kind: file.mimeType.startsWith('image/') ? 'image' : kind,
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
        accepted.map(async (file, index) => {
          const id = items[index].id;
          try {
            const result = await api.upload(
              startScope.agentId,
              localFilePart({
                uri: file.uri,
                name: file.filename,
                type: file.mimeType,
              }),
            );
            if (!stale()) {
              patch(startScope.agentId, startScope.sessionGeneration, id, {
                status: 'ready',
                attachment: toTurnAttachment(result, { localUri: file.uri }),
              });
            }
          } catch (cause) {
            if (!stale()) {
              const detail =
                cause instanceof OctopApiError && cause.message
                  ? `${file.filename}: ${cause.message}`
                  : file.filename;
              failed.push(detail);
              patch(startScope.agentId, startScope.sessionGeneration, id, { status: 'failed' });
            }
          }
        }),
      );
      if (failed.length > 0) {
        alertProblem(strings.attachments.uploadFailed(failed.join(', ')));
      }
    },
    [alertPermissionDenied, alertProblem, httpClient, patch, strings.attachments],
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
