import EventEmitter from 'eventemitter3';
import type { Static } from '@sinclair/typebox';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import type { CoTOptions } from '@tak-ps/node-cot';

import TAKAPI from './lib/api.js';
import { TAKAuth } from './lib/auth.js';
import type { TAKTransport, TransportFactory } from './lib/transport/types.js';
import { createReactNativeTransport } from './lib/transport/react-native.js';
export * from './lib/auth.js';

/* eslint-disable no-control-regex */
export const REGEX_CONTROL = /[\u000B-\u001F\u007F-\u009F]/g;

// Match <event .../> or <event> but not <events>
export const REGEX_EVENT = /(<event[ >][\s\S]*?<\/event>)([\s\S]*)/

function scheduleTask(cb: () => void): void {
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(cb);
    } else {
        setTimeout(cb, 0);
    }
}

function createId(): string {
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `tak-${Math.random().toString(36).slice(2)}`;
}

export interface PartialCoT {
    event: string;
    remainder: string;
}

export type TAKOptions = {
    id?: number | string,
    type?: string,
    cot?: CoTOptions,
    transportFactory?: TransportFactory,
}

export default class TAK extends EventEmitter {
    id: number | string;
    type: string;
    url: URL;
    auth: Static<typeof TAKAuth>;
    open: boolean;
    destroyed: boolean;
    queue: string[];
    writing: boolean;

    cotOptions: CoTOptions;

    transportFactory: TransportFactory;
    transport?: TAKTransport;
    partialBuffer: string;

    pingInterval?: ReturnType<typeof setTimeout>;
    version?: string;

    constructor(
        url: URL,
        auth: Static<typeof TAKAuth>,
        opts: TAKOptions = {}
    ) {
        super();

        if (!opts) opts = {};

        this.id = opts.id || createId();
        this.type = opts.type || 'unknown';

        this.url = url;
        this.auth = auth;

        this.writing = false;

        this.cotOptions = opts.cot || {};

        this.open = false;
        this.destroyed = false;

        this.queue = [];

        this.transportFactory = opts.transportFactory ?? ((params) => createReactNativeTransport(params));
        this.partialBuffer = '';
    }

    static async connect(
        url: URL,
        auth: Static<typeof TAKAuth>,
        opts: TAKOptions = {}
    ): Promise<TAK> {
        const tak = new TAK(url, auth, opts);

        if (url.protocol === 'ssl:') {
            if (!tak.auth.cert) throw new Error('auth.cert required');
            if (!tak.auth.key) throw new Error('auth.key required');
            return await tak.connect_ssl();
        } else {
            throw new Error('Unknown TAK Server Protocol');
        }
    }

    async connect_ssl(): Promise<TAK> {
        this.destroyed = false;
        this.open = false;
        this.partialBuffer = '';

        if (this.transport) {
            this.transport.destroy();
        }

        const transport = await this.transportFactory({
            url: this.url,
            auth: this.auth
        });

        this.transport = transport;
        this.attachTransportHandlers(transport);

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            void this.ping();
        }, 5000);

        await transport.connect();

        return this;
    }

    private attachTransportHandlers(transport: TAKTransport): void {
        transport.setHandlers({
            connect: () => {
                console.log(`ok - ${this.id} @ connect`);
            },
            secureConnect: () => {
                console.log(`ok - ${this.id} @ secure`);
                this.emit('secureConnect');
                void this.ping();
            },
            data: (chunk: string) => {
                void this.handleIncomingData(chunk);
            },
            timeout: () => {
                this.emit('timeout');
            },
            error: (err: Error) => {
                this.emit('error', err);
            },
            end: () => {
                this.open = false;
                this.emit('end');
            }
        });
    }

    private async handleIncomingData(chunk: string): Promise<void> {
        this.partialBuffer = this.partialBuffer + chunk;

        let result = TAK.findCoT(this.partialBuffer);
        while (result && result.event) {
            try {
                const cot = await CoTParser.from_xml(result.event, this.cotOptions);

                if (cot.raw.event._attributes.type === 't-x-c-t-r') {
                    this.open = true;
                    this.emit('ping');
                } else if (
                    cot.raw.event._attributes.type === 't-x-takp-v'
                    && cot.raw.event.detail
                    && cot.raw.event.detail.TakControl
                    && cot.raw.event.detail.TakControl.TakServerVersionInfo
                    && cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes
                ) {
                    this.version = cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes.serverVersion;
                } else {
                    this.emit('cot', cot);
                }
            } catch (e) {
                console.log('Error parsing', e, chunk);
            }

            this.partialBuffer = result.remainder;
            result = TAK.findCoT(this.partialBuffer);
        }
    }

    async reconnect(): Promise<void> {
        this.destroy();
        this.destroyed = false;
        await this.connect_ssl();
    }

    destroy(): void {
        this.destroyed = true;
        if (this.transport) {
            this.transport.destroy();
            this.transport = undefined;
        }

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = undefined;
        }

        this.partialBuffer = '';
    }

    async ping(): Promise<void> {
        this.write([CoT.ping()]);
    }

    async writer(body: string): Promise<void> {
        if (!this.transport) throw new Error('A Connection Client must first be created before it can be written');

        await this.transport.send(`${body}\n`);
    }

    async process(): Promise<void> {
        this.writing = true;
        while (this.queue.length) {
            const body = this.queue.shift();
            if (!body) continue;
            await this.writer(body);
        }

        await this.writer('');

        if (this.queue.length) {
            scheduleTask(() => {
                void this.process();
            });
        } else {
            this.writing = false;
        }
    }

    async write(cots: CoT[]): Promise<void> {
        for (const cot of cots) {
            this.queue.push(await CoTParser.to_xml(cot));
        }

        if (this.queue.length && !this.writing) {
            this.process();
        }
    }

    write_xml(body: string): void {
        this.queue.push(body);

        if (this.queue.length && !this.writing) {
            this.process();
        }
    }

    // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
    static findCoT(str: string): null | PartialCoT {
        str = str.replace(REGEX_CONTROL, "");

        const match = str.match(REGEX_EVENT); // find first CoT
        if (!match) return null;

        return {
            event: match[1],
            remainder: match[2],
        };
    }
}

export {
    TAKAPI,
    CoT,
}
