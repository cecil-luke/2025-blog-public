const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

// 图床缩略图生成器
// 为 public/images/pictures/ 下的每张图片生成 600px 宽的 webp 缩略图,
// 输出到 public/images/pictures/sm/<base>.webp。
// 墙体展示(移动端 200px / 桌面端 130px)在 3× 高分屏下 600px 已足够清晰,
// 而体积只有原图的 1/3 ~ 1/8,显著降低带宽、解码与内存压力,消除"越往后越卡"。
// 放大查看仍走原图(组件里单独加载),缩略图只服务墙展示。
//
// 依赖 cwebp(libwebp)。macOS: brew install webp;Linux: apt install webp。
// 增量执行:缩略图已存在且新于源文件则跳过。

const ROOT = path.join(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'public', 'images', 'pictures')
const OUT_DIR = path.join(SRC_DIR, 'sm')

const MAX_WIDTH = 600
const QUALITY = 80
const EXTS = ['.webp', '.jpg', '.jpeg', '.png']

function hasCwebp() {
	try {
		execFileSync('cwebp', ['-version'], { stdio: 'ignore' })
		return true
	} catch {
		return false
	}
}

function srcFiles() {
	return fs
		.readdirSync(SRC_DIR, { withFileTypes: true })
		.filter(e => e.isFile() && EXTS.includes(path.extname(e.name).toLowerCase()))
		.map(e => e.name)
}

function main() {
	if (!fs.existsSync(SRC_DIR)) {
		console.error('源目录不存在:', SRC_DIR)
		process.exit(1)
	}
	if (!hasCwebp()) {
		console.error('未找到 cwebp,请先安装 libwebp(macOS: brew install webp)。')
		process.exit(1)
	}

	fs.mkdirSync(OUT_DIR, { recursive: true })

	const files = srcFiles()
	let generated = 0
	let skipped = 0
	let failed = 0

	for (const name of files) {
		const srcPath = path.join(SRC_DIR, name)
		const base = path.basename(name, path.extname(name))
		const outPath = path.join(OUT_DIR, base + '.webp')

		// 增量:缩略图存在且不早于源文件则跳过
		if (fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= fs.statSync(srcPath).mtimeMs) {
			skipped++
			continue
		}

		try {
			// -resize W 0:宽度限定为 W,高度按比例缩放(0 = 保持比例)
			execFileSync('cwebp', ['-q', String(QUALITY), '-resize', String(MAX_WIDTH), '0', srcPath, '-o', outPath], {
				stdio: 'ignore'
			})
			generated++
		} catch (err) {
			console.error('生成失败:', name, err.message)
			failed++
		}
	}

	console.log(`图床缩略图: 生成 ${generated}, 跳过 ${skipped}, 失败 ${failed}, 共 ${files.length} 张`)
	console.log('输出目录:', OUT_DIR)
}

main()
