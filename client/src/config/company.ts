/**
 * Company configuration file
 * Update this file to change company information across the application
 */

// Default company configuration
const defaultCompanyConfig = {
  // Company basic info
  name: "AGP Pharma",
  fullName: "AGP Pharma Private Limited",
  tagline: "We Value Life",

  // Contact information
  address: "Karachi, Pakistan",
  phone: "",
  email: "",
  website: "www.agppharma.com",

  // Social media links (optional)
  social: {
    facebook: "",
    linkedin: "",
    twitter: "",
  },

  // Branding colors (primary colors that will be used throughout the app)
  // These should match your theme.json settings
  colors: {
    primary: "#003087", // AGP navy blue
    secondary: "#CC0000", // AGP red accent
    success: "#4caf50", // Success states (green)
    warning: "#ff9800", // Warning states (orange)
    error: "#f44336", // Error states (red)
    info: "#2196f3", // Info states (light blue)
  },

  // Logo paths
  logo: {
    full: "/assets/AGP-logo.png", // Horizontal logo with name
    icon: "/assets/AGP-logo.png", // Use the supplied PNG logo
    favicon: "/favicon.ico", // Site favicon
  },

  // Footer text
  footerText: "© 2025 AGP Pharma Private Limited. All rights reserved.",

  // Gate pass prefix (used in gate pass numbering system)
  gatePassPrefix: "PZGP",
};

export const companyConfig = defaultCompanyConfig;

// Re-export individual properties for convenience
export const companyName = companyConfig.name;
export const companyFullName = companyConfig.fullName;
export const companyLogo = companyConfig.logo;
export const companyColors = companyConfig.colors;
export const companyAddress = companyConfig.address;
export const companyContact = {
  phone: companyConfig.phone,
  email: companyConfig.email,
  website: companyConfig.website,
};