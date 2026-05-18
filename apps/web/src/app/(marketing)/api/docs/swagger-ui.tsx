'use client';

import { useEffect, useRef } from 'react';

const SWAGGER_CSS = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css';
const SWAGGER_JS = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';

interface SwaggerWindow extends Window {
  SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
}

interface SwaggerUiProps {
  specUrl: string;
}

export function SwaggerUi({ specUrl }: SwaggerUiProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cssId = 'zameen-swagger-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = SWAGGER_CSS;
      document.head.appendChild(link);
    }

    const scriptId = 'zameen-swagger-js';
    function init(): void {
      const w = window as SwaggerWindow;
      if (!w.SwaggerUIBundle || !containerRef.current) return;
      w.SwaggerUIBundle({
        url: specUrl,
        domNode: containerRef.current,
        deepLinking: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 0,
        tryItOutEnabled: false,
      });
    }
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      init();
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = SWAGGER_JS;
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    }
  }, [specUrl]);

  return (
    <div className="bg-white text-black">
      <div ref={containerRef} className="swagger-ui-container max-w-[1200px] mx-auto" />
    </div>
  );
}
