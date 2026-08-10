import { describe, it, expect } from 'vitest'
import { parseInlineMarkdown, parseContent } from './contentParser'

// React elements are plain objects ({ type, props, key }), so we can assert
// on them directly without rendering.
function text(node: unknown): string {
    return (node as { props: { children: string } }).props.children
}

describe('parseInlineMarkdown', () => {
    it('renders bold, code, highlight and strikethrough', () => {
        const [bold] = parseInlineMarkdown('**bold**')
        expect((bold as { type: string }).type).toBe('strong')
        expect(text(bold)).toBe('bold')

        const [code] = parseInlineMarkdown('`code`')
        expect((code as { type: string }).type).toBe('code')
        expect(text(code)).toBe('code')

        const [mark] = parseInlineMarkdown('==highlight==')
        expect((mark as { type: string }).type).toBe('mark')
        expect(text(mark)).toBe('highlight')

        const [del] = parseInlineMarkdown('~~strike~~')
        expect((del as { type: string }).type).toBe('del')
        expect(text(del)).toBe('strike')
    })

    it('linkifies bare URLs', () => {
        const [link] = parseInlineMarkdown('https://example.com/a')
        expect((link as { type: string; props: { href: string } }).type).toBe('a')
        expect((link as { props: { href: string } }).props.href).toBe('https://example.com/a')
    })

    it('leaves stray unmatched "=" text as plain text', () => {
        const input = '==incomplete= later text = still here=='
        const nodes = parseInlineMarkdown(input)
        // Regression: split()-based rendering used to coincidentally treat the
        // whole unmatched string as one <mark> because it merely started/ended
        // with "==", even though no delimiter pair actually matched.
        const hasMark = nodes.some(n => typeof n === 'object' && n !== null && (n as { type?: string }).type === 'mark')
        expect(hasMark).toBe(false)
        expect(nodes.join('')).toBe(input)
    })
})

describe('parseContent tables', () => {
    it('parses a basic table into headers and rows', () => {
        const md = '| Name | Score |\n| --- | --- |\n| Alice | 10 |\n| Bob | 20 |'
        const result = parseContent(md)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('table')

        const table = result[0].content as { headers: unknown[][]; rows: unknown[][][]; alignments: unknown[] }
        // Plain cell text with no inline markdown comes back as a bare string
        expect(table.headers.map(cell => cell[0])).toEqual(['Name', 'Score'])
        expect(table.rows).toHaveLength(2)
        expect(table.alignments).toEqual([null, null])
    })

    it('parses column alignment markers', () => {
        const md = '| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |'
        const result = parseContent(md)
        const table = result[0].content as { alignments: unknown[] }
        expect(table.alignments).toEqual(['left', 'center', 'right'])
    })

    it('supports tables without outer pipes', () => {
        const md = 'A | B\n--- | ---\n1 | 2'
        const result = parseContent(md)
        expect(result[0].type).toBe('table')
        const table = result[0].content as { rows: unknown[][][] }
        expect(table.rows).toHaveLength(1)
    })

    it('stops consuming rows at the first blank or non-pipe line', () => {
        const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nnot a table row'
        const result = parseContent(md)
        expect(result[0].type).toBe('table')
        const table = result[0].content as { rows: unknown[][][] }
        expect(table.rows).toHaveLength(1)
        // Blank line + trailing text still get parsed as their own entries
        expect(result.some(r => r.type === 'text')).toBe(true)
    })

    it('does not treat a lone pipe line without a separator as a table', () => {
        const md = 'a | b'
        const result = parseContent(md)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('text')
    })
})

describe('parseContent — blockquotes', () => {
    type Quote = { lines: unknown[][]; attribution: unknown[] | null }

    it('merges consecutive quoted lines into one block', () => {
        const result = parseContent('> first\n> second\n> third')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('blockquote')
        const quote = result[0].content as Quote
        expect(quote.lines).toHaveLength(3)
        expect(quote.lines[0][0]).toBe('first')
        expect(quote.attribution).toBeNull()
    })

    it('ends the quote at the first unquoted line', () => {
        const result = parseContent('> quoted\nplain\n> quoted again')
        expect(result.map(r => r.type)).toEqual(['blockquote', 'text', 'blockquote'])
    })

    it('splits a trailing dash line off as attribution', () => {
        const result = parseContent('> to be or not to be\n> — Hamlet')
        const quote = result[0].content as Quote
        expect(quote.lines).toHaveLength(1)
        expect(quote.attribution?.[0]).toBe('Hamlet')
    })

    it('accepts -- and – as attribution markers', () => {
        for (const dash of ['--', '–']) {
            const quote = parseContent(`> quoted\n> ${dash} source`)[0].content as Quote
            expect(quote.attribution?.[0]).toBe('source')
        }
    })

    it('keeps a lone dash line as the quote itself', () => {
        const quote = parseContent('> — just a dashed line')[0].content as Quote
        expect(quote.lines).toHaveLength(1)
        expect(quote.attribution).toBeNull()
    })

    it('keeps interior blank quoted lines but trims the edges', () => {
        const quote = parseContent('>\n> a\n>\n> b\n>')[0].content as Quote
        expect(quote.lines.map(line => line.length)).toEqual([1, 0, 1])
    })

    it('drops a quote that is nothing but markers', () => {
        expect(parseContent('>\n>')).toHaveLength(0)
    })

    it('still parses inline markdown inside a quote', () => {
        const quote = parseContent('> **bold** quote')[0].content as Quote
        expect((quote.lines[0][0] as { type: string }).type).toBe('strong')
    })
})
