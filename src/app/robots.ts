import type { MetadataRoute } from 'next'

// 站点正式域名，可用环境变量 NEXT_PUBLIC_SITE_URL 覆盖
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://lukias-blog.cc.cd').replace(/\/$/, '')

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/'
		},
		sitemap: `${SITE_URL}/sitemap.xml`
	}
}
