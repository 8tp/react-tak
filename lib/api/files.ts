import type { ParsedArgs } from 'minimist'
import mime from 'mime';
import Commands, { CommandOutputFormat } from '../commands.js';
import { TAKList } from './types.js';
import { Type, Static } from '@sinclair/typebox';
import { encodeUtf8 } from '../utils/encoding.js';
import { isReactNative } from '../platform.js';
import { prepareFormDataPart, prepareRequestBody, type BinaryLike, type FormDataLike } from '../utils/binary.js';

type FormDataCtor = new (...args: unknown[]) => FormDataLike;

async function getFormDataCtor(): Promise<FormDataCtor> {
    // Prefer global FormData (browser/RN)
    if (typeof FormData !== 'undefined') return FormData as unknown as FormDataCtor;
    // Fallback to Node's form-data package
    const mod = await import('form-data');
    const ctorCandidate = (mod as { default?: unknown }).default ?? mod;
    return ctorCandidate as FormDataCtor;
}

export const Content = Type.Object({
  UID: Type.String(),
  SubmissionDateTime: Type.String(),
  Keywords: Type.Array(Type.String()),
  MIMEType: Type.String(),
  SubmissionUser: Type.String(),
  PrimaryKey: Type.String(),
  Hash: Type.String(),
  CreatorUid: Type.String(),
  Name: Type.String()
});

export const TAKList_Content = TAKList(Type.Object({
    filename: Type.String(),
    keywords: Type.Array(Type.String()),
    mimeType: Type.String(),
    name: Type.String(),
    submissionTime: Type.String(),
    submitter: Type.String(),
    uid: Type.String(),
    size: Type.Integer(),
}));

export const Config = Type.Object({
    uploadSizeLimit: Type.Integer()
})

export default class FileCommands extends Commands {
    schema = {
        list: {
            description: 'List Files',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list') {
            const list = await this.list();

            if (args.format === 'json') {
                return list;
            } else {
                return list.data.map((data) => {
                    return data.filename;
                }).join('\n');
            }
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async list(): Promise<Static<typeof TAKList_Content>> {
        const url = new URL(`/Marti/api/sync/search`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async meta(hash: string): Promise<string> {
        const url = new URL(`/Marti/sync/${encodeURIComponent(hash)}/metadata`, this.api.url);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        const body = await res.text();

        return body;
    }

    async download(hash: string): Promise<Readable | Uint8Array> {
        const url = new URL(`/Marti/sync/content`, this.api.url);
        url.searchParams.append('hash', hash);

        const res = await this.api.fetch(url, {
            method: 'GET'
        }, true);

        if (res.body instanceof Uint8Array) return res.body;

        if (res.body) return res.body as Readable;

        if (typeof res.arrayBuffer === 'function') {
            return new Uint8Array(await res.arrayBuffer());
        }

        if (typeof res.text === 'function') {
            return encodeUtf8(await res.text());
        }

        throw new Error('Unsupported response body type for download');
    }

    async adminDelete(hash: string) {
        const url = new URL(`/Marti/api/files/${hash}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    async delete(hash: string) {
        const url = new URL(`/Marti/sync/delete`, this.api.url);
        url.searchParams.append('hash', hash)

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    // TODO Return a Content Object

    /**
     * Update a Package that should appear in the Public Data Packages List
     */
    async uploadPackage(opts: {
        name: string;
        creatorUid: string;
        hash: string;
        keywords?: string[];
        mimetype?: string;
        groups?: string[];
    }, body: BinaryLike): Promise<string> {
        const url = new URL(`/Marti/sync/missionupload`, this.api.url);
        url.searchParams.append('filename', opts.name)
        url.searchParams.append('creatorUid', opts.creatorUid)
        url.searchParams.append('hash', opts.hash)

        if (opts.mimetype) {
            url.searchParams.append('mimetype', opts.mimetype)
        }

        // Needs this keywordt to appear in public list
        url.searchParams.append('keyword', 'missionpackage');

        if (opts.keywords) {
            for (const keyword of opts.keywords) {
                if (keyword.toLowerCase() === 'missionpackage') continue;
                url.searchParams.append('keyword', keyword);
            }
        }

        if (opts.groups) {
            for (const group of opts.groups) {
                // This is intentionally case sensitive due to an apparent bug in TAK server
                url.searchParams.append('Groups', group);
            }
        }

        const FormDataCtor = await getFormDataCtor();
        const form = new FormDataCtor();
        const part = await prepareFormDataPart(body, {
            filename: opts.name,
            contentType: opts.mimetype,
        });

        if (part.options !== undefined) {
            form.append('assetfile', part.value, part.options);
        } else {
            form.append('assetfile', part.value);
        }

        const res = await this.api.fetch(url, {
            method: 'POST',
            body: form
        }) as string;

        return res;
    }

    /**
     * Update a Package that will not appear in the Public Data Packages List
     * used primarily for sharing files between TAK clients
     */
    async upload(opts: {
        name: string;
        contentLength: number;
        contentType?: string;
        keywords: string[];
        creatorUid: string;
        latitude?: string;
        longitude?: string;
        altitude?: string;
    }, body: BinaryLike): Promise<Static<typeof Content>> {
        const url = new URL(`/Marti/sync/upload`, this.api.url);
        url.searchParams.append('name', opts.name)
        url.searchParams.append('keywords', opts.keywords.join(','))
        url.searchParams.append('creatorUid', opts.creatorUid)
        if (opts.altitude) url.searchParams.append('altitude', opts.altitude);
        if (opts.longitude) url.searchParams.append('longitude', opts.longitude);
        if (opts.latitude) url.searchParams.append('latitude', opts.latitude);

        const requestBody = await prepareRequestBody(body, {
            contentType: opts.contentType ?? mime.getType(opts.name) ?? undefined,
        });

        const res = await this.api.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': opts.contentType ? opts.contentType : mime.getType(opts.name),
                ...(isReactNative ? {} : { 'Content-Length': opts.contentLength })
            },
            body: requestBody
        });

        return JSON.parse(res);
    }

    async count() {
        const url = new URL('/Marti/api/files/metadata/count', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async config(): Promise<Static<typeof Config>> {
        const url = new URL('/files/api/config', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
