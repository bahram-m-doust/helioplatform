import { ChatTester } from './ChatTester';

export function SoulPrintAgentPage() {
  return (
    <ChatTester
      title="Soul Print — live test"
      agent="soul-print"
      buildBody={(messages) => ({ messages })}
      welcome="Welcome to Soul Print. Tell me your name to begin."
    />
  );
}
