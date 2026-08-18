import { useEffect, useState, type ReactElement } from 'react'
import parse, { type HTMLReactParserOptions, Element, type DOMNode } from 'html-react-parser'
import { renderMarkdown, type TocItem } from '@/lib/markdown-renderer'
import { MarkdownImage } from '@/components/markdown-image'
import { CodeBlock } from '@/components/code-block'

type MarkdownRenderResult = {
	content: ReactElement | null
	toc: TocItem[]
	wordCount: number
	readingMinutes: number
	loading: boolean
}

export function useMarkdownRender(markdown: string): MarkdownRenderResult {
	const [content, setContent] = useState<ReactElement | null>(null)
	const [toc, setToc] = useState<TocItem[]>([])
	const [wordCount, setWordCount] = useState(0)
	const [readingMinutes, setReadingMinutes] = useState(0)
	const [loading, setLoading] = useState<boolean>(true)

	useEffect(() => {
		let cancelled = false

		async function render() {
			setLoading(true)
			try {
				const { html, toc, codeBlocks, wordCount: nextWordCount, readingMinutes: nextReadingMinutes } = await renderMarkdown(markdown)
				if (cancelled) return

				// Parse HTML, replacing img elements and code block placeholders
				const options: HTMLReactParserOptions = {
					replace(domNode: DOMNode) {
						if (domNode instanceof Element && domNode.name === 'img') {
							const { src, alt, title } = domNode.attribs
							return <MarkdownImage src={src} alt={alt} title={title} />
						}
						// Code blocks carry data-code-index, the code itself lives in codeBlocks[]
						if (domNode instanceof Element && domNode.name === 'pre' && domNode.attribs['data-code-index'] !== undefined) {
							const block = codeBlocks[Number(domNode.attribs['data-code-index'])]
							if (block) {
								return <CodeBlock code={block.code}>{parse(block.html)}</CodeBlock>
							}
						}
					}
				}
				const reactContent = parse(html, options) as ReactElement
				setContent(reactContent)
				setToc(toc)
				setWordCount(nextWordCount)
				setReadingMinutes(nextReadingMinutes)
			} catch (error) {
				console.error('Markdown render error:', error)
				if (!cancelled) {
					setContent(null)
					setToc([])
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		render()

		return () => {
			cancelled = true
		}
	}, [markdown])

	return { content, toc, wordCount, readingMinutes, loading }
}
