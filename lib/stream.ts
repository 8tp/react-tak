export default async function stream2buffer(stream: any): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const _buf = Array<Buffer>(); 
        stream.on("data", (chunk: Buffer) => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", (err: Error) => reject(`error converting stream - ${err}`));
    });
}
