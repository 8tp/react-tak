import { Type, Static } from '@sinclair/typebox';
import type { Readable } from 'node:stream';
import Commands from '../commands.js';
import { encodeUtf8 } from '../utils/encoding.js';
import type { BinaryFetchResponse } from '../utils/binary.js';

export const ExportInput = Type.Object({
    startTime: Type.String(),
    endTime: Type.String(),
    groups: Type.Array(Type.String()),
    format: Type.String({ enum: ['kmz', 'kml'] }),
    interval: Type.Optional(Type.Number()),
    multiTrackThreshold: Type.Optional(Type.String()),
    extendedData: Type.Optional(Type.Boolean()),
    optimizeExport: Type.Optional(Type.Boolean()),
});

/**
 * @class
 */
export default class ExportCommands extends Commands {
    schema = {};

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async export(query: Static<typeof ExportInput>): Promise<Readable | Uint8Array> {
        const url = new URL(`/Marti/ExportMissionKML`, this.api.url);

        const params = new URLSearchParams();
        let q: keyof Static<typeof ExportInput>;
        for (q in query) {
            if (query[q] !== undefined ) {
                params.append(q, String(query[q]));
            }
        }

        const res = await this.api.fetch(url, {
            method: 'POST',
            body: params
        }, true) as BinaryFetchResponse;

        if (res.body instanceof Uint8Array) return res.body;

        if (res.body) return res.body as Readable;

        if (typeof res.arrayBuffer === 'function') {
            return new Uint8Array(await res.arrayBuffer());
        }

        if (typeof res.text === 'function') {
            return encodeUtf8(await res.text());
        }

        throw new Error('Unsupported response body type for export');
    }
}
