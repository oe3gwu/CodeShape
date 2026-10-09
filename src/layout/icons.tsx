import type { ReactNode } from 'react'

type IconName =
  | 'file'
  | 'folder'
  | 'save'
  | 'refresh'
  | 'fit'
  | 'cube'
  | 'eye'
  | 'eyeOff'
  | 'sun'
  | 'moon'
  | 'search'
  | 'close'
  | 'code'
  | 'origin'
  | 'export'
  | 'help'
  | 'chevron'
  | 'editor'
  | 'tree'
  | 'iso'
  | 'camera'
  | 'chat'

const paths: Record<IconName, ReactNode> = {
  file: <path d="M4 2.5h5l3 3V13.5H4zM9 2.5V6h3" />,
  folder: <path d="M2.5 4.5h4l1.2 1.3H13.5V12.5h-11z" />,
  save: <><path d="M3 2.5h8.2L13.5 4.8V13.5H3z" /><path d="M5 2.5V6h5.5" /><path d="M5 13.5v-3.5h6V13.5" /></>,
  refresh: <><path d="M12.8 6.2A4.8 4.8 0 1 0 13 9" /><path d="M13.2 3.2v3.2H10" /></>,
  fit: <><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" /></>,
  cube: <><path d="M8 2.2 13 5v6L8 13.8 3 11V5z" /><path d="M8 8.2 13 5M8 8.2 3 5M8 8.2v5.6" /></>,
  eye: <><path d="M1.5 8S3.8 4.2 8 4.2 14.5 8 14.5 8 12.2 11.8 8 11.8 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="1.7" /></>,
  eyeOff: <><path d="M2 3.5 14 13" /><path d="M6.2 5.2A6 6 0 0 1 8 4.8c3.6 0 6 3.2 6 3.2a9 9 0 0 1-1.6 1.8M4.2 6.4A9 9 0 0 0 2 8s2.4 3.2 6 3.2c.6 0 1.1-.1 1.6-.2" /></>,
  sun: <><circle cx="8" cy="8" r="2.3" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" /></>,
  moon: <path d="M9.2 2.2a4.8 4.8 0 1 0 4.6 6.6A4.2 4.2 0 0 1 9.2 2.2z" />,
  search: <><circle cx="7" cy="7" r="3.4" /><path d="M9.6 9.6 13 13" /></>,
  close: <path d="M4 4l8 8M12 4 4 12" />,
  code: <path d="M6 4.5 2.8 8 6 11.5M10 4.5 13.2 8 10 11.5" />,
  origin: <><path d="M8 8 13 8M8 8 8 3M8 8 4.2 11.2" /><circle cx="8" cy="8" r="1" /></>,
  export: <><path d="M8 2.5v7" /><path d="M5.2 6.8 8 9.6l2.8-2.8" /><path d="M3 10.5v3h10v-3" /></>,
  help: <><circle cx="8" cy="8" r="5.2" /><path d="M6.4 6.3a1.7 1.7 0 0 1 3.2.8c0 1.1-1.6 1.4-1.6 2.4" /><path d="M8 11.6h.01" /></>,
  chevron: <path d="M4 6.2 8 10l4-3.8" />,
  editor: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M8.5 3v10" /></>,
  tree: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M6.5 3v10" /></>,
  iso: <path d="M3 11.5 8 14l5-2.5V6.2L8 3.7 3 6.2zM8 8.6V14M8 8.6 13 6.2M8 8.6 3 6.2" />,
  camera: <><path d="M2.5 5.5h2l1.2-1.5h4.6L11.5 5.5h2v7h-11z" /><circle cx="8" cy="9" r="1.8" /></>,
  chat: <path d="M2.8 3.2h10.4v7.2H6.4L3.2 13V3.2z" />,
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="cs-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export type { IconName }
