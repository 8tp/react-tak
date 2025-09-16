export function encodeUtf8(text: string): Uint8Array {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(text);
    }

    if (typeof Buffer !== 'undefined') {
        return Uint8Array.from(Buffer.from(text, 'utf-8'));
    }

    const arr = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) arr[i] = text.charCodeAt(i) & 0xFF;
    return arr;
}

export function decodeUtf8(bytes: Uint8Array): string {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
    }

    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('utf-8');
    }

    let result = '';
    for (let i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes[i]);
    return result;
}
