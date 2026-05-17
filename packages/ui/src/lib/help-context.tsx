'use client';

/**
 * Page-level context provider for the Claude help drawer. Pages call
 * usePageContext().setContext('Diesel home, showing logs and anomalies')
 * during render; the drawer reads it via usePageContext().context.
 */

import * as React from 'react';

interface HelpContextValue {
  context: string;
  setContext: (next: string) => void;
}

const HelpCtx = React.createContext<HelpContextValue>({
  context: '',
  setContext: () => undefined,
});

export function HelpContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = React.useState('');
  const value = React.useMemo(() => ({ context, setContext }), [context]);
  return <HelpCtx.Provider value={value}>{children}</HelpCtx.Provider>;
}

export function usePageContext(): HelpContextValue {
  return React.useContext(HelpCtx);
}

/**
 * Convenience hook: registers a string as the current page context for the
 * lifetime of the component. Resets on unmount.
 */
export function useRegisterPageContext(description: string): void {
  const { setContext } = usePageContext();
  React.useEffect(() => {
    setContext(description);
    return () => setContext('');
  }, [description, setContext]);
}
