import '@/styles/globals.css'

import type { Metadata } from 'next'
import Layout from '@/layout'
import Head from '@/layout/head'
import siteContent from '@/config/site-content.json'

const {
	meta: { title, description },
	theme
} = siteContent

export const metadata: Metadata = {
	title,
	description,
	openGraph: {
		title,
		description
	},
	twitter: {
		title,
		description
	}
}

const htmlStyle = {
	cursor: 'url(/images/cursor.svg) 2 1, auto',
	'--color-brand': theme.colorBrand,
	'--color-primary': theme.colorPrimary,
	'--color-secondary': theme.colorSecondary,
	'--color-brand-secondary': theme.colorBrandSecondary,
	'--color-bg': theme.colorBg,
	'--color-border': theme.colorBorder,
	'--color-card': theme.colorCard,
	'--color-article': theme.colorArticle
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='zh-CN' suppressHydrationWarning style={htmlStyle}>
			<Head />

			<body>
				<script
					dangerouslySetInnerHTML={{
						__html: `
					if (/windows|win32/i.test(navigator.userAgent)) {
						document.documentElement.classList.add('windows');
					}
					// 防 FOUC：在 React 水合前从 localStorage 读取主题模式并应用
					(function() {
						try {
							var mode = localStorage.getItem('blog-theme-mode') || 'light';
							var effective = mode;
							if (mode === 'auto') {
								effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
							}
							if (effective === 'dark') {
								var root = document.documentElement;
								var darkVars = {
									'--color-primary': '#e6e8e8',
									'--color-secondary': '#acadae',
									'--color-bg': '#0a051f',
									'--color-border': '#8a8a8a5e',
									'--color-card': '#ffffff0e',
									'--color-article': '#1a1a2e66',
									'--color-brand': '#35bfab',
									'--color-brand-secondary': '#1fc9e7'
								};
								for (var k in darkVars) root.style.setProperty(k, darkVars[k]);
								root.dataset.theme = 'dark';
								root.style.colorScheme = 'dark';
							} else {
								document.documentElement.dataset.theme = 'light';
								document.documentElement.style.colorScheme = 'light';
							}
						} catch (e) {}
					})();
		      `
					}}
				/>

				<Layout>{children}</Layout>
			</body>
		</html>
	)
}