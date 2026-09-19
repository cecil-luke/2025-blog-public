import { unstable_noStore as noStore } from 'next/cache'

export default function NotFound() {
	noStore()
	return <div className='text-secondary flex min-h-[50vh] items-center justify-center text-sm'>页面不存在</div>
}
