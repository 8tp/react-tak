<h1 align=center>Node-TAK</h1>
<p align=center>JavaScript TAK Server Library</p>

Lightweight JavaScript library for managing TAK TLS connections for streaming CoT data
as well as a typed SDK for performing TAK Server REST API operations across **Node.js** and **React Native**.

## API Documentation

API Documentation for the latest version can be found on our [Github Pages Site](https://dfpc-coe.github.io/node-tak/)

Or generated locally with

```sh
npm run doc

```

## Installation

### NPM

To install `node-tak` with npm run

```bash
npm install @tak-ps/node-tak
```

or for use with the global CLI:

```bash
npm install --global @tak-ps/node-tak
```

## CLI Usage Examples

### Initial Setup

The initial run of the CLI will generate a new Connection Profile & Credentials

```
tak
```

Once the profile is generated you can specify it with `--profile <profile>` in any command
or if it is not provided it will be interactively requested

### Streaming COTs

```
tak stream
```

### API Operations

Example of a couple different operations:

```
tak <command> <subcommand>
tak mission list
tak package list
```

### Command Line Args

The following command line args are supported by all or many
of the different command modes

_Use custom P12 cert file_

```
--auth <p12 file to use>
```

_Output Raw JSON where possible_

```
--format json
```

#### Environment Variables

| Variable | Notes |
| -------- | ----- |
| `TAK_P12_PASSWORD` | Avoid the P12 Password prompt when using in a script |

## Platform Support

This library supports both **Node.js** and **React Native** environments through automatic platform detection and optimized transport layers.

### Node.js
Uses native TLS connections via `node:tls` module for optimal performance.

### React Native
Uses `react-native-tcp-socket` for TLS connections with certificate pinning support via `react-native-ssl-pinning`. Binary payloads and FormData bodies are automatically normalized for React Native uploads.

## SDK Usage Examples

### Node.js Usage

```js
import TAK from '@tak-ps/node-tak';

const tak = await TAK.connect('ConnectionID', new URL('https://tak-server.com:8089'), {
    key: conn.auth.key,
    cert: conn.auth.cert
});

tak.on('cot', async (cot: CoT) => {
    console.error('COT', cot); // See node-cot library
}).on('end', async () => {
    console.error(`Connection End`);
}).on('timeout', async () => {
    console.error(`Connection Timeout`);
}).on('ping', async () => {
    console.error(`TAK Server Ping`);
}).on('error', async (err) => {
    console.error(`Connection Error`);
});
```

### React Native Usage

First, install the required peer dependencies:

```bash
npm install react-native-tcp-socket react-native-ssl-pinning
```

For iOS, add to your `Podfile`:
```ruby
pod 'react-native-tcp-socket', :path => '../node_modules/react-native-tcp-socket'
```

Then use the same API – platform detection is automatic:

```js
import TAK from '@tak-ps/node-tak';

// Same API as Node.js - platform detection is automatic
const tak = await TAK.connect('ConnectionID', new URL('https://tak-server.com:8089'), {
    key: conn.auth.key,
    cert: conn.auth.cert
});

tak.on('cot', async (cot) => {
    console.log('COT received:', cot);
}).on('error', async (err) => {
    console.error('Connection Error:', err);
});
```

### React Native Certificate Management

For React Native, certificates are securely stored using the device keychain:

```js
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

// Certificates are automatically stored securely on device
const api = await TAKAPI.init(
    new URL('https://tak-server.com:8443'), 
    new APIAuthCertificate(auth.cert, auth.key)
);

const missions = await api.Mission.list({});
console.log('Missions:', missions);
```

### Basic API Usage (Both Platforms)

```js
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak'

const api = await TAKAPI.init(new URL('TAK SERVER Marti API & Port'), new APIAuthCertificate(auth.cert, auth.key));

const missions = await api.Mission.list(req.query);

console.error(missions);
```

## React Native Setup

### Required Dependencies

```json
{
  "dependencies": {
    "@tak-ps/node-tak": "^11.8.0",
    "react-native-tcp-socket": "^6.0.6",
    "react-native-ssl-pinning": "^1.7.0"
  }
}
```

### Metro Configuration

Add to your `metro.config.js`:

```js
module.exports = {
  resolver: {
    alias: {
      // Optional: Metro already respects the "react-native" export, but aliases help older tooling.
      '@tak-ps/node-tak': '@tak-ps/node-tak/dist/index.native.js',
    },
  },
};
```

### Platform-Specific Features

| Feature | Node.js | React Native |
|---------|---------|--------------|
| TLS Connections | ✅ `node:tls` | ✅ `react-native-tcp-socket` |
| Certificate Auth | ✅ Direct | ✅ Keychain storage |
| CoT Streaming | ✅ | ✅ |
| REST API | ✅ | ✅ |
| File Operations | ✅ | ✅ (Blob-backed uploads/downloads) |
| CLI Tools | ✅ | ❌ |

## Development & Testing

- Build docs locally with `npm run doc`.
- Run lint + unit tests (including React Native mocks) with:

  ```bash
  ROLLUP_SKIP_NATIVE=true npm test
  ```

  The `ROLLUP_SKIP_NATIVE` flag skips optional native Rollup bindings that Vitest does not require.
- React Native behaviour is covered by `test/react-native.test.ts`, which mocks `react-native-ssl-pinning` and the RN platform shim.
- Architecture notes and migration details live in `NODEJS_TO_REACT_NATIVE_CONVERSION.md`.
