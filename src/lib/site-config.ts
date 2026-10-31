// The one file to edit for public header + footer details. Anything left empty ('') is hidden on the
// site automatically, including a footer column whose links are all empty.

export const siteConfig = {
  companyName: 'ArthVo',
  tagline: 'Know your tax before your CA does.',
  cin: '',
  email: '',

  social: {
    linkedin: 'https://www.linkedin.com/company/arthvoo/',
    instagram: 'https://www.instagram.com/getarthvo/',
    x: '',
    youtube: '',
  },

  // Set to true when the feature is ready to be linked.
  features: {
    offerDecoder: false,
    hikeSimulator: false,
  },

  // Add a path here once the page exists.
  pages: {
    taxCalculator: '/try',
    offerDecoder: '/offer',
    hikeSimulator: '/hike',
    about: '',
    faq: '',
    contact: '',
    blog: '',
    privacy: '/privacy',
    terms: '',
    grievance: '',
    disclaimer: '',
  },

  signIn: '/login',
  dataNote: 'Slips are read by AI and the file isn’t kept. Extracted figures are saved in your browser, and to your account once you sign in.',
  madeIn: 'Made in India',
}

type Feature = keyof typeof siteConfig.features
type Page = keyof typeof siteConfig.pages
export interface SiteLink { label: string; href: string }
export type SocialKey = keyof typeof siteConfig.social

const links = (items: { label: string; page: Page; feature?: Feature }[]): SiteLink[] =>
  items
    .filter(i => siteConfig.pages[i.page] && (!i.feature || siteConfig.features[i.feature]))
    .map(i => ({ label: i.label, href: siteConfig.pages[i.page] }))

export const headerLinks = links([
  { label: 'Tax calculator', page: 'taxCalculator' },
  { label: 'Offer decoder', page: 'offerDecoder', feature: 'offerDecoder' },
  { label: 'Hike simulator', page: 'hikeSimulator', feature: 'hikeSimulator' },
  { label: 'About', page: 'about' },
])

export const footerColumns = [
  {
    title: 'Product',
    links: links([
      { label: 'Tax calculator', page: 'taxCalculator' },
      { label: 'Offer letter decoder', page: 'offerDecoder', feature: 'offerDecoder' },
      { label: 'Hike simulator', page: 'hikeSimulator', feature: 'hikeSimulator' },
      { label: 'FAQ', page: 'faq' },
    ]),
  },
  {
    title: 'Company',
    links: links([
      { label: 'About the founder', page: 'about' },
      { label: 'Contact', page: 'contact' },
      { label: 'Blog / Tax guides', page: 'blog' },
    ]),
  },
  {
    title: 'Legal',
    links: links([
      { label: 'Privacy policy', page: 'privacy' },
      { label: 'Terms of use', page: 'terms' },
      { label: 'Grievance officer', page: 'grievance' },
      { label: 'Disclaimer', page: 'disclaimer' },
    ]),
  },
].filter(column => column.links.length > 0)
