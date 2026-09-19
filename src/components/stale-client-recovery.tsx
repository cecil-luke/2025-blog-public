'use client'

import { useEffect } from 'react'
import { installStaleClientRecovery } from '@/lib/stale-client-recovery'

export function StaleClientRecovery() {
	useEffect(() => installStaleClientRecovery(), [])
	return null
}
