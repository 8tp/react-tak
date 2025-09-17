import { describe, it, expect, vi, afterEach } from 'vitest';
import type TAKAPI from '../lib/api.js';
import './setup.js';

afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
});

describe('React Native integration points', () => {
    it('selects the React Native transport factory', async () => {
        vi.doMock('../lib/platform.js', () => ({ isReactNative: true }));

        const createReactNativeTransport = vi.fn(() => ({ marker: 'rn' }));
        vi.doMock('../lib/transport/react-native.js', () => ({
            createReactNativeTransport,
        }));

        const { getDefaultTransportFactory } = await import('../lib/transport/factory.js');
        const factory = getDefaultTransportFactory();
        const params = {
            url: new URL('https://example.com:8089'),
            auth: {
                cert: 'cert',
                key: 'key',
            },
        } as const;

        const transport = await factory(params);

        expect(createReactNativeTransport).toHaveBeenCalledWith(params);
        expect(transport).toEqual({ marker: 'rn' });
    });

    it('uses react-native-ssl-pinning for certificate auth', async () => {
        vi.doMock('../lib/platform.js', () => ({ isReactNative: true }));

        const bodyString = JSON.stringify({ ok: true });
        const fetchMock = vi.fn().mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'application/json' },
            bodyString,
        });

        vi.doMock('react-native-ssl-pinning', () => ({ fetch: fetchMock }));

        const { APIAuthCertificate } = await import('../lib/auth.js');

        const auth = new APIAuthCertificate('cert-data', 'key-data');
        const fakeApi = { url: new URL('https://tak.example.com') } as unknown as TAKAPI;

        const response = await auth.fetch(fakeApi, new URL('https://tak.example.com/resource'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ping: true }),
        });

        expect(fetchMock).toHaveBeenCalledWith('https://tak.example.com/resource', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ping: true }),
            sslPinning: {
                cert: 'cert-data',
                key: 'key-data',
            },
            timeoutInterval: 60000,
        }));

        expect(response.headers.get('content-type')).toBe('application/json');
        expect(await response.json()).toEqual({ ok: true });
        expect(response.body).toBeInstanceOf(Uint8Array);

        const buffer = await response.arrayBuffer();
        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(new Uint8Array(buffer)).toEqual(response.body as Uint8Array);
    });

    it('normalizes binary payloads for React Native', async () => {
        vi.doMock('../lib/platform.js', () => ({ isReactNative: true }));
        const { prepareFormDataPart, prepareRequestBody } = await import('../lib/utils/binary.js');

        const bytes = new Uint8Array([1, 2, 3]);

        const part = await prepareFormDataPart(bytes, {
            filename: 'data.bin',
            contentType: 'application/octet-stream',
        });

        expect(typeof part.options).toBe('string');
        expect(part.options).toBe('data.bin');
        expect(part.value).toBeInstanceOf(Blob);

        const blob = part.value as Blob;
        expect(blob.type).toBe('application/octet-stream');
        const blobBytes = new Uint8Array(await blob.arrayBuffer());
        expect(blobBytes).toEqual(bytes);

        const body = await prepareRequestBody(bytes, {
            contentType: 'application/octet-stream',
        });

        expect(body).toBeInstanceOf(Blob);
        const bodyBytes = new Uint8Array(await (body as Blob).arrayBuffer());
        expect(bodyBytes).toEqual(bytes);

        const stringPart = await prepareFormDataPart('hello', { filename: 'greeting.txt' });
        expect(stringPart.value).toBe('hello');
        expect(stringPart.options).toBe('greeting.txt');

        const stringBody = await prepareRequestBody('hello world');
        expect(stringBody).toBe('hello world');
    });
});
