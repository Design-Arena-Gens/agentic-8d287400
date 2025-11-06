'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const UniverseSandbox = dynamic(() => import('../components/UniverseSandbox'), {
  ssr: false,
  loading: () => (
    <div className="loading">
      <h2>Loading Universe Sandbox...</h2>
      <div className="spinner"></div>
    </div>
  ),
})

export default function Home() {
  return <UniverseSandbox />
}
