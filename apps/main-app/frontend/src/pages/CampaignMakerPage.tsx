import React from 'react';
import { BrandedGeneratorAgentPage, type AgentDefinition } from '../components/agent/BrandedGeneratorAgentPage';
import { AGENT_BRAND_PROMPTS } from '../config/agentPrompts';

const definition: AgentDefinition = {
  title: 'Campaign Maker Agent',
  subtitle: 'Plan and structure campaigns with selected brand strategy profile.',
  introMessage:
    'Welcome to Campaign Maker Agent.',
  brandPrompts: { ...AGENT_BRAND_PROMPTS.campaignMaker },
};

export default function CampaignMakerPage() {
  return <BrandedGeneratorAgentPage definition={definition} />;
}
