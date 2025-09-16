declare module 'react-native-ssl-pinning' {
    export type SSLPinningOptions = {
        cert: string;
        key: string;
    };

    export type SSLPinningFetchOptions = {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        sslPinning: SSLPinningOptions;
        timeoutInterval?: number;
    };

    export type SSLPinningFetchResponse = {
        status: number;
        headers?: Record<string, string>;
        bodyString?: string;
    };

    export function fetch(
        url: string,
        options: SSLPinningFetchOptions
    ): Promise<SSLPinningFetchResponse>;
}
