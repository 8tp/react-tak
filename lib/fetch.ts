import Err from '@openaddresses/batch-error';
import { Static, TSchema, TUnknown } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let fetchImpl: FetchFunction | undefined;

async function resolveFetch(): Promise<FetchFunction> {
    if (fetchImpl) return fetchImpl;

    if (typeof globalThis.fetch === 'function') {
        fetchImpl = async (input, init) => {
            const normalized: RequestInfo = input instanceof URL ? input.toString() : input;
            const result = await (globalThis.fetch as typeof fetch)(normalized, init);
            return result as Response;
        };
        return fetchImpl;
    }

    const undici = await import('undici');
    const undiciFetch = undici.fetch as unknown as FetchFunction;
    fetchImpl = async (input, init) => {
        const normalized = input instanceof URL ? input.toString() : input;
        return await undiciFetch(normalized, init);
    };
    return fetchImpl;
}

export class TypedResponse extends Response {
    constructor(response: Response) {
        super(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    typed<T extends TSchema>(type: T): Promise<Static<T>>;

    async typed<T extends TSchema = TUnknown>(type: T): Promise<Static<T>> {
        const body = await this.json();

        const typeChecker = TypeCompiler.Compile(type)
        const result = typeChecker.Check(body);

        if (result) return body;

        const errors = typeChecker.Errors(body);
        const firstError = errors.First();

        throw new Err(500, null, `Internal Validation Error: ${JSON.stringify(firstError)}`);
    }
}

export default async function(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<TypedResponse> {
    const fetchFn = await resolveFetch();
    const response = await fetchFn(input, init);
    return new TypedResponse(response as Response);
}
