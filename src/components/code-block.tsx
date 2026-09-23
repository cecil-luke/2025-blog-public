'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type CodeBlockProps = {
	children: React.ReactNode
	code: string
	lang?: string
}

const LANG_LABELS: Record<string, string> = {
	js: 'JavaScript',
	javascript: 'JavaScript',
	ts: 'TypeScript',
	typescript: 'TypeScript',
	tsx: 'TSX',
	jsx: 'JSX',
	py: 'Python',
	python: 'Python',
	java: 'Java',
	c: 'C',
	cpp: 'C++',
	cxx: 'C++',
	cs: 'C#',
	csharp: 'C#',
	go: 'Go',
	rs: 'Rust',
	rust: 'Rust',
	rb: 'Ruby',
	ruby: 'Ruby',
	php: 'PHP',
	swift: 'Swift',
	kt: 'Kotlin',
	kotlin: 'Kotlin',
	matlab: 'MATLAB',
	r: 'R',
	sql: 'SQL',
	html: 'HTML',
	css: 'CSS',
	scss: 'SCSS',
	less: 'Less',
	json: 'JSON',
	yaml: 'YAML',
	yml: 'YAML',
	xml: 'XML',
	svg: 'SVG',
	md: 'Markdown',
	markdown: 'Markdown',
	sh: 'Shell',
	bash: 'Bash',
	shell: 'Shell',
	zsh: 'Zsh',
	diff: 'Diff',
	glsl: 'GLSL',
	mermaid: 'Mermaid',
	text: '',
	plaintext: '',
	plain: ''
}

export function formatCodeLang(lang?: string): string {
	if (!lang) return ''
	const key = lang.trim().split(/[\s{]/)[0]?.toLowerCase()
	if (!key) return ''
	if (key in LANG_LABELS) return LANG_LABELS[key]
	return key.replace(/^[a-z]/, char => char.toUpperCase())
}

export function CodeBlock({ children, code, lang }: CodeBlockProps) {
	const [copied, setCopied] = useState(false)
	const label = formatCodeLang(lang)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy code:', error)
		}
	}

	return (
		<div className='code-block-wrapper'>
			<div className='code-block-toolbar'>
				<span className='code-block-lang'>{label}</span>
				<button type='button' onClick={handleCopy} className='code-block-copy-btn' aria-label='复制代码'>
					{copied ? <Check size={16} /> : <Copy size={16} />}
				</button>
			</div>
			{children}
		</div>
	)
}
