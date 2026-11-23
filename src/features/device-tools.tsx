import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { formatDeviceToolCall } from '@/core/device-tool-summary';
import { deviceToolRegisterPayload, dispatchDeviceTool } from '@/core/device-tools';
import { useSessionSocket } from '@/features/session-socket-context';
import { useCalendarSync } from '@/features/calendar-sync-context';
import {
  DeviceToolsContext,
  type DeviceConfirmRequest,
  type DeviceToolsValue,
} from '@/features/device-tools-context';
import { useI18n } from '@/i18n/I18nProvider';
import { buildDeviceTools } from '@/platform/device-tools';
import { haptics } from '@/platform/haptics';

/**
 * The device presence node: one persistent authenticated socket per user on
 * which this phone advertises its consented device tools. ANY of the user's
 * sessions (web, desktop, mobile) can then delegate a tool call here; reads
 * execute immediately, writes/actions park for an INLINE approval card in
 * the owning thread's transcript (the thread screen renders it via the HITL
 * card mechanism — never a popup).
 */
export function DeviceToolsProvider({ children }: { children: ReactNode }) {
  const { t: strings } = useI18n();
  const { consent } = useCalendarSync();
  const { status, send, subscribe } = useSessionSocket();
  const [pending, setPending] = useState<DeviceConfirmRequest | null>(null);

  const stringsRef = useRef(strings);
  useEffect(() => {
    stringsRef.current = strings;
  }, [strings]);

  const copy = useMemo(
    () => ({
      title: strings.deviceTools.confirmTitle,
      message: (url: string) => url,
      cancel: strings.deviceTools.cancel,
      open: strings.deviceTools.approve,
    }),
    [strings],
  );

  const tools = useMemo(() => {
    const all = buildDeviceTools(copy);
    return all.filter(tool => {
      if (tool.name.startsWith('calendar.')) {
        return consent.calendar;
      }
      if (tool.name === 'contacts.search') {
        return consent.contacts;
      }
      if (tool.name === 'sms.read' || tool.name === 'sms.send') {
        return consent.sms;
      }
      return consent.actions;
    });
  }, [consent, copy]);
  const toolsRef = useRef(tools);
  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);

  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const sendResult = useCallback(
    (callId: string, result: { output?: unknown; error?: string }) => {
      send({ type: 'device_tool_result', call_id: callId, ...result });
    },
    [send],
  );

  const execute = useCallback(
    async (callId: string, name: string, input: unknown) => {
      const dispatched = await dispatchDeviceTool(toolsRef.current, name, input);
      if (dispatched.ok) {
        sendResult(callId, { output: dispatched.output });
      } else {
        sendResult(callId, { error: dispatched.error });
      }
    },
    [sendResult],
  );

  const handleFrame = useCallback(
    (frame: { type: string; [key: string]: unknown }) => {
      if (frame.type !== 'device_tool_call') {
        return;
      }
      const callId = typeof frame.call_id === 'string' ? frame.call_id : '';
      const name = typeof frame.name === 'string' ? frame.name : '';
      if (!callId || !name) {
        return;
      }
      const tool = toolsRef.current.find(candidate => candidate.name === name);
      if (!tool) {
        sendResult(callId, { error: `unknown device tool: ${name}` });
        return;
      }
      if (tool.requiresConfirmation) {
        haptics.notify('warning');
        const text = formatDeviceToolCall(
          tool.name,
          frame.input,
          stringsRef.current.deviceTools.card,
        );
        setPending({
          callId,
          name,
          input: frame.input,
          summary: text.summary,
          detail: text.detail,
          threadId: typeof frame.thread_id === 'string' ? frame.thread_id : null,
        });
      } else {
        void execute(callId, name, frame.input);
      }
    },
    [execute, sendResult],
  );
  const handleFrameRef = useRef(handleFrame);
  useEffect(() => {
    handleFrameRef.current = handleFrame;
  }, [handleFrame]);

  // Routed calls arrive on the shared session socket; reconnect/heartbeat and
  // foreground resume are owned by SessionSocketProvider.
  useEffect(
    () =>
      subscribe(frame => {
        if (frame.type === 'device_tool_call') {
          handleFrameRef.current(frame);
        }
      }),
    [subscribe],
  );

  // (Re)advertise the consented tool set on open and whenever consent changes.
  useEffect(() => {
    if (status === 'open') {
      send({ type: 'device_tools.register', tools: deviceToolRegisterPayload(tools) });
    }
  }, [status, tools, send]);

  const approve = useCallback(() => {
    const request = pendingRef.current;
    if (!request) {
      return;
    }
    setPending(null);
    haptics.selection();
    void execute(request.callId, request.name, request.input);
  }, [execute]);

  const cancel = useCallback(() => {
    const request = pendingRef.current;
    if (!request) {
      return;
    }
    setPending(null);
    sendResult(request.callId, { error: stringsRef.current.deviceTools.cancelled });
  }, [sendResult]);

  const value = useMemo<DeviceToolsValue>(
    () => ({ pending, approve, cancel, online: status === 'open' }),
    [pending, approve, cancel, status],
  );

  return <DeviceToolsContext.Provider value={value}>{children}</DeviceToolsContext.Provider>;
}
