import tls from 'node:tls';
import type { TLSSocket } from 'node:tls';

import type { TAKTransport, TransportEventHandlers, TransportFactoryParams } from './types.js';

class NodeTransport implements TAKTransport {
    private socket?: TLSSocket;
    private handlers: TransportEventHandlers = {};
    private readonly params: TransportFactoryParams;

    constructor(params: TransportFactoryParams) {
        this.params = params;
    }

    setHandlers(handlers: TransportEventHandlers): void {
        this.handlers = handlers;
    }

    async connect(): Promise<void> {
        if (!this.params.auth.cert) throw new Error('auth.cert required');
        if (!this.params.auth.key) throw new Error('auth.key required');

        return await new Promise((resolve, reject) => {
            try {
                this.socket = tls.connect({
                    host: this.params.url.hostname,
                    port: parseInt(this.params.url.port),
                    rejectUnauthorized: this.params.auth.rejectUnauthorized ?? false,
                    cert: this.params.auth.cert,
                    key: this.params.auth.key,
                    passphrase: this.params.auth.passphrase,
                    ca: this.params.auth.ca,
                });
            } catch (err) {
                return reject(err instanceof Error ? err : new Error(String(err)));
            }

            const socket = this.socket;
            if (!socket) return reject(new Error('Unable to establish TLS socket'));

            socket.setNoDelay();

            socket.on('connect', () => {
                const status = `${socket.authorized} - ${socket.authorizationError ?? 'none'}`;
                console.error(`ok - connect:${status}`);
                this.handlers.connect?.();
            });

            socket.once('secureConnect', () => {
                const status = `${socket.authorized} - ${socket.authorizationError ?? 'none'}`;
                console.error(`ok - secure:${status}`);
                this.handlers.secureConnect?.();
                resolve();
            });

            socket.on('data', (data: Buffer) => {
                this.handlers.data?.(data.toString());
            });

            socket.on('timeout', () => {
                this.handlers.timeout?.();
            });

            socket.on('end', () => {
                this.handlers.end?.();
            });

            socket.on('error', (error: Error) => {
                if (socket.listenerCount('secureConnect') > 0) {
                    reject(error);
                }
                this.handlers.error?.(error);
            });
        });
    }

    async send(payload: string): Promise<void> {
        if (!this.socket) throw new Error('Transport not connected');

        this.socket.write(payload);
    }

    destroy(): void {
        if (!this.socket) return;

        this.socket.removeAllListeners();
        this.socket.destroy();
        this.socket = undefined;
    }
}

export function createNodeTransport(
    params: TransportFactoryParams
): TAKTransport {
    return new NodeTransport(params);
}
