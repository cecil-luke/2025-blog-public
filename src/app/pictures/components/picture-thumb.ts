// 图床缩略图 URL 映射
// 墙展示用缩略图(public/images/pictures/sm/<base>.webp,600px 宽),
// 放大查看用原图。仅对本地 /images/pictures/ 路径做映射,
// 外链或其它路径原样返回,搭配 <img onError> 回退到原图,保证缩略图缺失时不破图。

const PREFIX = '/images/pictures/'

export function thumbUrl(url: string): string {
	if (typeof url !== 'string' || !url.startsWith(PREFIX)) return url
	const name = url.slice(PREFIX.length)
	const dot = name.lastIndexOf('.')
	const base = dot > 0 ? name.slice(0, dot) : name
	return `${PREFIX}sm/${base}.webp`
}

/** 由原图 URL 推出缩略图在仓库中的相对路径(如 public/images/pictures/sm/<base>.webp),用于删除时连缩略图一起清理。非本地图床路径返回 null。 */
export function thumbRepoPath(url: string): string | null {
	if (typeof url !== 'string' || !url.startsWith(PREFIX)) return null
	const name = url.slice(PREFIX.length)
	const dot = name.lastIndexOf('.')
	const base = dot > 0 ? name.slice(0, dot) : name
	return `public/images/pictures/sm/${base}.webp`
}
