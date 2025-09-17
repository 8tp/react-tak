import { encodeUtf8 } from './utils/encoding.js';

type EventEmitterLike = {
    on(event: 'data', listener: (chunk: unknown) => void): unknown;
    on(event: 'end', listener: () => void): unknown;
    on(event: 'error', listener: (error: unknown) => void): unknown;
};

function toUint8Array(chunk: unknown): Uint8Array {
    if (chunk instanceof Uint8Array) return chunk;

    if (typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function' && Buffer.isBuffer(chunk)) {
        return new Uint8Array(chunk);
    }

    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk);
    }

    if (typeof chunk === 'string') {
        return encodeUtf8(chunk);
    }

    if (chunk && typeof chunk === 'object' && 'buffer' in chunk) {
        const view = chunk as ArrayBufferView & { buffer: ArrayBuffer };
        if (view.buffer instanceof ArrayBuffer) {
            return new Uint8Array(view.buffer, view.byteOffset ?? 0, view.byteLength ?? view.buffer.byteLength);
        }
    }

    throw new Error('Unsupported stream chunk type');
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
}

export default async function stream2buffer(stream: EventEmitterLike): Promise<Uint8Array> {
    return await new Promise<Uint8Array>((resolve, reject) => {
        const chunks: Uint8Array[] = [];

        const handleData = (chunk: unknown) => {
            try {
                chunks.push(toUint8Array(chunk));
            } catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        };

        const handleEnd = () => {
            resolve(concatChunks(chunks));
        };

        const handleError = (error: unknown) => {
            reject(error instanceof Error ? error : new Error(String(error)));
        };

        stream.on('data', handleData);
        stream.on('end', handleEnd);
        stream.on('error', handleError);
    });
}
