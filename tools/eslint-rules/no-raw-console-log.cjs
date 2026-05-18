/**
 * Custom ESLint rule: warn when console.{log,error,warn,info} is called
 * without wrapping its arguments in safeStringify() or redact(). Forces
 * any free-form logging path to go through the redaction helpers in
 * @zameen/shared/redact.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Require safeStringify/redact around console logs.' },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.name === 'console' &&
          node.callee.property &&
          ['log', 'error', 'warn', 'info'].includes(node.callee.property.name)
        ) {
          const args = node.arguments || [];
          const hasRedact = args.some(
            (a) =>
              a &&
              a.type === 'CallExpression' &&
              a.callee &&
              (a.callee.name === 'safeStringify' || a.callee.name === 'redact'),
          );
          if (!hasRedact) {
            context.report({
              node,
              message:
                'Use safeStringify(...) or redact(...) when logging arbitrary data via console.*.',
            });
          }
        }
      },
    };
  },
};
