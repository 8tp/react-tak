import Err from '@openaddresses/batch-error';
import { Type, Static } from '@sinclair/typebox';
import Commands from '../commands.js';
import { decodeBase64ToString } from '../utils/encoding.js';

export const LoginInput = Type.Object({
    username: Type.String(),
    password: Type.String()
})

export const TokenContents = Type.Object({
    sub: Type.String(),
    aud: Type.String(),
    nbf: Type.Number(),
    exp: Type.Number(),
    iat: Type.Number()
})

export default class OAuthCommands extends Commands {
    schema = {}

    async cli(): Promise<object | string> {
        throw new Error('Unsupported Subcommand');
    }

    parse(jwt: string): Static<typeof TokenContents>{
        const split = decodeBase64ToString(jwt).split('}').map((ext) => { return ext + '}'});
        if (split.length < 2) throw new Err(500, null, 'Unexpected TAK JWT Format');
        const contents: { sub: string; aud: string; nbf: number; exp: number; iat: number; } = JSON.parse(split[1]);

        return contents;
    }

    async login(query: Static<typeof LoginInput>): Promise<{
        token: string;
        contents: Static<typeof TokenContents>
    }> {
        const url = new URL(`/oauth/token`, this.api.url);

        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', query.username);
        url.searchParams.append('password', query.password);

        const authres = await this.api.fetch(url, {
            method: 'POST'
        }, true);

        const text = await authres.text();

        if (authres.status === 401) {
            throw new Err(400, new Error(text), 'TAK Server reports incorrect Username or Password');
        } else if (!(authres.ok ?? (authres.status >= 200 && authres.status < 300))) {
            throw new Err(400, new Error(`Status: ${authres.status}: ${text}`), 'Non-200 Response from Auth Server - Token');
        }

        const body = JSON.parse(text) as Record<string, unknown>;
        const error = typeof body.error === 'string' ? body.error : undefined;
        const errorDescription = typeof body.error_description === 'string' ? body.error_description : undefined;
        const accessToken = typeof body.access_token === 'string' ? body.access_token : undefined;

        if (error === 'invalid_grant' && errorDescription && errorDescription.startsWith('Bad credentials')) {
            throw new Err(400, null, 'Invalid Username or Password');
        } else if (error || !accessToken) {
            throw new Err(500, new Error(errorDescription ?? 'Unknown Error'), 'Unknown Login Error');
        }

        return {
            token: accessToken,
            contents: this.parse(accessToken)
        };
    }
}
