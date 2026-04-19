import React from 'react';
import { BrandedGeneratorAgentPage, type AgentDefinition } from '../components/agent/BrandedGeneratorAgentPage';
import { AGENT_BRAND_PROMPTS } from '../config/agentPrompts';

const definition: AgentDefinition = {
  title: 'Storyteller Agent',
  subtitle: 'Narrative storytelling aligned with your chosen Language Style or Brand Language profile.',
  introMessage:
    "Welcome to Storyteller. Tell me the moment, audience, and what you want the story to do — then pick a profile above (Language Style or Brand Language) and we'll shape the narrative together.",
  brandPrompts: { ...AGENT_BRAND_PROMPTS.storyteller },
  optionLabel: 'Select Profile',
};

export default function StorytellerPage() {
  return <BrandedGeneratorAgentPage definition={definition} />;
}
