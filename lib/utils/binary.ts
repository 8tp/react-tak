import { isReactNative } from '../platform.js';

import type { Readable } from 'node:stream';

export type BinaryLike = Readable | Uint8Array | ArrayBuffer | Blob | string;

export type FormDataAppendOptions = string | { filename?: string; contentType?: string };

export interface FormDataLike {
    append(name: string, value: unknown, options?: FormDataAppendOptions): void;
}

export interface FormDataPart {
    value: unknown;
    options?: FormDataAppendOptions;
}

export interface BinaryFetchResponse {
    body?: unknown;
    arrayBuffer?: () => Promise<ArrayBuffer>;
    text?: () => Promise<string>;
}

function isReadable(value: unknown): value is Readable {
    return !!value && typeof (value as { pipe?: unknown }).pipe === 'function';
}

function hasBlob(): value is typeof Blob {
    return typeof Blob !== 'undefined';
}

async function toNodeBuffer(body: Exclude<BinaryLike, Readable>): Promise<Uint8Array> {
    if (body instanceof Uint8Array) return body;
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (typeof body === 'string') {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(body, 'utf-8');
        }
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(body);
        }
        throw new Error('No available encoder for string body');
    }
    if (hasBlob() && body instanceof Blob) {
        return new Uint8Array(await body.arrayBuffer());
    }
    throw new Error('Unsupported binary body type');
}

export interface BinaryBodyOptions {
    filename?: string;
    contentType?: string;
}

function cleanupOptions(options: { filename?: string; contentType?: string }): FormDataAppendOptions | undefined {
    const cleaned: { filename?: string; contentType?: string } = {};
    if (options.filename) cleaned.filename = options.filename;
    if (options.contentType) cleaned.contentType = options.contentType;
    return Object.keys(cleaned).length ? cleaned : undefined;
}

export async function prepareFormDataPart(
    body: BinaryLike,
    opts: BinaryBodyOptions = {}
): Promise<FormDataPart> {
    if (isReactNative) {
        if (!hasBlob()) {
            throw new Error('FormData uploads require Blob support in this environment');
        }

        if (typeof body === 'string') {
            return {
                value: body,
                options: opts.filename,
            };
        }

        if (body instanceof Blob) {
            return {
                value: body,
                options: opts.filename,
            };
        }

        if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
            const array = body instanceof Uint8Array ? body : new Uint8Array(body);
            return {
                value: new Blob([array], { type: opts.contentType ?? 'application/octet-stream' }),
                options: opts.filename,
            };
        }

        throw new Error('Unsupported FormData body type for React Native');
    }

    if (isReadable(body)) {
        return {
            value: body,
            options: cleanupOptions({ filename: opts.filename, contentType: opts.contentType }),
        };
    }

    const buffer = await toNodeBuffer(body);

    if (typeof Buffer !== 'undefined') {
        return {
            value: Buffer.from(buffer),
            options: cleanupOptions({ filename: opts.filename, contentType: opts.contentType }),
        };
    }

    return {
        value: buffer,
        options: cleanupOptions({ filename: opts.filename, contentType: opts.contentType }),
    };
}

export async function prepareRequestBody(
    body: BinaryLike,
    opts: BinaryBodyOptions = {}
): Promise<Readable | Uint8Array | Blob | string> {
    if (isReactNative) {
        if (typeof body === 'string') return body;

        if (!hasBlob()) {
            throw new Error('Binary request bodies require Blob support in this environment');
        }

        if (body instanceof Blob) return body;
        if (body instanceof Uint8Array) {
            return new Blob([body], { type: opts.contentType ?? 'application/octet-stream' });
        }
        if (body instanceof ArrayBuffer) {
            return new Blob([new Uint8Array(body)], { type: opts.contentType ?? 'application/octet-stream' });
        }

        throw new Error('Unsupported request body type for React Native');
    }

    if (isReadable(body)) return body;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return body;

    if (body instanceof Uint8Array) {
        return typeof Buffer !== 'undefined' ? Buffer.from(body) : body;
    }

    if (body instanceof ArrayBuffer) {
        const value = new Uint8Array(body);
        return typeof Buffer !== 'undefined' ? Buffer.from(value) : value;
    }

    if (typeof body === 'string') return body;

    if (hasBlob() && body instanceof Blob) {
        const array = new Uint8Array(await body.arrayBuffer());
        return typeof Buffer !== 'undefined' ? Buffer.from(array) : array;
    }

    throw new Error('Unsupported request body type for Node environment');
}
