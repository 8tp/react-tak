declare module 'react-native-tcp-socket' {
    export type TLSSocket = {
        write(data: string | ArrayBufferView | ArrayBuffer): void;
        destroy(): void;
        removeAllListeners(): void;
        on(event: 'connect', listener: () => void): void;
        on(event: 'data', listener: (data: ArrayBuffer | ArrayBufferView | string) => void): void;
        on(event: 'error', listener: (error: Error) => void): void;
        on(event: 'close', listener: () => void): void;
    };

    export type TLSCreateOptions = {
        host: string;
        port: number;
        tls: true;
        cert: string;
        key: string;
        ca?: string[];
        rejectUnauthorized?: boolean;
    };

    export function createConnection(
        options: TLSCreateOptions,
        onConnect?: () => void
    ): TLSSocket;
}
