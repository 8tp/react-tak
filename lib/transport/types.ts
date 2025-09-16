import type { TAKAuthConfig } from '../auth.js';

export type TransportEventHandlers = {
    connect?: () => void;
    secureConnect?: () => void;
    data?: (chunk: string) => void;
    timeout?: () => void;
    end?: () => void;
    error?: (error: Error) => void;
};

export interface TAKTransport {
    setHandlers(handlers: TransportEventHandlers): void;
    connect(): Promise<void>;
    send(payload: string): Promise<void>;
    destroy(): void;
}

export interface TransportFactoryParams {
    url: URL;
    auth: TAKAuthConfig;
}

export type TransportFactory = (
    params: TransportFactoryParams
) => Promise<TAKTransport> | TAKTransport;
