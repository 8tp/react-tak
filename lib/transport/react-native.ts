import type { TAKTransport, TransportEventHandlers, TransportFactoryParams } from './types.js';

// Lazy-loaded module reference so React Native bundlers can tree-shake properly
let tcpSocketModule: typeof import('react-native-tcp-socket') | undefined;

async function loadModule() {
    if (!tcpSocketModule) {
        tcpSocketModule = await import('react-native-tcp-socket');
    }
    return tcpSocketModule;
}

let decoder: TextDecoder | undefined;

function decodeChunk(data: ArrayBufferView | ArrayBuffer | string): string {
    if (typeof data === 'string') return data;

    if (typeof TextDecoder === 'undefined') {
        if (data instanceof ArrayBuffer) return String.fromCharCode(...new Uint8Array(data));
        if ('buffer' in data && data.buffer instanceof ArrayBuffer) {
            return String.fromCharCode(...new Uint8Array(data.buffer as ArrayBuffer));
        }
        return '';
    }

    decoder = decoder ?? new TextDecoder();

    if (data instanceof ArrayBuffer) {
        return decoder.decode(new Uint8Array(data));
    }

    if ('buffer' in data && data.buffer instanceof ArrayBuffer) {
        return decoder.decode(data as ArrayBufferView);
    }

    return '';
}

class ReactNativeTransport implements TAKTransport {
    private socket?: import('react-native-tcp-socket').TLSSocket;
    private handlers: TransportEventHandlers = {};
    private readonly params: TransportFactoryParams;

    constructor(params: TransportFactoryParams) {
        this.params = params;
    }

    setHandlers(handlers: TransportEventHandlers): void {
        this.handlers = handlers;
    }

    async connect(): Promise<void> {
        const module = await loadModule();

        return await new Promise((resolve, reject) => {
            try {
                this.socket = module.createConnection({
                    host: this.params.url.hostname,
                    port: Number(this.params.url.port),
                    tls: true,
                    cert: this.params.auth.cert,
                    key: this.params.auth.key,
                    ca: this.params.auth.ca ? [this.params.auth.ca] : undefined,
                    rejectUnauthorized: this.params.auth.rejectUnauthorized ?? false,
                }, () => {
                    this.handlers.connect?.();
                    this.handlers.secureConnect?.();
                    resolve();
                });
            } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
                return;
            }

            const socket = this.socket;
            if (!socket) {
                reject(new Error('Failed to instantiate React Native transport socket'));
                return;
            }

            socket.on('data', (data: ArrayBuffer | ArrayBufferView | string) => {
                this.handlers.data?.(decodeChunk(data));
            });

            socket.on('error', (error: Error) => {
                this.handlers.error?.(error);
                reject(error);
            });

            socket.on('close', () => {
                this.handlers.end?.();
            });
        });
    }

    async send(payload: string): Promise<void> {
        const socket = this.socket;
        if (!socket) throw new Error('Transport not connected');
        socket.write(payload);
    }

    destroy(): void {
        if (!this.socket) return;
        this.socket.removeAllListeners();
        this.socket.destroy();
        this.socket = undefined;
    }
}

export function createReactNativeTransport(
    params: TransportFactoryParams
): TAKTransport {
    return new ReactNativeTransport(params);
}
