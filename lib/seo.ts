/**
 * Central SEO data used by sitemap, robots, and category landing pages.
 */

import type { BusinessCategory } from '@/lib/ranking';

export interface SeoCategory {
  slug: string;
  label: string;
  plural: string;
  searchQuery: string;       // sent to Google Places text search
  description: string;       // used in meta description + page intro
  businessCategory: BusinessCategory; // maps to ranking taxonomy for BusinessCard / QuoteButton
}

export interface SeoCity {
  slug: string;       // URL segment: "cleveland-oh"
  display: string;    // Short display: "Cleveland, OH"
  state: string;      // Full state: "Ohio"
  searchName: string; // Sent to Google Places: "Cleveland, Ohio"
}

export const SEO_CATEGORIES: SeoCategory[] = [
  {
    slug: 'plumbers',
    label: 'Plumber',
    plural: 'Plumbers',
    searchQuery: 'plumber',
    businessCategory: 'plumbing',
    description:
      'Find trusted plumbers with high ratings and a proven track record of consistent customer feedback.',
  },
  {
    slug: 'dentists',
    label: 'Dentist',
    plural: 'Dentists',
    searchQuery: 'dentist',
    businessCategory: 'medical',
    description:
      'Discover top-rated dentists ranked by review quality, patient volume, and consistent care.',
  },
  {
    slug: 'hvac',
    label: 'HVAC Company',
    plural: 'HVAC Companies',
    searchQuery: 'hvac repair',
    businessCategory: 'hvac',
    description:
      'Compare HVAC companies based on real customer signals — not just star averages.',
  },
  {
    slug: 'electricians',
    label: 'Electrician',
    plural: 'Electricians',
    searchQuery: 'electrician',
    businessCategory: 'electrical',
    description:
      'Find reliable electricians ranked by verified review volume and consistent ratings.',
  },
  {
    slug: 'mechanics',
    label: 'Auto Mechanic',
    plural: 'Auto Mechanics',
    searchQuery: 'auto mechanic',
    businessCategory: 'automotive',
    description:
      'See which auto mechanics locals trust most, ranked by review quality and volume.',
  },
  {
    slug: 'roofers',
    label: 'Roofing Contractor',
    plural: 'Roofing Contractors',
    searchQuery: 'roofing contractor',
    businessCategory: 'roofing',
    description:
      'Find top-rated roofing contractors backed by high review counts and consistent customer feedback.',
  },
  {
    slug: 'restaurants',
    label: 'Restaurant',
    plural: 'Restaurants',
    searchQuery: 'restaurant',
    businessCategory: 'food',
    description:
      'Discover the restaurants locals actually trust — ranked by review quality and volume.',
  },
  {
    slug: 'lawyers',
    label: 'Lawyer',
    plural: 'Lawyers',
    searchQuery: 'lawyer',
    businessCategory: 'legal',
    description:
      'Find highly rated lawyers with a strong base of verified client reviews.',
  },
  {
    slug: 'doctors',
    label: 'Doctor',
    plural: 'Doctors',
    searchQuery: 'doctor',
    businessCategory: 'medical',
    description:
      'Compare doctors and medical practices ranked by patient review quality and volume.',
  },
  {
    slug: 'contractors',
    label: 'General Contractor',
    plural: 'General Contractors',
    searchQuery: 'general contractor',
    businessCategory: 'home_services',
    description:
      'Find trusted general contractors ranked by proven customer satisfaction across many reviews.',
  },
];

export const SEO_CITIES: SeoCity[] = [
  // Ohio
  { slug: 'cleveland-oh',    display: 'Cleveland, OH',    state: 'Ohio',     searchName: 'Cleveland, Ohio' },
  { slug: 'columbus-oh',     display: 'Columbus, OH',     state: 'Ohio',     searchName: 'Columbus, Ohio' },
  { slug: 'akron-oh',        display: 'Akron, OH',        state: 'Ohio',     searchName: 'Akron, Ohio' },
  { slug: 'cincinnati-oh',   display: 'Cincinnati, OH',   state: 'Ohio',     searchName: 'Cincinnati, Ohio' },
  { slug: 'toledo-oh',       display: 'Toledo, OH',       state: 'Ohio',     searchName: 'Toledo, Ohio' },
  { slug: 'dayton-oh',       display: 'Dayton, OH',       state: 'Ohio',     searchName: 'Dayton, Ohio' },
  // Midwest
  { slug: 'detroit-mi',      display: 'Detroit, MI',      state: 'Michigan', searchName: 'Detroit, Michigan' },
  { slug: 'chicago-il',      display: 'Chicago, IL',      state: 'Illinois', searchName: 'Chicago, Illinois' },
  { slug: 'indianapolis-in', display: 'Indianapolis, IN', state: 'Indiana',  searchName: 'Indianapolis, Indiana' },
  { slug: 'pittsburgh-pa',   display: 'Pittsburgh, PA',   state: 'Pennsylvania', searchName: 'Pittsburgh, Pennsylvania' },
  // South
  { slug: 'nashville-tn',    display: 'Nashville, TN',    state: 'Tennessee', searchName: 'Nashville, Tennessee' },
  { slug: 'charlotte-nc',    display: 'Charlotte, NC',    state: 'North Carolina', searchName: 'Charlotte, North Carolina' },
  { slug: 'atlanta-ga',      display: 'Atlanta, GA',      state: 'Georgia',  searchName: 'Atlanta, Georgia' },
  { slug: 'houston-tx',      display: 'Houston, TX',      state: 'Texas',    searchName: 'Houston, Texas' },
  { slug: 'dallas-tx',       display: 'Dallas, TX',       state: 'Texas',    searchName: 'Dallas, Texas' },
  // West
  { slug: 'denver-co',       display: 'Denver, CO',       state: 'Colorado', searchName: 'Denver, Colorado' },
  { slug: 'phoenix-az',      display: 'Phoenix, AZ',      state: 'Arizona',  searchName: 'Phoenix, Arizona' },
  { slug: 'portland-or',     display: 'Portland, OR',     state: 'Oregon',   searchName: 'Portland, Oregon' },
  { slug: 'seattle-wa',      display: 'Seattle, WA',      state: 'Washington', searchName: 'Seattle, Washington' },
  { slug: 'los-angeles-ca',  display: 'Los Angeles, CA',  state: 'California', searchName: 'Los Angeles, California' },
];

export function getCategoryBySlug(slug: string): SeoCategory | undefined {
  return SEO_CATEGORIES.find((c) => c.slug === slug);
}

export function getCityBySlug(slug: string): SeoCity | undefined {
  return SEO_CITIES.find((c) => c.slug === slug);
}
