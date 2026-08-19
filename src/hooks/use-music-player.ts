'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface Track {
	name: string
	src: string
}

// 兜底播放列表：与 public/music/list.json 保持一致，清单拉取失败时使用
export const FALLBACK_TRACKS: Track[] = [
	{ name: 'Close To You', src: '/music/close-to-you.mp3' },
	{ name: 'Christmas', src: '/music/christmas.m4a' }
]

export interface MusicPlayerState {
	tracks: Track[]
	currentIndex: number
	isPlaying: boolean
	progress: number
	currentTrack: Track | undefined
	play: () => void
	pause: () => void
	togglePlayPause: () => void
	playTrack: (index: number) => void
	playPrev: () => void
	playNext: () => void
	seek: (percent: number) => void
}

/**
 * 音乐播放内核
 * - 运行时 fetch('/music/list.json') 读取曲目清单，失败回退兜底列表
 * - ended 事件自动切下一首循环播放；单曲列表从头循环重播
 * - 通过 ref 规避 audio 事件回调的闭包陷阱
 * - 监听 visibilitychange：页面不可见时自动暂停（省电 + 移动端合规），
 *   visible 时不自动恢复（由用户手动续播）
 */
export function useMusicPlayer(enabled = true): MusicPlayerState {
	const [tracks, setTracks] = useState<Track[]>(FALLBACK_TRACKS)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [progress, setProgress] = useState(0)
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const currentIndexRef = useRef(0)
	const tracksRef = useRef<Track[]>(FALLBACK_TRACKS)
	const loadedSrcRef = useRef<string | null>(null)
	const isPlayingRef = useRef(false)

	const currentTrack = tracks[currentIndex]

	// 拉取 public/music/ 播放列表
	useEffect(() => {
		if (!enabled) return
		let cancelled = false
		fetch('/music/list.json')
			.then(res => (res.ok ? res.json() : null))
			.then((data: Track[] | null) => {
				if (cancelled) return
				if (!Array.isArray(data) || data.length === 0) return
				setTracks(data)
				setCurrentIndex(prev => (prev < data.length ? prev : 0))
			})
			.catch(() => {
				// 清单拉取失败时继续使用兜底列表
			})
		return () => {
			cancelled = true
		}
	}, [enabled])

	// 同步 ref，供 audio 事件回调读取最新值
	useEffect(() => {
		currentIndexRef.current = currentIndex
	}, [currentIndex])

	useEffect(() => {
		tracksRef.current = tracks
	}, [tracks])

	useEffect(() => {
		isPlayingRef.current = isPlaying
	}, [isPlaying])

	// Initialize audio element + 事件监听
	useEffect(() => {
		if (!enabled) return
		if (!audioRef.current) {
			audioRef.current = new Audio()
		}

		const audio = audioRef.current

		const updateProgress = () => {
			if (audio.duration) {
				setProgress((audio.currentTime / audio.duration) * 100)
			}
		}

		const handleEnded = () => {
			const list = tracksRef.current
			if (list.length === 0) return

			// 单曲列表：从头循环重播
			if (list.length === 1) {
				audio.currentTime = 0
				audio.play().catch(console.error)
				return
			}

			// 播完自动切下一首循环播放
			const nextIndex = (currentIndexRef.current + 1) % list.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
		}

		const handleTimeUpdate = () => updateProgress()
		const handleLoadedMetadata = () => updateProgress()

		audio.addEventListener('timeupdate', handleTimeUpdate)
		audio.addEventListener('ended', handleEnded)
		audio.addEventListener('loadedmetadata', handleLoadedMetadata)

		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate)
			audio.removeEventListener('ended', handleEnded)
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
		}
	}, [enabled])

	// Handle currentIndex change - load new audio src
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		const track = tracks[currentIndex]
		if (!track) return
		// src 未变（如清单刷新后数组替换）时跳过，避免播放中从头重来
		if (loadedSrcRef.current === track.src) return
		loadedSrcRef.current = track.src
		audio.src = track.src
		audio.loop = false
		setProgress(0)
	}, [currentIndex, tracks])

	// Handle play/pause state change（依赖 currentIndex：切歌后仍按 isPlaying 播放/暂停）
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return

		if (isPlaying) {
			audio.play().catch(err => {
				// iOS/自动播放策略失败时回退为暂停态
				setIsPlaying(false)
				console.error(err)
			})
		} else {
			audio.pause()
		}
	}, [isPlaying, currentIndex, tracks])

	// visibilitychange：不可见时自动暂停（省电 + 移动端合规）
	useEffect(() => {
		if (!enabled) return
		const handleVisibility = () => {
			if (document.hidden && isPlayingRef.current) {
				setIsPlaying(false)
			}
		}
		document.addEventListener('visibilitychange', handleVisibility)
		return () => document.removeEventListener('visibilitychange', handleVisibility)
	}, [enabled])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.src = ''
			}
		}
	}, [])

	const togglePlayPause = useCallback(() => {
		setIsPlaying(prev => !prev)
	}, [])

	const play = useCallback(() => setIsPlaying(true), [])
	const pause = useCallback(() => setIsPlaying(false), [])

	const playTrack = useCallback((index: number) => {
		setCurrentIndex(index)
		setIsPlaying(true)
	}, [])

	const playPrev = useCallback(() => {
		setTracks(prevTracks => {
			const length = prevTracks.length
			if (length === 0) return prevTracks
			setCurrentIndex(prev => (prev - 1 + length) % length)
			return prevTracks
		})
	}, [])

	const playNext = useCallback(() => {
		setTracks(prevTracks => {
			const length = prevTracks.length
			if (length === 0) return prevTracks
			setCurrentIndex(prev => (prev + 1) % length)
			return prevTracks
		})
	}, [])

	const seek = useCallback((percent: number) => {
		const audio = audioRef.current
		if (!audio || !audio.duration || !audio.seekable.length) return
		audio.currentTime = (percent / 100) * audio.duration
		setProgress(percent)
	}, [])

	return {
		tracks,
		currentIndex,
		isPlaying,
		progress,
		currentTrack,
		play,
		pause,
		togglePlayPause,
		playTrack,
		playPrev,
		playNext,
		seek
	}
}
