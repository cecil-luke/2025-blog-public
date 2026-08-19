'use client'
import { PropsWithChildren } from 'react'
import { useCenterInit } from '@/hooks/use-center'
import BlurredBubblesBackground from './backgrounds/blurred-bubbles'
import NavCard from '@/components/nav-card'
import { Toaster } from 'sonner'
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { useSize, useSizeInit } from '@/hooks/use-size'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { ScrollTopButton } from '@/components/scroll-top-button'
import MusicCard from '@/components/music-card'
import MusicCardMobile from '@/components/music-card-mobile'
import { SearchPaletteContainer } from '@/components/search-palette-container'
import { Search } from 'lucide-react'

export default function Layout({ children }: PropsWithChildren) {
	useCenterInit()
	useSizeInit()
	const { cardStyles, siteContent, regenerateKey } = useConfigStore()
	const { maxSM, init } = useSize()

	const backgroundImages = (siteContent.backgroundImages ?? []) as Array<{ id: string; url: string }>
	const currentBackgroundImageId = siteContent.currentBackgroundImageId
	const currentBackgroundImage =
		currentBackgroundImageId && currentBackgroundImageId.trim() ? backgroundImages.find(item => item.id === currentBackgroundImageId) : null

	return (
		<>
			<Toaster
				position='bottom-right'
				richColors
				icons={{
					success: <CircleCheckIcon className='size-4' />,
					info: <InfoIcon className='size-4' />,
					warning: <TriangleAlertIcon className='size-4' />,
					error: <OctagonXIcon className='size-4' />,
					loading: <Loader2Icon className='size-4 animate-spin' />
				}}
				style={
					{
						'--border-radius': '12px'
					} as React.CSSProperties
				}
			/>
			{currentBackgroundImage && (
				<div
					className='fixed inset-0 z-0 overflow-hidden'
					style={{
						backgroundImage: `url(${currentBackgroundImage.url})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					}}
				/>
			)}
			<BlurredBubblesBackground colors={siteContent.backgroundColors} regenerateKey={regenerateKey} />

			<main className='relative z-10 h-full'>
				{children}
				<NavCard />

				{!maxSM && cardStyles.musicCard?.enabled !== false && <MusicCard />}
				{maxSM && init && cardStyles.musicCard?.enabled !== false && <MusicCardMobile />}
			</main>

			{maxSM && init && (
				<button
					type='button'
					aria-label='搜索文章'
					onClick={() => window.dispatchEvent(new CustomEvent('dsh-toggle-search-palette'))}
					className='bg-brand/20 hover:bg-brand/30 fixed right-6 z-50 flex size-12 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-colors'
					style={{ bottom: 'calc(15rem + env(safe-area-inset-bottom))' }}>
					<Search className='size-5 text-primary' />
				</button>
			)}

			{maxSM && init && <ScrollTopButton className='bg-brand/20 fixed right-6 z-50 shadow-md' style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }} />}

			<SearchPaletteContainer />
		</>
	)
}