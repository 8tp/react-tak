import { describe, it, expect } from 'vitest';
import './setup.js';
import TAK from '../index.js';

describe('findCoT', () => {
    it('returns null when cot is unfinished', () => {
        const res = TAK.findCoT('<event ><detail>');
        expect(res).toBeNull();
    });

    it('parses basic event', () => {
        const res = TAK.findCoT('<event></event>');
        expect(res).toEqual({
            event: '<event></event>',
            remainder: '',
        });
    });

    it('parses multiline event', () => {
        const res = TAK.findCoT(`
<event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event>`);
        expect(res).toEqual({
            event: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
            remainder: '',
        });
    });

    it('parses multiline non-greedy', () => {
        const res = TAK.findCoT(`
<event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event><event>
    <detail remarks="
I am a multiline
remarks field
    "/>
</event>`);
        expect(res).toEqual({
            event: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
            remainder: '<event>\n    <detail remarks="\nI am a multiline\nremarks field\n    "/>\n</event>',
        });
    });

    it('handles leading garbage', () => {
        const res = TAK.findCoT(`
<fake/>
<event><detail remarks="I am remarks"/>
</event>
`);
        expect(res).toEqual({
            event: '<event><detail remarks="I am remarks"/>\n</event>',
            remainder: '\n',
        });
    });

    it('handles trailing garbage', () => {
        const res = TAK.findCoT(`
<event><detail remarks="I am remarks"/>
</event>
<fake/>
`);
        expect(res).toEqual({
            event: '<event><detail remarks="I am remarks"/>\n</event>',
            remainder: '\n<fake/>\n',
        });
    });

    it('handles mixed data', () => {
        const res = TAK.findCoT(`
<event><detail remarks="I am remarks"/>
</event>
<fake/>
<event><detail remarks="I am remarks"/></event>`);
        expect(res).toEqual({
            event: '<event><detail remarks="I am remarks"/>\n</event>',
            remainder: '\n<fake/>\n<event><detail remarks="I am remarks"/></event>',
        });
    });
});
