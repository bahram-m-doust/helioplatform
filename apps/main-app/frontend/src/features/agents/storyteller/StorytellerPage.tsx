import React from 'react';
import {
  AgentBackendChatPage,
  type AgentBackendChatDefinition,
} from '../shared/AgentBackendChatPage';
import { STORYTELLER_CHAT_API_URL } from '../../../shared/config/site';

const definition: AgentBackendChatDefinition = {
  title: 'Storyteller Agent',
  subtitle:
    'Narrative storytelling aligned with your chosen Language Style or Brand Language profile.',
  introMessage:
    "Welcome to Storyteller. Tell me the moment, audience, and what you want the story to do — then pick a profile above (Language Style or Brand Language) and we'll shape the narrative together.",
  endpointUrl: STORYTELLER_CHAT_API_URL,
  options: ['Brand Language', 'Language Style'] as const,
  optionLabel: 'Select Profile',
  payloadOptionField: 'profile',
};

export default function StorytellerPage() {
  return <AgentBackendChatPage definition={definition} />;
}
