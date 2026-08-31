import ts from "typescript";
const root = new URL('../', import.meta.url);
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {};', shortCircuit: true };
  if (specifier === '@/lib/supabaseAdmin' || specifier === 'next-auth') {
    return { url: new URL('./trial-fixture.mjs', import.meta.url).href, shortCircuit: true };
  }
  if (specifier === '@/lib/auth') return { url: 'data:text/javascript,export const authOptions = {};', shortCircuit: true };
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier.startsWith('@/')) return nextResolve(new URL(specifier.slice(2) + '.ts', root).href, context);
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (url.endsWith('.ts') && !url.includes('/node_modules/')) {
    return { format: 'module', source: ts.transpileModule(result.source.toString(), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText, shortCircuit: true };
  }
  return result;
}
