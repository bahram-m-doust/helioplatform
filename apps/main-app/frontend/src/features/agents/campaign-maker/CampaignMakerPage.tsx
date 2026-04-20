import React from 'react';
import {
  AgentBackendChatPage,
  type AgentBackendChatDefinition,
} from '../shared/AgentBackendChatPage';
import { CAMPAIGN_MAKER_CHAT_API_URL } from '../../../shared/config/site';

const definition: AgentBackendChatDefinition = {
  title: 'Campaign Maker Agent',
  subtitle: 'Plan and structure campaigns with selected brand strategy profile.',
  introMessage: 'Welcome to Campaign Maker Agent.',
  endpointUrl: CAMPAIGN_MAKER_CHAT_API_URL,
  options: ['Mansory', 'Technogym', 'Binghatti'] as const,
  optionLabel: 'Select Brand',
  payloadOptionField: 'brand',
};

export default function CampaignMakerPage() {
  return <AgentBackendChatPage definition={definition} />;
}
