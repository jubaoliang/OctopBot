import { createContext, useContext } from 'react';

/** A device-tool call awaiting the user's in-conversation confirmation. */
export interface DeviceConfirmRequest {
  callId: string;
  name: string;
  input: unknown;
  summary: string;
}

export interface DeviceToolsValue {
  /** Pending write/action confirmation, or null. */
  pending: DeviceConfirmRequest | null;
  approve: () => void;
  cancel: () => void;
  /** Whether the device presence socket is connected. */
  online: boolean;
}

export const DeviceToolsContext = createContext<DeviceToolsValue | null>(null);

export function useDeviceTools(): DeviceToolsValue {
  const value = useContext(DeviceToolsContext);
  if (!value) {
    throw new Error('useDeviceTools must be used inside DeviceToolsProvider');
  }
  return value;
}
