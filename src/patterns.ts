// Shared input rules. No imports: the build evaluates the definition check, which
// uses these, without a Vue compiler.

/** A service name, tool id or section id: lowercase letters, digits and dashes. */
export const NAME_RE = /^[a-z0-9][a-z0-9-]*$/
