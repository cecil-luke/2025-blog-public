import { marked } from 'marked'
import type { Tokens } from 'marked'

export type TocItem = { id: string; text: string; level: number }

export interface CodeBlockData {
	code: string
	html: string
}

export interface MarkdownRenderResult {
	html: string
	toc: TocItem[]
	codeBlocks: CodeBlockData[]
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
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
	'plaintext'
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

// 渲染结果缓存：同内容不重复走 lexer/shiki/katex（编辑预览与文章页共用此链路）
const RENDER_CACHE_LIMIT = 40
const renderCache = new Map<string, MarkdownRenderResult>()

export async function renderMarkdown(markdown: string): Promise<MarkdownRenderResult> {
	const cached = renderCache.get(markdown)
	if (cached) return cached

	// 按需加载：无代码块时不加载 shiki，无 $ 符号时不加载 katex
	const hasCodeFence = /\`\`\`|~~~/.test(markdown)
	const hasMathDollar = markdown.includes('$')

	const codeBlockMap = new Map<string, { html: string; original: string; index: number }>()
	const codeBlocks: CodeBlockData[] = []
	const [shiki, katex] = await Promise.all([hasCodeFence ? loadShiki() : Promise.resolve(null), hasMathDollar ? loadKatex() : Promise.resolve(null)])

	// Render HTML with heading ids
	const renderer = new marked.Renderer()

	renderer.heading = (token: Tokens.Heading) => {
		const id = slugify(token.text || '')
		return `<h${token.depth} id="${id}">${token.text}</h${token.depth}>`
	}

	renderer.code = (token: Tokens.Code) => {
		// Check if this code block was pre-processed
		const codeData = codeBlockMap.get(token.text)
		if (codeData) {
			// 输出 data-code-index 占位，代码本体与高亮 HTML 放在 codeBlocks 数组中返回，
			// 避免把整段代码塞进 HTML 属性再转义/反转义（原实现易出错且慢）
			return `<pre data-code-index="${codeData.index}">${codeData.html}</pre>`
		}
		// Fallback to default (inline code, not code block)
		return `<code>${escapeHtml(token.text)}</code>`
	}

	renderer.listitem = (token: Tokens.ListItem) => {
		// Render inline markdown inside list items (e.g. links, emphasis)
		let inner = token.text
		let tokens = token.tokens

		if (token.task) tokens = tokens.slice(1)
		inner = marked.parser(tokens) as string

		if (token.task) {
			const checkbox = token.checked ? '<input type="checkbox" checked disabled />' : '<input type="checkbox" disabled />'
			return `<li class="task-list-item">${checkbox} ${inner}</li>\n`
		}

		return `<li>${inner}</li>\n`
	}

	const renderMath = (content: string, displayMode: boolean) => {
		if (!katex) {
			// Keep original delimiters if katex is not available
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

	// Register extensions BEFORE lexing so math gets tokenized on cold refresh.
	marked.use({
		renderer,
		extensions: [
			// Block math: $$ ... $$
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
					} as any
				},
				renderer(token: any) {
					return `${renderMath(token.text || '', true)}\n`
				}
			},
			// Inline math: $ ... $
			{
				name: 'mathInline',
				level: 'inline',
				start(src: string) {
					const idx = src.indexOf('$')
					return idx === -1 ? undefined : idx
				},
				tokenizer(src: string) {
					// Avoid $$ (block) and escaped dollars
					if (src.startsWith('$$')) return
					if (src.startsWith('\\$')) return

					const match = src.match(/^\$([^\n$]+?)\$/)
					if (!match) return

					const inner = match[1]
					// Heuristic: require some non-space content
					if (!inner || !inner.trim()) return

					return {
						type: 'mathInline',
						raw: match[0],
						text: inner.trim()
					} as any
				},
				renderer(token: any) {
					return renderMath(token.text || '', false)
				}
			}
		]
	})

	// Pre-process with marked lexer first (after extensions are registered)
	const tokens = marked.lexer(markdown)

	// Extract TOC from parsed tokens (this correctly skips code blocks)
	const toc: TocItem[] = []
	function extractHeadings(tokenList: typeof tokens) {
		for (const token of tokenList) {
			if (token.type === 'heading' && token.depth <= 3) {
				// Use the parsed text (markdown syntax like links/code already stripped)
				const text = token.text
				const id = slugify(text)
				toc.push({ id, text, level: token.depth })
			}
			// Recursively check nested tokens (e.g., in blockquotes, lists)
			if ('tokens' in token && token.tokens) {
				extractHeadings(token.tokens as typeof tokens)
			}
		}
	}
	extractHeadings(tokens)

	// Pre-process code blocks with Shiki
	for (const token of tokens) {
		if (token.type === 'code') {
			const codeToken = token as Tokens.Code
			const originalCode = codeToken.text
			const index = codeBlocks.length
			let html = ''

			if (shiki) {
				try {
					// 'svg' 不在白名单中，映射到语法相近的 'xml' 避免整体降级
					const lang = codeToken.lang === 'svg' ? 'xml' : codeToken.lang || 'text'
					html = await shiki.codeToHtml(originalCode, {
						lang,
						theme: 'one-light'
					})
				} catch {
					// Keep original if highlighting fails (e.g. 语言不在白名单)
					html = ''
				}
			}
			// Fallback when shiki is not available or highlighting failed
			if (!html) {
				html = `<code>${escapeHtml(originalCode)}</code>`
			}
			codeBlocks.push({ code: originalCode, html })
			codeBlockMap.set(`__SHIKI_CODE_${index}__`, { html, original: originalCode, index })
			codeToken.text = `__SHIKI_CODE_${index}__`
		}
	}
	const html = (marked.parser(tokens) as string) || ''

	const result: MarkdownRenderResult = { html, toc, codeBlocks }
	if (renderCache.size >= RENDER_CACHE_LIMIT) {
		const firstKey = renderCache.keys().next().value
		if (firstKey !== undefined) renderCache.delete(firstKey)
	}
	renderCache.set(markdown, result)
	return result
}
