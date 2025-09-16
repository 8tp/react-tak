import { APIAuthPassword } from '../auth.js';
import type { ParsedArgs } from 'minimist'
import { Static, Type } from '@sinclair/typebox';
import Commands, { CommandOutputFormat } from '../commands.js';
import pem from 'pem';
import xmljs from 'xml-js';

type NameEntry = {
    _attributes?: {
        name?: string;
        value?: string;
    };
};

type CertificateConfig = {
    nameEntries?: {
        nameEntry?: NameEntry | NameEntry[];
    };
};

type SignResponse = {
    signedCert: string;
    signedKey: string;
    ca0?: string;
    ca1?: string;
};

export const CertificateResponse = Type.Object({
    ca: Type.Array(Type.String()),
    cert: Type.String(),
    key: Type.String()
});

export default class CredentialCommands extends Commands {
    schema = {
        config: {
            description: 'Return TLS Config Info',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'config') {
            return this.config();
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    async config(): Promise<string> {
        const url = new URL(`/Marti/api/tls/config`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async generate(): Promise<Static<typeof CertificateResponse>> {
        if (!(this.api.auth instanceof APIAuthPassword)) throw new Error('Must use Password Auth');

        const parsed = xmljs.xml2js(await this.config(), { compact: true }) as Record<string, unknown>;
        const certificateConfig = parsed['ns2:certificateConfig'] as CertificateConfig | undefined;
        const nameEntryValue = certificateConfig?.nameEntries?.nameEntry;
        const entries = Array.isArray(nameEntryValue)
            ? nameEntryValue
            : nameEntryValue
                ? [nameEntryValue]
                : [];

        let organization: string | undefined;
        let organizationUnit: string | undefined;

        for (const entry of entries) {
            const attrs = entry._attributes;
            if (!attrs) continue;
            if (attrs.name === 'O') organization = attrs.value ?? undefined;
            if (attrs.name === 'OU') organizationUnit = attrs.value ?? undefined;
        }

        const createCSR = pem.promisified.createCSR;

        const keys: {
            csr: string,
            clientKey: string
        } = await createCSR({
            organization,
            organizationUnit,
            commonName: this.api.auth.username
        });

        const url = new URL(`/Marti/api/tls/signClient/v2`, this.api.url);
        url.searchParams.append('clientUid', this.api.auth.username + ' (ETL)');
        url.searchParams.append('version', '3');

        const res = await this.api.fetch(url, {
            method: 'POST',
            nocookies: true,
            headers: {
                Accept: 'application/json',
                Authorization: 'Basic ' + btoa(this.api.auth.username + ":" + this.api.auth.password)
            },
            body: keys.csr
        }) as SignResponse;

        let cert = '-----BEGIN CERTIFICATE-----\n' + res.signedCert;
        if (!res.signedCert.endsWith('\n')) cert = cert + '\n';
        cert = cert + '-----END CERTIFICATE-----';

        const chain = [];

        if (res.ca0) chain.push(res.ca0);
        if (res.ca1) chain.push(res.ca1);

        return {
            ca: chain,
            cert,
            key: keys.clientKey
        }
    }
}
