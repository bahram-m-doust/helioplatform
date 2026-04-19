import type { LucideIcon } from 'lucide-react';
import {
  Users,
  UserCircle2,
  Building2,
  Package,
  Globe2,
  Palette,
} from 'lucide-react';

export interface QuestionnaireQuestion {
  id: string;
  title: string;
  guide: string;
}

export interface QuestionnaireSection {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  questions: QuestionnaireQuestion[];
}

export const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    id: 'consumer-market-segmentation',
    slug: 'consumer-market-segmentation',
    title: 'Consumer / Market Segmentation',
    subtitle: 'Define who your audiences are and how they differ.',
    icon: Users,
    accent: 'from-yellow-400/20 to-yellow-400/5',
    questions: [
      {
        id: 'primary-main-secondary-audiences',
        title: 'Definition of primary, main, and secondary target audiences',
        guide:
          'Define your primary, main, and secondary target audience groups, explaining their differences and priorities.',
      },
      {
        id: 'audience-demographics',
        title: 'Target Audience Demographics Definition',
        guide: 'Provide demographic details (age, gender, location, income, etc.) about your target audience.',
      },
      {
        id: 'audience-psychographics',
        title: 'Target Audience Psychographics Definition',
        guide:
          'Identify the psychographic traits of your target audience — lifestyle, interests, attitudes, and values.',
      },
      {
        id: 'audience-economic',
        title: 'Target Audience Economic Characteristics',
        guide:
          'Describe the economic characteristics of your target audience, such as income level, purchasing power, and spending habits.',
      },
      {
        id: 'audience-sociographic',
        title: 'Target Audience Sociographic',
        guide:
          'Provide sociographic insights, including social status, group affiliations, and cultural influences of your target audience.',
      },
    ],
  },
  {
    id: 'user-persona',
    slug: 'user-persona',
    title: 'User Persona',
    subtitle: 'Give your audiences a face, a story, and a set of values.',
    icon: UserCircle2,
    accent: 'from-sky-400/20 to-sky-400/5',
    questions: [
      {
        id: 'target-personas',
        title: 'Target Personas',
        guide:
          'Create detailed profiles of your target personas, including demographic, psychographic, and behavioral information.',
      },
      {
        id: 'personas-lifestyle',
        title: 'Target Personas and Lifestyle',
        guide:
          'Describe the lifestyles of your target personas, including daily routines, hobbies, and leisure activities.',
      },
      {
        id: 'personas-pains',
        title: 'The Pains of Target Personas',
        guide:
          'Identify the fears, concerns, or pain points that your target personas want to avoid or overcome.',
      },
      {
        id: 'personas-values',
        title: 'The Values of Target Personas',
        guide:
          'Outline the core values that your target personas hold, which influence their purchasing decisions.',
      },
      {
        id: 'personas-aspirations',
        title: 'The Aspirations of Target Personas',
        guide:
          'Describe the aspirations, dreams, and goals of your target personas to understand what motivates them.',
      },
      {
        id: 'personas-hobbies',
        title: "Target Persona's Hobbies",
        guide:
          'List common hobbies and interests of your target personas that may influence their purchasing decisions.',
      },
      {
        id: 'personas-personality',
        title: "Target Persona's Personality & Temperament",
        guide:
          'Describe the personality traits and temperament of your target personas (e.g., extroverted, analytical, adventurous).',
      },
    ],
  },
  {
    id: 'company',
    slug: 'company',
    title: 'COMPANY',
    subtitle: 'Articulate your brand from essence to mission.',
    icon: Building2,
    accent: 'from-emerald-400/20 to-emerald-400/5',
    questions: [
      {
        id: 'company-overview',
        title: 'Company Overview / Introduction',
        guide:
          'Write a brief introduction to your brand, including its name, industry, founding date, and a summary of what it offers.',
      },
      {
        id: 'brand-essence',
        title: 'Brand Essence / Core Values',
        guide:
          "Define the fundamental idea or emotional core that represents your brand's identity and purpose. Summarize the timeless value and personality that remain consistent across all products and communications.",
      },
      {
        id: 'company-background',
        title: 'Company Background',
        guide:
          "Provide an overview of your company's history, including founding story, key milestones, and evolution over time.",
      },
      {
        id: 'present-narrative',
        title: 'Present Narrative',
        guide:
          "Describe your brand's current story — how it is perceived today, what stage it is in, and how customers relate to it at this moment.",
      },
      {
        id: 'future-narrative',
        title: 'Future Narrative',
        guide:
          "Illustrate the envisioned story of your brand's future — where it aims to go, how it will evolve, and what long-term impact it seeks to create.",
      },
      {
        id: 'brand-archetype',
        title: 'Brand Archetype',
        guide:
          "Identify the archetype that best represents your brand (e.g., hero, caregiver, explorer) and explain why this archetype aligns with your brand's personality.",
      },
      {
        id: 'brand-architecture',
        title: 'Brand Architecture',
        guide:
          'Describe how your various sub-brands or product lines are organized under the overarching brand (e.g., branded house vs. house of brands).',
      },
      {
        id: 'brand-positioning',
        title: 'Brand Positioning',
        guide:
          'Explain how your brand is positioned in the market relative to competitors, including target segment, unique benefits, and perceived value.',
      },
      {
        id: 'brand-purpose',
        title: 'Brand Purpose',
        guide:
          'Define the underlying reason your brand exists beyond making profit, such as the social or emotional impact it aims to have.',
      },
      {
        id: 'brand-vision',
        title: 'Brand Vision',
        guide:
          'Express the vision statement for the brand, describing the ideal future state the company aims to achieve.',
      },
      {
        id: 'brand-mission',
        title: 'Brand Mission',
        guide:
          'State the specific mission statement for the brand — its purpose and objectives within the broader business context.',
      },
      {
        id: 'brand-slogan',
        title: 'Brand Slogan',
        guide:
          "Write a concise and memorable slogan that captures the brand's promise, emotional impact, or key differentiator in a few powerful words.",
      },
      {
        id: 'brand-strategic-resources',
        title: 'Brand Strategic Resources',
        guide:
          'Identify key resources (e.g., human, financial, technological) that your brand relies on to execute its strategy.',
      },
      {
        id: 'key-success-factors',
        title: 'Key Success Factors',
        guide:
          'Identify the critical factors that determine success for your brand or business (e.g., product quality, customer satisfaction, innovation).',
      },
      {
        id: 'current-revenue-model',
        title: 'Current Revenue Model',
        guide:
          'Describe the current revenue streams of your brand — how it generates income through sales, subscriptions, services, or partnerships.',
      },
      {
        id: 'strategic-partners',
        title: 'Strategic Partners',
        guide:
          "Identify important external partners, organizations, or suppliers that support your brand's growth, distribution, or innovation strategy.",
      },
    ],
  },
  {
    id: 'products-services',
    slug: 'products-services',
    title: 'Products / Services',
    subtitle: 'Detail what you offer and how it stands out.',
    icon: Package,
    accent: 'from-rose-400/20 to-rose-400/5',
    questions: [
      {
        id: 'product-groups',
        title: 'Product / Service Groups',
        guide:
          'Categorize the products into groups or lines and provide a brief description of each group.',
      },
      {
        id: 'price-positioning',
        title: 'Product / Services Price Positioning',
        guide:
          'Explain how products are positioned in the market relative to competitors, including target audience and distinguishing attributes.',
      },
      {
        id: 'product-features',
        title: 'Product / Services Features',
        guide: 'Describe the key features of each product that customers should know.',
      },
      {
        id: 'solution-offering-pain',
        title: 'Product / Services Solution Offering (Pain Related)',
        guide:
          'Explain how your product or service directly solves customer pain points — what problems it removes, eases, or transforms into positive experiences.',
      },
      {
        id: 'competitive-advantage',
        title: "Product / Services's Competitive Advantage",
        guide:
          'Explain the competitive advantages of products — what makes them better or different from competitors.',
      },
      {
        id: 'emotional-functional-benefits',
        title: 'Product / Services Benefits (Emotional & Functional)',
        guide: 'List both emotional and functional benefits that products provide to customers.',
      },
      {
        id: 'product-swot',
        title: 'Product / Services SWOT',
        guide:
          'Conduct a SWOT analysis for products — list strengths, weaknesses, opportunities, and threats.',
      },
      {
        id: 'product-pod',
        title: 'Product / Services POD',
        guide:
          'Identify the Points of Difference (POD) that set products apart from others in the market.',
      },
      {
        id: 'product-pop',
        title: 'Product / Services POP',
        guide:
          'Clarify the Points of Parity (POP) for products — attributes or benefits that are essential to meet industry standards or customer expectations.',
      },
      {
        id: 'development-roadmap',
        title: 'Product / Service Development Strategy / Roadmap',
        guide:
          'Outline the development plan or roadmap for your products or services, including stages of innovation, testing, and market release.',
      },
      {
        id: 'marketing-plans',
        title: 'Marketing Plans and Strategy',
        guide:
          'Outline your overall marketing plan and strategy — objectives, tactics, channels, budget, and measurement of success.',
      },
      {
        id: 'sales-strategy',
        title: 'Sales Strategy',
        guide:
          'Provide details on your sales strategy — how you plan to convert leads into customers, pricing models, and sales team structure.',
      },
    ],
  },
  {
    id: 'context',
    slug: 'context',
    title: 'Context',
    subtitle: 'Map out the market, competitors, and trends around you.',
    icon: Globe2,
    accent: 'from-indigo-400/20 to-indigo-400/5',
    questions: [
      {
        id: 'market-overview',
        title: 'Market Overview',
        guide:
          'Provide an overview of the market in which you operate — size, growth rate, segmentation, and key opportunities.',
      },
      {
        id: 'market-size',
        title: 'Market Size',
        guide:
          'Estimate and describe the total market size for your brand, including potential customer base, sales volume, and revenue opportunity.',
      },
      {
        id: 'industry-trends',
        title: 'Industry Market Trends',
        guide:
          'Summarize broader trends within your industry, such as technological advancements, regulatory changes, or shifts in customer expectations.',
      },
      {
        id: 'evolving-trends',
        title: 'Evolving Market Trends',
        guide:
          'Describe current and emerging market trends relevant to your industry and how they might impact your brand.',
      },
      {
        id: 'competitors-market-players',
        title: 'Competitors & Market Players (Market Share Details)',
        guide:
          'List your main competitors and other significant market players, including their approximate market share and strengths.',
      },
      {
        id: 'alternate-competitors',
        title: 'Alternative Solutions / Alternate Competitors',
        guide:
          'List alternate competitors and solutions that your user may choose over you. These competitors aren’t in the same sector or industry as you are.',
      },
      {
        id: 'competitors-unique-features',
        title: 'Unique Features of Three Main Competitors',
        guide:
          'Identify and describe unique features or strengths of three main competitors that differentiate them in the market.',
      },
      {
        id: 'competitors-marketing',
        title: 'Competitors Marketing Strategy',
        guide:
          'Summarize how your main competitors approach marketing — key messages, channels used, and positioning techniques they employ.',
      },
      {
        id: 'competitors-sales',
        title: 'Competitors Sales Strategy',
        guide:
          'Describe the sales methods and distribution approaches competitors use, including pricing models, partnerships, and customer acquisition tactics.',
      },
      {
        id: 'seasons-events',
        title: 'Events and Seasons Impacting Demand and Consumer Behavior',
        guide:
          'Identify events, holidays, or seasonal patterns that influence demand for your products or services and how consumer behavior changes.',
      },
    ],
  },
  {
    id: 'style-tone-of-voice',
    slug: 'style-tone-of-voice',
    title: 'Style / Tone of Voice',
    subtitle: 'Define how your brand looks, feels, and speaks.',
    icon: Palette,
    accent: 'from-fuchsia-400/20 to-fuchsia-400/5',
    questions: [
      {
        id: 'style-pillars',
        title: 'Style Pillars',
        guide:
          'Define the six style pillars that guide the design and presentation of products (e.g., minimalism, elegance, innovation).',
      },
      {
        id: 'design-philosophy',
        title: 'Design Philosophy',
        guide:
          "Explain the guiding principles behind your design approach — how functionality, aesthetics, and emotion combine to express your brand's values.",
      },
      {
        id: 'design-personality',
        title: 'Design Personality',
        guide:
          'Describe the personality traits and persona of products and design as if they were characters (e.g., bold, sophisticated, friendly).',
      },
      {
        id: 'brand-main-colors',
        title: 'Brand Main Colors (Hex Code)',
        guide:
          "Define the primary and secondary brand colors with their exact HEX codes. Explain the role of each color in representing the brand's mood, hierarchy, and visual consistency across digital and physical materials.",
      },
      {
        id: 'visual-identity-core',
        title: 'Visual Identity Core',
        guide:
          'Describe the core visual identity elements for products, such as logo usage, color palette, typography, and imagery.',
      },
      {
        id: 'product-design',
        title: 'Product Design Consideration',
        guide:
          'Describe the overall design philosophy for products, including functional and aesthetic considerations.',
      },
      {
        id: 'packaging-design',
        title: 'Packaging Design Consideration',
        guide:
          'Describe preferred packaging designs for products, including materials, formats, and design themes.',
      },
      {
        id: 'fashion-design',
        title: 'Fashion Design Consideration',
        guide:
          'Describe the fashion design elements and aesthetics for products (colors, patterns, materials, style influences).',
      },
      {
        id: 'graphic-print-design',
        title: 'Graphic / Print Design Consideration',
        guide:
          'Describe the design guidelines for print and graphic materials (brochures, flyers) used for products.',
      },
      {
        id: 'space-design',
        title: 'Space Design Consideration',
        guide:
          'Describe how physical spaces (e.g., retail stores, trade booths) should be designed to reflect the brand.',
      },
      {
        id: 'promotional-items',
        title: 'Promotional Items and Merchandizes Consideration',
        guide:
          'Describe preferred merchandizes and promotional items for products, including materials, formats, and design themes.',
      },
      {
        id: 'non-negotiable-style',
        title: 'Non-Negotiable Style Rules for Design',
        guide:
          'Specify brand rules for products that are absolute and cannot be compromised (e.g., never use certain colors).',
      },
      {
        id: 'defining-tone-of-voice',
        title: 'Defining Tone of Voice',
        guide:
          'Describe the overall tone of voice across communications — formal, casual, playful, authoritative, etc.',
      },
      {
        id: 'brand-language',
        title: 'Defining the Brand Language',
        guide:
          'Define the tone of voice that represents your brand, including key attributes and guidelines for consistency.',
      },
      {
        id: 'tone-style-stack',
        title: 'Tone of Voice Style Stack',
        guide:
          'Outline a hierarchical stack of tone styles that guide how the brand communicates across different contexts.',
      },
      {
        id: 'tone-dos-donts',
        title: "Guidelines for Product Tone of Voice (Dos and Don'ts)",
        guide:
          'Provide specific guidelines for the tone of voice used for products — behaviors to follow and avoid.',
      },
      {
        id: 'social-media-tone',
        title: 'Social Media Tone of Voice Examples',
        guide:
          'Present examples of the tone of voice used on social media platforms, showing how the brand engages with audiences.',
      },
      {
        id: 'blog-tone',
        title: 'Blog Post Tone of Voice Examples',
        guide:
          "Provide examples of tone and style used in your blog posts to convey your brand's personality.",
      },
      {
        id: 'advertorial-tone',
        title: 'Product Advertorial Tone Examples',
        guide: 'Provide examples of tone and style for advertorial content promoting products.',
      },
      {
        id: 'packaging-tone',
        title: 'Tone of Voice Examples in Packaging',
        guide:
          'Provide examples of language and tone used on product packaging to communicate brand personality.',
      },
      {
        id: 'pos-tone',
        title: 'Point of Sale Tone Examples',
        guide: 'Provide examples of tone and messaging used at the point of sale to engage customers.',
      },
      {
        id: 'short-copy-tone',
        title: 'Short Copywriting Tone Examples',
        guide:
          'Provide examples of tone and style for short copy (e.g., taglines, slogans) used to describe products.',
      },
    ],
  },
];

export const TOTAL_QUESTION_COUNT = QUESTIONNAIRE_SECTIONS.reduce(
  (acc, section) => acc + section.questions.length,
  0,
);

export function getSectionBySlug(slug: string): QuestionnaireSection | undefined {
  return QUESTIONNAIRE_SECTIONS.find((section) => section.slug === slug);
}

export function getSectionIndex(slug: string): number {
  return QUESTIONNAIRE_SECTIONS.findIndex((section) => section.slug === slug);
}
