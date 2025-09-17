import { describe, it, expect } from 'vitest';
import './setup.js';

import TAK, { CoT, type TAKTransport, type TransportFactory } from '../index.js';

class FakeTransport implements TAKTransport {
    handlers: Parameters<TAKTransport['setHandlers']>[0] = {};
    connectCalls = 0;
    sendPayloads: string[] = [];
    destroyed = false;

    setHandlers(handlers: Parameters<TAKTransport['setHandlers']>[0]): void {
        this.handlers = handlers;
    }

    async connect(): Promise<void> {
        this.connectCalls += 1;
        if (this.handlers.connect) this.handlers.connect();
        if (this.handlers.secureConnect) this.handlers.secureConnect();
    }

    async send(payload: string): Promise<void> {
        this.sendPayloads.push(payload);
    }

    destroy(): void {
        this.destroyed = true;
    }
}

describe('injected transport', () => {
    it('uses custom transport factory', async () => {
        const transport = new FakeTransport();
        const factory: TransportFactory = () => transport;

        const tak = await TAK.connect(
            new URL('ssl://example.com:8089'),
            {
                cert: 'fake-cert',
                key: 'fake-key',
            },
            { transportFactory: factory }
        );

        expect(transport.connectCalls).toBe(1);

        await tak.write([CoT.ping()]);
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(transport.sendPayloads.length).toBeGreaterThan(0);

        tak.destroy();
        expect(transport.destroyed).toBe(true);
    });
});
