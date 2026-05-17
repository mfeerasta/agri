'use client';

import { useRegisterPageContext } from '@zameen/ui';

export function PageContextRegister({ context }: { context: string }) {
  useRegisterPageContext(context);
  return null;
}
