import fetch from './fetch.js';
import { Type, type Static } from '@sinclair/typebox';
import TAKAPI from './api.js';
import stream2buffer  from './stream.js';
import { isReactNative } from './platform.js';
import { encodeUtf8, decodeUtf8 } from './utils/encoding.js';
import type { Dispatcher } from 'undici';

type AuthRequestOptions = RequestInit & {
    timeout?: number;
};

/**
 * Store the TAK Client Certificate for a connection
 */
export const TAKAuth = Type.Object({
    cert: Type.String(),
    key: Type.String(),
    passphrase: Type.Optional(Type.String()),
    ca: Type.Optional(Type.String()),
    rejectUnauthorized: Type.Optional(Type.Boolean())
})

export type TAKAuthConfig = Static<typeof TAKAuth>;

export class APIAuth {
    async init(api: TAKAPI) { // eslint-disable-line @typescript-eslint/no-unused-vars

    }

    async fetch(api: TAKAPI, url: URL, opts: AuthRequestOptions = {}): Promise<any> {
        return await fetch(url, opts);
    }
}

export class APIAuthPassword extends APIAuth {
    username: string;
    password: string;
    jwt: string;

    constructor(username: string, password: string) {
        super();
        this.username = username;
        this.password = password;
        this.jwt = '';
    }

    async init(api: TAKAPI) {
        const { token } = await api.OAuth.login({
            username: this.username,
            password: this.password
        })

        this.jwt = token;
    }

    async fetch(api: TAKAPI, url: URL, opts: AuthRequestOptions = {}): Promise<any> {
        const init: AuthRequestOptions = { ...opts };
        const headers = mergeHeaders(init.headers);

        init.credentials = 'include';

        if (!headers.has('Authorization') && this.jwt) {
            headers.set('Authorization', `Bearer ${this.jwt}`);
        }

        init.headers = headers;

        return await fetch(url, init);
    }
}

export class APIAuthToken extends APIAuth {
    jwt?: string;

    constructor(jwt: string) {
        super();
        this.jwt = jwt;
    }

    async fetch(api: TAKAPI, url: URL, opts: AuthRequestOptions = {}): Promise<any> {
        const init: AuthRequestOptions = { ...opts };
        const headers = mergeHeaders(init.headers);

        init.credentials = 'include';

        if (!headers.has('Authorization') && this.jwt) {
            headers.set('Authorization', `Bearer ${this.jwt}`);
        }

        init.headers = headers;

        console.error('OPTIONS', headersToObject(headers));

        return await fetch(url, init);
    }
}

export class APIAuthCertificate extends APIAuth {
    cert: string;
    key: string;

    constructor(cert: string, key: string) {
        super();
        this.cert = cert;
        this.key = key;
    }

    async fetch(api: TAKAPI, url: URL, opts: AuthRequestOptions = {}): Promise<any> {
        if (isReactNative) {
            return await this.reactNativeFetch(api, url, opts);
        }

        return await this.nodeFetch(api, url, opts);
    }

    private async nodeFetch(api: TAKAPI, url: URL, opts: AuthRequestOptions): Promise<any> {
        const { Client } = await import('undici');
        const client = new Client(api.url.origin, {
            connect: {
                key: this.key,
                cert: this.cert,
                rejectUnauthorized: false,
            }
        });

        const headers = mergeHeaders(opts.headers);
        const requestHeaders = headersToObject(headers);

        const requestOptions: Dispatcher.RequestOptions = {
            path: String(url).replace(api.url.origin, ''),
            method: ((opts.method ?? 'GET').toUpperCase()) as Dispatcher.HttpMethod,
            body: opts.body as Dispatcher.DispatchOptions['body'],
            headers: requestHeaders
        };

        const res = await client.request(requestOptions);

        const responseHeaders = new Map<string, string>();
        for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === 'string') responseHeaders.set(key.toLowerCase(), value);
        }

        return {
            status: res.statusCode,
            body: res.body,
            // Make this similiar to the fetch standard
            headers: {
                get: (key: string) => responseHeaders.get(key.toLowerCase()) ?? null,
            },
            text: async () => {
                return String(await stream2buffer(res.body));
            },
            json: async () => {
                return JSON.parse(String(await stream2buffer(res.body)));
            },
        };
    }

    private async reactNativeFetch(api: TAKAPI, url: URL, opts: AuthRequestOptions): Promise<any> {
        const module = await import('react-native-ssl-pinning');

        if (opts.body && typeof opts.body !== 'string') {
            throw new Error('React Native certificate auth currently supports string bodies only');
        }

        const headers = headersToObject(mergeHeaders(opts.headers));

        const stringBody = typeof opts.body === 'string' ? opts.body : undefined;

        const response = await module.fetch(String(url), {
            method: opts.method || 'GET',
            headers,
            body: stringBody,
            sslPinning: {
                cert: this.cert,
                key: this.key,
            },
            timeoutInterval: opts.timeout ?? 60000,
        });

        const headerMap = new Map<string, string>();
        if (response.headers) {
            for (const [key, value] of Object.entries(response.headers)) {
                if (typeof value === 'string') headerMap.set(key.toLowerCase(), value);
            }
        }

        const bodyBytes = Array.isArray((response as { bodyBytes?: number[] }).bodyBytes) ? Uint8Array.from((response as { bodyBytes?: number[] }).bodyBytes as number[]) : undefined;
        const bodyString = response.bodyString ?? (bodyBytes ? decodeUtf8(bodyBytes) : '');

        const bodyArray = bodyBytes ?? (bodyString ? encodeUtf8(bodyString) : undefined);

        return {
            status: response.status,
            headers: {
                get: (key: string) => headerMap.get(key.toLowerCase()) ?? null,
            },
            text: async () => bodyString,
            json: async () => JSON.parse(bodyString || '{}'),
            arrayBuffer: async () => {
                if (!bodyArray) return new ArrayBuffer(0);
                const buffer = new ArrayBuffer(bodyArray.byteLength);
                new Uint8Array(buffer).set(bodyArray);
                return buffer;
            },
            body: bodyArray,
        };
    }
}

function mergeHeaders(init?: HeadersInit): Headers {
    if (!init) return new Headers();
    return new Headers(init);
}

function headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
        result[key.toLowerCase()] = value;
    });
    return result;
}
