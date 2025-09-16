# TAK React Native Integration Test

This is a minimal React Native application to test the `@tak-ps/node-tak` library integration in a React Native environment.

## Setup

1. Install dependencies:
```bash
cd example-react-native-integration
npm install
```

2. For iOS (requires Xcode and iOS Simulator):
```bash
cd ios && pod install && cd ..
npm run ios
```

3. For Android (requires Android Studio and emulator):
```bash
npm run android
```

## What This Tests

### Platform Detection
- Verifies React Native environment is detected correctly
- Tests cross-platform UUID generation
- Validates FormData availability

### API Integration
- Tests TAKAPI initialization with certificate authentication
- Validates mission listing functionality
- Confirms secure certificate storage works

### Streaming Connection
- Tests TAK streaming connection setup
- Validates CoT message handling
- Confirms transport layer selection (react-native-tcp-socket)

### Expected Behavior

**Platform Detection**: Should detect React Native environment and show appropriate platform-specific features.

**API Calls**: Will likely fail with connection errors (expected) but should not crash the app. The important part is that the library loads and initializes correctly.

**Streaming**: Will fail to connect to mock server (expected) but should show proper error handling without crashes.

## Success Criteria

✅ App launches without crashes
✅ Platform detection works correctly  
✅ TAK library imports successfully
✅ API initialization doesn't throw errors
✅ Streaming connection setup doesn't crash
✅ Error handling works properly

## Dependencies Tested

- `@tak-ps/node-tak` - Main library
- `react-native-tcp-socket` - TCP connections
- `react-native-ssl-pinning` - Certificate handling

## Notes

This is a basic integration test. For production use:
- Implement proper certificate management
- Add real server configuration
- Handle network permissions
- Add proper error boundaries
- Implement secure storage for credentials
