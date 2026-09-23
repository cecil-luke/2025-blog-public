import { Marked, Renderer } from 'marked'
import type { Tokens } from 'marked'

export type TocItem = { id: string; text: string; level: number }

export interface CodeBlockData {
	code: string
	html: string
	lang?: string
}

export interface MarkdownRenderResult {
	html: string
	toc: TocItem[]
	codeBlocks: CodeBlockData[]
	wordCount: number
	readingMinutes: number
}

function getReadingStats(markdown: string) {
	const text = markdown
		.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/`[^`]*`/g, '')
		.replace(/\$\$?[\s\S]*?\$\$?/g, '')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/[>*_~#-]/g, '')
		.trim()

	const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
	const latinWordCount = (text.match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g) || []).length
	const wordCount = chineseCount + latinWordCount

	return {
		wordCount,
		readingMinutes: wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 450)) : 0
	}
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
}

/**
 * Generate a unique slug, appending -1, -2, ... suffixes for duplicates.
 * The usedIds set is mutated in place to track what has been issued.
 */
function slugifyUnique(text: string, usedIds: Set<string>): string {
	const base = slugify(text) || 'heading'
	let id = base
	let suffix = 1
	while (usedIds.has(id)) {
		id = base + '-' + suffix
		suffix++
	}
	usedIds.add(id)
	return id
}

/**
 * 代码高亮语言白名单：全站文章实际使用的语言（scripts 扫描得出）+
 * 少量常用兜底语言。相比加载全部语言，可显著减少客户端代码体积。
 * 未列入的语言会走无高亮降级路径，不影响渲染。
 */
const SHIKI_LANGS = [
	'text',
	'bash',
	'sh',
	'shell',
	'js',
	'javascript',
	'ts',
	'typescript',
	'tsx',
	'jsx',
	'glsl',
	'html',
	'css',
	'json',
	'md',
	'markdown',
	'xml',
	'python',
	'yaml',
	'yml',
	'diff',
	'plaintext',
	'matlab'
]

interface ShikiHighlighter {
	codeToHtml: (code: string, options: { lang: string; theme: string }) => Promise<string>
}

// Lazy load shiki（白名单语言），单例复用 highlighter 实例
let shikiPromise: Promise<ShikiHighlighter | null> | null = null

function loadShiki(): Promise<ShikiHighlighter | null> {
	if (!shikiPromise) {
		shikiPromise = (async () => {
			try {
				const { createHighlighter } = await import('shiki')
				const highlighter = await createHighlighter({ themes: ['one-light'], langs: SHIKI_LANGS })
				return highlighter as unknown as ShikiHighlighter
			} catch (error) {
				console.warn('Failed to load shiki module:', error)
				return null
			}
		})()
	}
	return shikiPromise
}

// Lazy load katex to handle environments where it's not available (e.g., Cloudflare Workers)
let katexModule: typeof import('katex') | null = null
let katexLoadAttempted = false

async function loadKatex() {
	if (katexModule) return katexModule
	if (katexLoadAttempted) return null
	katexLoadAttempted = true

	try {
		// katex is published as CJS; depending on bundler/runtime the dynamic import
		// may return either the exports object directly or as `default`.
		const mod: any = await import('katex')
		katexModule = (mod?.default ?? mod) as any
		return katexModule
	} catch (error) {
		console.warn('Failed to load katex module:', error)
		return null
	}
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Drop YAML fences (including after a heading) so `---` is not a setext underline. */
export function stripFrontMatter(markdown: string): string {
	return markdown.replace(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/gm, (full, body: string) => {
		return /^[A-Za-z0-9_-]+:[ \t]?\S/m.test(body) ? '\n' : full
	})
}

function footnoteSlug(id: string): string {
	return slugify(id) || id
}

type FootnoteMetaToken = {
	type: string
	id?: string
	tag?: string
	href?: string
	title?: string | null
	text?: string
	__fnSlug?: string
	__fnTarget?: string
	__fnBack?: string
	tokens?: unknown[]
}

function isFootnoteDefToken(token: FootnoteMetaToken): boolean {
	return token.type === 'footnoteDef' || (token.type === 'def' && Boolean(token.tag?.startsWith('^')))
}

function footnoteDefId(token: FootnoteMetaToken): string {
	if (token.type === 'footnoteDef' && token.id) return token.id
	return (token.tag || '').replace(/^\^/, '')
}

function footnoteOccurrenceSlug(id: string, index: number): string {
	const base = footnoteSlug(id)
	return index === 0 ? base : `${base}-${index + 1}`
}

/** Pair duplicate `[^n]` refs/defs in document order so the first citation is not overwritten. */
function assignFootnoteMeta(tokenList: FootnoteMetaToken[]) {
	const defsById = new Map<string, FootnoteMetaToken[]>()
	const refsById = new Map<string, FootnoteMetaToken[]>()

	function walk(node: unknown) {
		if (!node) return
		if (Array.isArray(node)) {
			for (const item of node) walk(item)
			return
		}
		if (typeof node !== 'object') return

		const token = node as FootnoteMetaToken & { items?: unknown[] }
		if (isFootnoteDefToken(token)) {
			const id = footnoteDefId(token)
			const defs = defsById.get(id) ?? []
			defs.push(token)
			defsById.set(id, defs)
		} else if (token.type === 'footnoteRef' && token.id) {
			const refs = refsById.get(token.id) ?? []
			refs.push(token)
			refsById.set(token.id, refs)
		}

		if (token.tokens) walk(token.tokens)
		if (token.items) walk(token.items)
	}

	walk(tokenList)

	for (const [id, defs] of defsById) {
		defs.forEach((token, index) => {
			token.__fnSlug = footnoteOccurrenceSlug(id, index)
		})
	}

	for (const [id, refs] of refsById) {
		const defs = defsById.get(id) ?? []
		refs.forEach((token, index) => {
			token.__fnSlug = footnoteOccurrenceSlug(id, index)
			const paired = defs[Math.min(index, Math.max(defs.length - 1, 0))]
			token.__fnTarget = paired?.__fnSlug || token.__fnSlug
		})
	}

	for (const [id, defs] of defsById) {
		const refs = refsById.get(id) ?? []
		defs.forEach((token, index) => {
			const paired = refs[Math.min(index, Math.max(refs.length - 1, 0))]
			token.__fnBack = paired?.__fnSlug || token.__fnSlug
		})
	}
}

function renderFootnoteDefHtml(id: string, body: string, slug: string, backSlug: string): string {
	return `<p class="footnote-def" id="fn-${slug}"><a class="footnote-label" href="#fnref-${backSlug}">[${escapeHtml(id)}]</a>: ${body} <a class="footnote-back" href="#fnref-${backSlug}" aria-label="返回正文">↩</a></p>\n`
}

function buildTocHtml(toc: TocItem[]): string {
	if (toc.length === 0) return ''
	const items = toc
		.map(item => `<li class="toc-l${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`)
		.join('')
	return `<nav class="article-toc" aria-label="文章目录"><p class="article-toc-title">目录</p><ul>${items}</ul></nav>\n`
}

