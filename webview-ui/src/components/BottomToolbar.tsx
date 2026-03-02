import { useState, useEffect, useRef } from 'react'
import { SettingsModal } from './SettingsModal.js'
import type { WorkspaceFolder, AgentProviderInfo } from '../hooks/useExtensionMessages.js'

interface BottomToolbarProps {
  isEditMode: boolean
  onLaunchAgent: (providerId: string, folderPath?: string) => void
  availableProviders: AgentProviderInfo[]
  onToggleEditMode: () => void
  isDebugMode: boolean
  onToggleDebugMode: () => void
  workspaceFolders: WorkspaceFolder[]
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  zIndex: 'var(--pixel-controls-z)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '4px 6px',
  boxShadow: 'var(--pixel-shadow)',
}

const btnBase: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '24px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--pixel-active-bg)',
  border: '2px solid var(--pixel-accent)',
}


export function BottomToolbar({
  isEditMode,
  onLaunchAgent,
  availableProviders,
  onToggleEditMode,
  isDebugMode,
  onToggleDebugMode,
  workspaceFolders,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false)
  const [isProviderPickerOpen, setIsProviderPickerOpen] = useState(false)
  const [hoveredFolder, setHoveredFolder] = useState<number | null>(null)
  const [hoveredProvider, setHoveredProvider] = useState<number | null>(null)
  const [pendingFolderPath, setPendingFolderPath] = useState<string | undefined>(undefined)
  const folderPickerRef = useRef<HTMLDivElement>(null)
  const providerPickerRef = useRef<HTMLDivElement>(null)

  // Close folder picker on outside click
  useEffect(() => {
    if (!isFolderPickerOpen) return
    const handleClick = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setIsFolderPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isFolderPickerOpen])

  // Close provider picker on outside click
  useEffect(() => {
    if (!isProviderPickerOpen) return
    const handleClick = (e: MouseEvent) => {
      if (providerPickerRef.current && !providerPickerRef.current.contains(e.target as Node)) {
        setIsProviderPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isProviderPickerOpen])

  const hasMultipleFolders = workspaceFolders.length > 1
  const hasMultipleProviders = availableProviders.length > 1

  const handleAgentClick = () => {
    if (hasMultipleFolders) {
      setIsFolderPickerOpen((v) => !v)
      setIsProviderPickerOpen(false)
    } else if (hasMultipleProviders) {
      setPendingFolderPath(undefined)
      setIsProviderPickerOpen((v) => !v)
      setIsFolderPickerOpen(false)
    } else {
      const providerId = availableProviders.length > 0 ? availableProviders[0].id : 'claude-code'
      onLaunchAgent(providerId)
    }
  }

  const handleFolderSelect = (folder: WorkspaceFolder) => {
    setIsFolderPickerOpen(false)
    if (hasMultipleProviders) {
      setPendingFolderPath(folder.path)
      setIsProviderPickerOpen(true)
    } else {
      const providerId = availableProviders.length > 0 ? availableProviders[0].id : 'claude-code'
      onLaunchAgent(providerId, folder.path)
    }
  }

  const handleProviderSelect = (providerId: string) => {
    setIsProviderPickerOpen(false)
    onLaunchAgent(providerId, pendingFolderPath)
    setPendingFolderPath(undefined)
  }

  return (
    <div style={panelStyle}>
      <div ref={folderPickerRef} style={{ position: 'relative' }}>
        <button
          onClick={handleAgentClick}
          onMouseEnter={() => setHovered('agent')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...btnBase,
            padding: '5px 12px',
            background:
              hovered === 'agent' || isFolderPickerOpen || isProviderPickerOpen
                ? 'var(--pixel-agent-hover-bg)'
                : 'var(--pixel-agent-bg)',
            border: '2px solid var(--pixel-agent-border)',
            color: 'var(--pixel-agent-text)',
          }}
        >
          + Agent
        </button>
        {isFolderPickerOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: 'var(--pixel-bg)',
              border: '2px solid var(--pixel-border)',
              borderRadius: 0,
              boxShadow: 'var(--pixel-shadow)',
              minWidth: 160,
              zIndex: 'var(--pixel-controls-z)',
            }}
          >
            {workspaceFolders.map((folder, i) => (
              <button
                key={folder.path}
                onClick={() => handleFolderSelect(folder)}
                onMouseEnter={() => setHoveredFolder(i)}
                onMouseLeave={() => setHoveredFolder(null)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  fontSize: '22px',
                  color: 'var(--pixel-text)',
                  background: hoveredFolder === i ? 'var(--pixel-btn-hover-bg)' : 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {folder.name}
              </button>
            ))}
          </div>
        )}
      {isProviderPickerOpen && (
        <div
          ref={providerPickerRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: 'var(--pixel-bg)',
            border: '2px solid var(--pixel-border)',
            borderRadius: 0,
            boxShadow: 'var(--pixel-shadow)',
            minWidth: 160,
            zIndex: 'var(--pixel-controls-z)',
          }}
        >
          {availableProviders.map((provider, i) => (
            <button
              key={provider.id}
              onClick={() => handleProviderSelect(provider.id)}
              onMouseEnter={() => setHoveredProvider(i)}
              onMouseLeave={() => setHoveredProvider(null)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                fontSize: '22px',
                color: 'var(--pixel-text)',
                background: hoveredProvider === i ? 'var(--pixel-btn-hover-bg)' : 'transparent',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {provider.displayName}
            </button>
          ))}
        </div>
      )}
      </div>
      <button
        onClick={onToggleEditMode}
        onMouseEnter={() => setHovered('edit')}
        onMouseLeave={() => setHovered(null)}
        style={
          isEditMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'edit' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title="Edit office layout"
      >
        Layout
      </button>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsSettingsOpen((v) => !v)}
          onMouseEnter={() => setHovered('settings')}
          onMouseLeave={() => setHovered(null)}
          style={
            isSettingsOpen
              ? { ...btnActive }
              : {
                  ...btnBase,
                  background: hovered === 'settings' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
                }
          }
          title="Settings"
        >
          Settings
        </button>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDebugMode={isDebugMode}
          onToggleDebugMode={onToggleDebugMode}
        />
      </div>
    </div>
  )
}
