/// <reference types="expo/types" />

// Pulls in Expo's ambient declarations (CSS modules, Metro require, the
// EXPO_PUBLIC_* env shims). Expo normally writes an equivalent expo-env.d.ts on
// first `expo start`, but that file is gitignored — committing this one keeps
// `npm run typecheck` working from a clean clone and in CI.
