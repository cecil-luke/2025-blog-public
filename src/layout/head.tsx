import Script from 'next/script'

export default function Head() {
	return (
		<head>
			<meta name='viewport' content='width=device-width, initial-scale=1.0' />
			<meta name='color-scheme' content='light dark' />
			<meta name='theme-color' content='#d4e8f3' />
			<link rel='manifest' href='/manifest.json' />

			<link rel='icon' href='/favicon.png' />

			<link rel='preconnect' href='https://fonts.googleapis.cn' />
			<link rel='preconnect' href='https://fonts.gstatic.cn' crossOrigin='anonymous' />

			<link href='https://fonts.googleapis.cn/css2?family=Averia+Gruesa+Libre&display=swap' rel='stylesheet' />

			<Script src='https://www.googletagmanager.com/gtag/js?id=G-BH7395Z46Y' />
			<Script id='google-analytics'>
				{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-BH7395Z46Y');
        `}
			</Script>
		</head>
	)
}
