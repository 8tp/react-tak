# Node.js to React Native Conversion Guide

## Overview

This document outlines the conversion approach for migrating the TAK server library from Node.js-only to a dual-platform architecture supporting both Node.js and React Native environments. This conversion aligns with the dTAK program's offline-first tactical mapping platform requirements.

## Architecture Overview

The library now supports dual-platform execution through:

### Platform Detection
- `lib/platform.ts` - Runtime detection of React Native environment
- Conditional imports and behavior based on platform

### Transport Layer Abstraction
- **Node.js Path**: `lib/transport/node.ts` using `node:tls`
- **React Native Path**: `lib/transport/react-native.ts` using `react-native-tcp-socket`
- **Factory**: `lib/transport/factory.ts` for automatic platform selection

### Entry Points
- `index.node.ts` - Node.js-specific exports with Node transport factory
- `index.native.ts` - React Native-specific exports with RN transport factory
- `index.ts` - Default export pointing to Node.js version

### Package.json Exports
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "react-native": "./dist/index.native.js",
    "import": "./dist/index.node.js",
    "default": "./dist/index.node.js"
  }
}
```

## Key Conversion Changes

### 1. Stream Handling (`lib/stream.ts`)
**Before**: Direct `node:stream` import
```typescript
import { Stream } from 'node:stream';
export default async function stream2buffer(stream: Stream): Promise<Buffer>
```

**After**: Runtime-agnostic event emitter support returning `Uint8Array`
```typescript
type EventEmitterLike = {
  on(event: 'data', listener: (chunk: unknown) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (error: unknown) => void): void;
};

export default async function stream2buffer(stream: EventEmitterLike): Promise<Uint8Array> {
  // Coerces strings/ArrayBuffers/Node Buffers into Uint8Array
}
```
This avoids bundling `node:stream` in React Native builds and gives both runtimes a shared binary representation.

### 2. API Export Module (`lib/api/export.ts`)
**Before**: Direct `Readable` import
```typescript
import { Readable } from 'node:stream';
async export(): Promise<Readable>
```

**After**: Type-only import with cross-platform return types
```typescript
import type { Readable } from 'node:stream';
async export(): Promise<Readable | Uint8Array>
```

### 3. Binary Utility Layer (`lib/utils/binary.ts`)
New cross-platform helpers convert between `Readable`, `Uint8Array`, `ArrayBuffer`, `Blob`, and string payloads. These utilities drive both REST uploads and FormData construction without eagerly importing Node modules.

### 4. File Operations (`lib/api/files.ts`)
**Before**: Top-level Node imports and Buffer checks.

**After**: Uses `prepareFormDataPart` and `prepareRequestBody` from `lib/utils/binary.ts`, dynamically loading `form-data` only on Node and emitting `Blob` objects on React Native.

### 5. Mission Operations (`lib/api/mission.ts`)
**Before**: Direct import
```typescript
import { Readable } from 'node:stream';
```

**After**: Type-only import and shared binary response handling (`Readable | Uint8Array`) for archive downloads and package uploads via the binary utility helpers.

### 6. UUID Generation (`lib/api/video.ts`)
**Before**: Node-specific crypto
```typescript
import { randomUUID } from 'node:crypto';
```

**After**: Cross-platform UUID helper
```typescript
function createUUID(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122 version 4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

### 7. HTTP Client (`lib/fetch.ts`)
Already platform-aware:
- Uses `globalThis.fetch` when available (React Native/browser)
- Falls back to `undici` for Node.js environments

### 8. Authentication (`lib/auth.ts`)
Already platform-aware:
- `APIAuthCertificate` class detects platform via `isReactNative`
- Uses `react-native-ssl-pinning` for React Native certificate auth
- Uses `undici.Client` for Node.js certificate auth

## React Native Dependencies

The library requires these peer dependencies for React Native:

```json
"peerDependencies": {
  "@tak-ps/node-cot": "^14.7.1",
  "react-native-ssl-pinning": ">=1.6.0",
  "react-native-tcp-socket": ">=5.3.0"
}
```

## Usage Patterns

### Node.js Usage
```typescript
import TAK, { TAKAPI } from '@tak-ps/node-tak';
// Uses Node.js TLS transport automatically
```

### React Native Usage
```typescript
import TAK, { TAKAPI } from '@tak-ps/node-tak';
// Uses React Native TCP socket transport automatically
// Requires react-native-tcp-socket and react-native-ssl-pinning
```

## Testing Strategy

- Node.js behaviour remains covered by existing Vitest suites (`test/default.test.ts`, `test/findCoT.test.ts`, `test/transport.test.ts`).
- React Native code paths are validated with `test/react-native.test.ts`, which mocks `isReactNative`, `react-native-ssl-pinning`, and Blob handling.
- Run the full suite with `ROLLUP_SKIP_NATIVE=true npm test` to skip optional Rollup native bindings during Vitest runs.

## Risk Assessment

### Low Risk
- **Backward Compatibility**: All Node.js functionality preserved
- **API Stability**: No breaking changes to public APIs
- **Test Coverage**: All existing tests pass

### Medium Risk
- **Bundle Size**: React Native apps will include some Node.js type definitions
- **Runtime Errors**: Potential issues if React Native modules not properly installed

### Mitigation Strategies
- Type-only imports prevent runtime inclusion of Node modules in RN bundles
- Lazy loading ensures Node modules only loaded when actually needed
- Comprehensive error handling for missing React Native dependencies

## Performance Considerations

### Bundle Impact
- Type-only imports minimize bundle size impact
- Lazy loading prevents unnecessary module inclusion
- Platform detection happens once at runtime

### Runtime Performance
- No performance impact on Node.js path
- React Native path uses optimized native modules
- Transport layer abstraction adds minimal overhead

## Future Enhancements

1. **Enhanced Error Messages**: Better error reporting when RN dependencies missing
2. **TypeScript Strict Mode**: Continue tightening typings around mission/file payloads
3. **Testing Coverage**: Expand React Native fixtures to cover streaming transports end-to-end
4. **Documentation**: Capture real-world RN integration tips (Metro caching, Hermes, CI builds)

## Deployment Checklist

- [x] Remove top-level Node.js imports from shared modules
- [x] Implement lazy loading for Node-specific functionality
- [x] Add cross-platform UUID generation
- [x] Verify all tests pass in Node.js environment
- [x] Document conversion approach and risks
- [x] Test React Native integration in actual RN project
- [x] Update README with React Native usage examples
- [x] Create React Native integration test project

## Conclusion

The conversion successfully maintains full Node.js compatibility while enabling React Native support through platform detection and lazy loading. The dual-platform architecture supports the dTAK program's requirements for offline-first tactical mapping across both server and mobile environments.
