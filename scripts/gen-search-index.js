const fs = require('fs')
const path = require('path')

// 站内搜索索引生成器
// 扫描 public/blogs/index.json 及各文章 index.md,
// 生成 public/search-index.json (slug, title, tags, summary, date, contentText, headings)。
// 构建期执行,随部署更新;客户端首次唤起命令面板或访问 /search 时懒加载。

const ROOT = path.join(__dirname, '..')
const BLOGS_DIR = path.join(ROOT, 'public', 'blogs')
const INDEX_FILE = path.join(BLOGS_DIR, 'index.json')
const OUT_FILE = path.join(ROOT, 'public', 'search-index.json')

// 反引号字符常量,避免模板字符串冲突
const BT = String.fromCharCode(96)
const BT3 = BT + BT + BT

/**
 * 将 Markdown 去掉语法标记,提取纯文本。
 * 去除代码块、行内代码、图片、HTML 标签、Markdown 标记符号。
 * 保留换行,多个连续空白合并为单个空格。
 */
function markdownToPlainText(md) {
  if (!md) return ''
  let text = md
  // 去除代码块 (三个反引号包裹)
  const codeBlockRe = new RegExp(BT3 + '[\\s\\S]*?' + BT3, 'g')
  text = text.replace(codeBlockRe, ' ')
  // 去除行内代码 (单个反引号包裹)
  const inlineCodeRe = new RegExp(BT + '[^' + BT + ']+' + BT, 'g')
  text = text.replace(inlineCodeRe, m => m.slice(1, -1))
  // 去除图片 ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  // 链接 [text](url) -> text
  text = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
  // HTML 标签
  text = text.replace(/<[^>]+>/g, ' ')
  // 标题井号、列表符号、引用符号
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/^[\-*+]\s+/gm, '')
  text = text.replace(/^>\s*/gm, '')
  // 加粗/斜体
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  // 删除线
  text = text.replace(/~~([^~]+)~~/g, '$1')
  // 水平线
  text = text.replace(/^---+$/gm, ' ')
  // 合并空白
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

/**
 * 从 Markdown 提取标题树 (h1-h3)。
 * 返回 [{ level, text }] 数组,用于精准搜索与结果展示。
 */
function extractHeadings(md) {
  const headings = []
  if (!md) return headings
  const lines = md.split('\n')
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/)
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim() })
    }
  }
  return headings
}

function main() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error('索引文件不存在:', INDEX_FILE)
    process.exit(1)
  }

  const blogIndex = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'))
  if (!Array.isArray(blogIndex)) {
    console.error('index.json 不是数组')
    process.exit(1)
  }

  const searchIndex = []
  let skipped = 0

  for (const item of blogIndex) {
    const slug = item.slug
    if (!slug) {
      skipped++
      continue
    }

    const mdPath = path.join(BLOGS_DIR, slug, 'index.md')
    let contentText = ''
    let headings = []

    if (fs.existsSync(mdPath)) {
      const md = fs.readFileSync(mdPath, 'utf-8')
      contentText = markdownToPlainText(md)
      headings = extractHeadings(md)
    }

    searchIndex.push({
      slug,
      title: item.title || slug,
      tags: item.tags || [],
      date: item.date || '',
      summary: item.summary || '',
      hidden: !!item.hidden,
      category: item.category || '',
      contentText,
      headings
    })
  }

  const json = JSON.stringify(searchIndex)
  fs.writeFileSync(OUT_FILE, json)

  const totalChars = searchIndex.reduce((sum, item) => sum + (item.contentText || '').length, 0)
  console.log('Generated ' + OUT_FILE)
  console.log('  Articles: ' + searchIndex.length + ' (skipped: ' + skipped + ')')
  console.log('  Total content text: ' + totalChars + ' chars (~' + (totalChars / 1024).toFixed(1) + ' KB)')
  console.log('  Index file size: ' + json.length + ' chars (~' + (json.length / 1024).toFixed(1) + ' KB)')
}

main()
