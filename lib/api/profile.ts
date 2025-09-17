import Commands from '../commands.js';
import { encodeUtf8 } from '../utils/encoding.js';
import type { BinaryFetchResponse } from '../utils/binary.js';

export default class ProfileCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    async connection(opts: {
        syncSecago: number,
        clientUid: string
    }): Promise<Uint8Array> {
        const url = new URL(`/Marti/api/device/profile/connection`, this.api.url);

        url.searchParams.append('syncSecago', String(opts.syncSecago));
        url.searchParams.append('clientUid', opts.clientUid);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true) as BinaryFetchResponse;

        if (res.body instanceof Uint8Array) {
            return res.body;
        }

        if (typeof res.arrayBuffer === 'function') {
            return new Uint8Array(await res.arrayBuffer());
        }

        if (typeof res.body === 'string') {
            return encodeUtf8(res.body);
        }

        if (typeof res.text === 'function') {
            return encodeUtf8(await res.text());
        }

        throw new Error('Unsupported response body type for profile connection');
    }
}
