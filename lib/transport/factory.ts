import type { TransportFactory } from './types.js';
import { isReactNative } from '../platform.js';

export function getDefaultTransportFactory(): TransportFactory {
    if (isReactNative) {
        return async (params) => {
            const module = await import('./react-native.js');
            return module.createReactNativeTransport(params);
        };
    }

    return async (params) => {
        const module = await import('./node.js');
        return module.createNodeTransport(params);
    };
}
