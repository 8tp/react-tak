import './setup.js';
import test from 'tape';

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

test('TAK uses injected transport factory', async (t) => {
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

    t.equal(transport.connectCalls, 1, 'transport connect called once');

    await tak.write([CoT.ping()]);
    await new Promise((resolve) => setTimeout(resolve, 10));

    t.ok(transport.sendPayloads.length > 0, 'transport received queued writes');

    tak.destroy();
    t.ok(transport.destroyed, 'transport destroyed on tak.destroy');

    t.end();
});
