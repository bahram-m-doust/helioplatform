import binghattiCampaignMakerPrompt from '../prompts/agents/binghatti-campaign-maker.txt?raw';
import binghattiImagePrompt from '../prompts/agents/binghatti-image.txt?raw';
import mansoryCampaignMakerPrompt from '../prompts/agents/mansory-campaign-maker.txt?raw';
import mansoryImagePrompt from '../prompts/agents/mansory-image.txt?raw';
import technogymCampaignMakerPrompt from '../prompts/agents/technogym-campaign-maker.txt?raw';
import technogymImagePrompt from '../prompts/agents/technogym-image.txt?raw';
import storytellerLanguageStylePrompt from '../prompts/agents/language-style.txt?raw';
import storytellerBrandLanguagePrompt from '../prompts/agents/brand-language.txt?raw';

const normalizePrompt = (prompt: string): string =>
  prompt
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

export const AGENT_BRAND_PROMPTS = {
  image: {
    Mansory: normalizePrompt(mansoryImagePrompt),
    Technogym: normalizePrompt(technogymImagePrompt),
    Binghatti: normalizePrompt(binghattiImagePrompt),
  },
  campaignMaker: {
    Mansory: normalizePrompt(mansoryCampaignMakerPrompt),
    Technogym: normalizePrompt(technogymCampaignMakerPrompt),
    Binghatti: normalizePrompt(binghattiCampaignMakerPrompt),
  },
  storyteller: {
    'Language Style': normalizePrompt(storytellerLanguageStylePrompt),
    'Brand Language': normalizePrompt(storytellerBrandLanguagePrompt),
  },
} as const;
