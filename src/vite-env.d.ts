/**
 * Global type declaration so source code can reference the static token
 * `import.meta.env` (which Vite statically replaces with baked env values at
 * build time). Keep the property optional — plain Node/vitest runners have no
 * import.meta.env.
 */
interface ImportMeta {
  env?: Record<string, string | boolean | undefined>;
}