// 渲染结果缓存：同内容不重复走 lexer/shiki/katex（编辑预览与文章页共用此链路）
const RENDER_CACHE_LIMIT = 40
const renderCache = new Map<string, MarkdownRenderResult>()

export async function renderMarkdown(markdown: string): Promise<MarkdownRenderResult> {
	const cached = renderCache.get(markdown)
	if (cached) return cached

	const source = stripFrontMatter(markdown)

	// 按需加载：无代码块时不加载 shiki，无 $ 符号时不加载 katex
	const hasCodeFence = /\`\`\`|~~~/.test(source)
	const hasMathDollar = source.includes('$')

	const codeBlockMap = new Map<string, { html: string; original: string; index: number }>()
	const codeBlocks: CodeBlockData[] = []
	const toc: TocItem[] = []
	const [shiki, katex] = await Promise.all([hasCodeFence ? loadShiki() : Promise.resolve(null), hasMathDollar ? loadKatex() : Promise.resolve(null)])

	const renderer = new Renderer()
	const instance = new Marked({ gfm: true })

	renderer.heading = (token: Tokens.Heading) => {
		const id = ((token as Tokens.Heading & { __tocId?: string }).__tocId as string) || slugify(token.text)
		return `<h${token.depth} id="${id}">${token.text}</h${token.depth}>`
	}

	renderer.code = (token: Tokens.Code) => {
		const codeData = codeBlockMap.get(token.text)
		if (codeData) {
			return `<pre data-code-index="${codeData.index}">${codeData.html}</pre>`
		}
		return `<code>${escapeHtml(token.text)}</code>`
	}

	renderer.listitem = (token: Tokens.ListItem) => {
		let tokens = token.tokens ?? []
		if (token.task) tokens = tokens.slice(1)
		const inner = tokens.length ? (instance.parser(tokens) as string) : token.text

		if (token.task) {
			const checkbox = token.checked ? '<input type="checkbox" checked disabled />' : '<input type="checkbox" disabled />'
			return `<li class="task-list-item">${checkbox} ${inner}</li>\n`
		}

		return `<li>${inner}</li>\n`
	}

	renderer.def = (token: Tokens.Def) => {
		if (!token.tag.startsWith('^')) return ''
		const id = token.tag.slice(1)
		const slug = (token as Tokens.Def & { __fnSlug?: string }).__fnSlug || footnoteSlug(id)
		const back = (token as Tokens.Def & { __fnBack?: string }).__fnBack || slug
		const body = instance.parseInline([token.href, token.title].filter(Boolean).join(' ')) as string
		return renderFootnoteDefHtml(id, body, slug, back)
	}

	const renderMath = (content: string, displayMode: boolean) => {
		if (!katex) {
			return displayMode ? `$$${content}$$` : `$${content}$`
		}

		try {
			return katex.renderToString(content, {
				displayMode,
				throwOnError: false,
				output: 'html',
				strict: 'ignore'
			})
		} catch {
			return displayMode ? `$$${content}$$` : `$${content}$`
		}
	}

	instance.use({
		renderer,
		extensions: [
			{
				name: 'tocPlaceholder',
				level: 'block',
				start(src: string) {
					const match = src.match(/^\s*\[TOC\]/im)
					return match ? src.indexOf(match[0]) : undefined
				},
				tokenizer(src: string) {
					const match = src.match(/^\[TOC\][ \t]*(?:\n|$)/i)
					if (!match) return
					return { type: 'tocPlaceholder', raw: match[0] }
				},
				renderer() {
					return buildTocHtml(toc)
				}
			},
			{
				name: 'footnoteDef',
				level: 'block',
				start(src: string) {
					const idx = src.search(/^\[\^[^\]]+\]:/m)
					return idx === -1 ? undefined : idx
				},
				tokenizer(src: string) {
					const match = src.match(/^\[\^([^\]]+)\]:[ \t]*([^\n]*(?:\n[ \t]+[^\n]*)*)(?:\n|$)/)
					if (!match) return
					return { type: 'footnoteDef', raw: match[0], id: match[1], text: match[2].trim() }
				},
				renderer(token: { id: string; text: string; __fnSlug?: string; __fnBack?: string }) {
					const slug = token.__fnSlug || footnoteSlug(token.id)
					const back = token.__fnBack || slug
					const body = instance.parseInline(token.text) as string
					return renderFootnoteDefHtml(token.id, body, slug, back)
				}
			},
			{
				name: 'mathBlock',
				level: 'block',
				start(src: string) {
					return src.indexOf('$$')
				},
				tokenizer(src: string) {
					const match = src.match(/^\$\$([\s\S]+?)\$\$(?:\n+|$)/)
					if (!match) return
					return {
						type: 'mathBlock',
						raw: match[0],
						text: match[1].trim()
					}
				},
				renderer(token: { text: string }) {
					return `${renderMath(token.text || '', true)}\n`
				}
			},
			{
				name: 'highlight',
				level: 'inline',
				start(src: string) {
					return src.indexOf('==')
				},
				tokenizer(src: string) {
					const match = src.match(/^==([^=\n]+?)==/)
					if (!match) return
					return { type: 'highlight', raw: match[0], text: match[1] }
				},
				renderer(token: { text: string }) {
					return `<mark>${instance.parseInline(token.text)}</mark>`
				}
			},
			{
				name: 'superscript',
				level: 'inline',
				start(src: string) {
					return src.indexOf('^')
				},
				tokenizer(src: string) {
					if (src.startsWith('^^')) return
					const match = src.match(/^\^(\[[^\]]+\]|[^\s^]+)\^/)
					if (!match) return
					return { type: 'superscript', raw: match[0], text: match[1] }
				},
				renderer(token: { text: string }) {
					return `<sup>${instance.parseInline(token.text)}</sup>`
				}
			},
			{
				name: 'subscript',
				level: 'inline',
				start(src: string) {
					return src.indexOf('~')
				},
				tokenizer(src: string) {
					if (src.startsWith('~~')) return
					const match = src.match(/^~((?:[^~\n]|\\ )+)~/)
					if (!match) return
					return { type: 'subscript', raw: match[0], text: match[1].replace(/\\ /g, ' ') }
				},
				renderer(token: { text: string }) {
					return `<sub>${escapeHtml(token.text)}</sub>`
				}
			},
			{
				name: 'footnoteRef',
				level: 'inline',
				start(src: string) {
					return src.indexOf('[^')
				},
				tokenizer(src: string) {
					if (src.startsWith('[^') && src.includes(']:')) return
					const match = src.match(/^\[\^([^\]]+)\](?!:)/)
					if (!match) return
					return { type: 'footnoteRef', raw: match[0], id: match[1] }
				},
				renderer(token: { id: string; __fnSlug?: string; __fnTarget?: string }) {
					const slug = token.__fnSlug || footnoteSlug(token.id)
					const target = token.__fnTarget || slug
					return `<sup class="footnote-ref"><a href="#fn-${target}" id="fnref-${slug}">${escapeHtml(token.id)}</a></sup>`
				}
			},
			{
				name: 'mathInline',
				level: 'inline',
				start(src: string) {
					const idx = src.indexOf('$')
					return idx === -1 ? undefined : idx
				},
				tokenizer(src: string) {
					if (src.startsWith('$$')) return
					if (src.startsWith('\\$')) return

					const match = src.match(/^\$([^\n$]+?)\$/)
					if (!match) return

					const inner = match[1]
					if (!inner || !inner.trim()) return

					return {
						type: 'mathInline',
						raw: match[0],
						text: inner.trim()
					}
				},
				renderer(token: { text: string }) {
					return renderMath(token.text || '', false)
				}
			}
		]
	})

	const tokens = instance.lexer(source)

	const usedIds = new Set<string>()
	function extractHeadings(tokenList: typeof tokens) {
		for (const token of tokenList) {
			if (token.type === 'heading') {
				const text = token.text
				const id = slugifyUnique(text, usedIds)
				;(token as Tokens.Heading & { __tocId?: string }).__tocId = id
				toc.push({ id, text, level: token.depth })
			}
			if ('tokens' in token && token.tokens) {
				extractHeadings(token.tokens as typeof tokens)
			}
		}
	}
	extractHeadings(tokens)
	assignFootnoteMeta(tokens as FootnoteMetaToken[])

	for (const token of tokens) {
		if (token.type === 'code') {
			const codeToken = token as Tokens.Code
			const originalCode = codeToken.text
			const index = codeBlocks.length
			let html = ''

			if (shiki) {
				try {
					const lang = codeToken.lang === 'svg' ? 'xml' : codeToken.lang || 'text'
					html = await shiki.codeToHtml(originalCode, {
						lang,
						theme: 'one-light'
					})
				} catch {
					html = ''
				}
			}
			if (!html) {
				html = `<pre><code>${escapeHtml(originalCode)}</code></pre>`
			}
			codeBlocks.push({ code: originalCode, html, lang: codeToken.lang || undefined })
			codeBlockMap.set(`__SHIKI_CODE_${index}__`, { html, original: originalCode, index })
			codeToken.text = `__SHIKI_CODE_${index}__`
		}
	}

	const html = (instance.parser(tokens) as string) || ''
	const { wordCount, readingMinutes } = getReadingStats(source)

	const result: MarkdownRenderResult = { html, toc, codeBlocks, wordCount, readingMinutes }
	if (renderCache.size >= RENDER_CACHE_LIMIT) {
		const firstKey = renderCache.keys().next().value
		if (firstKey !== undefined) renderCache.delete(firstKey)
	}
	renderCache.set(markdown, result)
	return result
}
