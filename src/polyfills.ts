const runtimeGlobal = globalThis as typeof globalThis & {
  global?: typeof globalThis;
};

if (!runtimeGlobal.global) {
  runtimeGlobal.global = globalThis;
}
