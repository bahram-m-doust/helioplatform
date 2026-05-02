import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useUIStore } from '@/stores/uiStore'
import { useDMStore } from '@/stores/dmStore'
import { ChatView } from '@/components/chat/ChatView'
import { DMChatView } from '@/components/dm/DMChatView'
import { WordmarkLogo } from '@/components/ui/WordmarkLogo'

export function MainPanel() {
  const { currentChannel, currentWorkspace } = useWorkspaceStore()
  const { view } = useUIStore()
  const { currentThread } = useDMStore()

  if (view === 'dm') {
    if (currentThread) {
      return (
        <div className="flex-1 flex flex-col min-w-0">
          <DMChatView />
        </div>
      )
    }
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
        Select a conversation
      </div>
    )
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div
            className="mx-auto inline-flex h-16 min-w-[220px] items-center justify-center rounded-lg border px-6 shadow-sm"
            style={{
              borderColor: 'var(--color-border-light)',
              backgroundColor: 'var(--color-surface-raised)',
            }}
          >
            <WordmarkLogo size="md" />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Welcome to Community</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Create or join a workspace to get started</p>
        </div>
      </div>
    )
  }

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
        Select a channel to start chatting
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ChatView />
    </div>
  )
}
