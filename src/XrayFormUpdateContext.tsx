import { createContext, useContext } from 'react';

export type UpdateSelectedFieldPath = (path: Array<string | number>, nextValue: unknown) => void;

const XrayFormUpdateContext = createContext<UpdateSelectedFieldPath | undefined>(undefined);

export const XrayFormUpdateProvider = XrayFormUpdateContext.Provider;

export function useXrayFormUpdate() {
  return useContext(XrayFormUpdateContext);
}
