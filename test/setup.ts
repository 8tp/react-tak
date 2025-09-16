import { webcrypto } from 'node:crypto';

if (typeof globalThis.File === 'undefined') {
    class NodeFile extends Blob {
        readonly name: string;
        readonly lastModified: number;

        constructor(fileBits: BlobPart[], fileName: string, options: FilePropertyBag = {}) {
            super(fileBits, options);
            this.name = fileName;
            this.lastModified = options.lastModified ?? Date.now();
        }
    }

    Object.defineProperty(NodeFile.prototype, Symbol.toStringTag, {
        value: 'File',
    });

    // @ts-expect-error Runtime polyfill for Node.js
    globalThis.File = NodeFile;
}

if (typeof globalThis.crypto === 'undefined') {
    // @ts-expect-error align Node webcrypto with browser global
    globalThis.crypto = webcrypto;
}
