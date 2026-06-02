'use client'

import dynamic from 'next/dynamic'

// ssr: false must live in a Client Component — not allowed in Server Components.
// This thin wrapper is the boundary that makes it legal.
const NewProjectForm = dynamic(() => import('./NewProjectForm'), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-96 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        <span className="text-sm">Chargement du formulaire…</span>
      </div>
    </div>
  ),
})

export default NewProjectForm
