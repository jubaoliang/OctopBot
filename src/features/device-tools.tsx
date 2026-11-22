import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ChatSocket, type ChatConnectionStatus } from '@/core/chat/chat-socket';
import { deviceToolRegisterPayload, dispatchDeviceTool } from '@/core/device-tools';
import { useAuth } from '@/features/auth';
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
  const { baseUrl, token, user, ready } = useAuth();
  const { consent } = useCalendarSync();
  const [status, setStatus] = useState<ChatConnectionStatus>('idle');
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
      return consent.actions;
    });
  }, [consent, copy]);
  const toolsRef = useRef(tools);
  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);

  const socketRef = useRef<ChatSocket | null>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const sendResult = useCallback((callId: string, result: { output?: unknown; error?: string }) => {
    socketRef.current?.sendDeviceToolResult(callId, result);
  }, []);

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

  const summarize = (name: string, input: unknown): string => {
    const s = stringsRef.current.deviceTools;
    const label =
      name === 'calendar.create_event'
        ? s.toolCreateEvent
        : name === 'contacts.search'
          ? s.toolSearchContacts
          : name === 'phone.dial'
            ? s.toolDial
            : name === 'sms.compose'
              ? s.toolSms
              : name === 'mail.compose'
                ? s.toolMail
                : s.toolReadCalendar;
    const preview = JSON.stringify(input ?? {});
    return `${label} · ${preview.length > 120 ? `${preview.slice(0, 120)}…` : preview}`;
  };

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
        setPending({
          callId,
          name,
          input: frame.input,
          summary: summarize(name, frame.input),
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

  // One presence socket per signed-in session; reconnect/heartbeat come from
  // ChatSocket so a dropped link re-registers automatically on reopen.
  useEffect(() => {
    if (!ready || !user || !baseUrl) {
      return;
    }
    const socket = new ChatSocket({
      path: '/api/devices/ws',
      baseUrl,
      tokenFactory: () => Promise.resolve(token),
      onFrame: frame => handleFrameRef.current(frame),
      onStatus: next => setStatus(next),
    });
    socketRef.current = socket;
    void socket.connect().catch(() => undefined);
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [ready, user, baseUrl, token]);

  // (Re)advertise the consented tool set on open and whenever consent changes.
  useEffect(() => {
    if (status === 'open') {
      socketRef.current?.sendDeviceToolsRegister(deviceToolRegisterPayload(tools));
    }
  }, [status, tools]);

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
