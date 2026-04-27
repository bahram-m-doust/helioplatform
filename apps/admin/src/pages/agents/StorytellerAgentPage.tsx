import { useState } from 'react';
import { ChatTester } from './ChatTester';

export function StorytellerAgentPage() {
  const [profile, setProfile] = useState<'Brand Language' | 'Language Style'>('Brand Language');
  return (
    <ChatTester
      title="Storyteller — live test"
      agent="storyteller"
      buildBody={(messages) => ({ profile, messages })}
      extraFields={
        <>
          <label>Profile</label>
          <select value={profile} onChange={(e) => setProfile(e.target.value as typeof profile)}>
            <option>Brand Language</option>
            <option>Language Style</option>
          </select>
        </>
      }
    />
  );
}
