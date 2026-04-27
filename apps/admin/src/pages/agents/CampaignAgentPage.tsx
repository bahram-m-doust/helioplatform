import { useState } from 'react';
import { ChatTester } from './ChatTester';

export function CampaignAgentPage() {
  const [brand, setBrand] = useState<'Mansory' | 'Technogym' | 'Binghatti'>('Binghatti');
  return (
    <ChatTester
      title="Campaign Maker — live test"
      agent="campaign"
      buildBody={(messages) => ({ brand, messages })}
      extraFields={
        <>
          <label>Brand profile</label>
          <select value={brand} onChange={(e) => setBrand(e.target.value as typeof brand)}>
            <option>Mansory</option>
            <option>Technogym</option>
            <option>Binghatti</option>
          </select>
        </>
      }
    />
  );
}
