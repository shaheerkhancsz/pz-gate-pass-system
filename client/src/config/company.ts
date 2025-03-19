/**
 * Company configuration file
 * Update this file to change company information across the application
 */

// Default company configuration
const defaultCompanyConfig = {
  // Company basic info
  name: "Parazelsus Pakistan",
  fullName: "Parazelsus Pakistan (Pvt) Ltd.",
  tagline: "FMCG products",
  
  // Contact information
  address: "Plot No.E-22, Near Faizan Steel, Ghani Chowrangi S.I.T.E., Karachi-75730, Pakistan",
  phone: "+92-306-2228391",
  email: "it.support@parazelsus.pk",
  website: "www.parazelsus.pk",
  
  // Social media links (optional)
  social: {
    facebook: "https://facebook.com/parazelsus",
    linkedin: "https://linkedin.com/company/parazelsus",
    twitter: "https://twitter.com/parazelsus",
  },
  
  // Branding colors (primary colors that will be used throughout the app)
  // These should match your theme.json settings
  colors: {
    primary: "#FF0000", // Red primary color
    secondary: "#ff4081", // Accent color for highlights
    success: "#4caf50", // Success states (green)
    warning: "#ff9800", // Warning states (orange)
    error: "#f44336", // Error states (red)
    info: "#2196f3", // Info states (light blue)
  },
  
  // Logo paths
  logo: {
    full: "/assets/PZ-logo.png", // Horizontal logo with name
    icon: "/assets/PZ-logo.png", // Use the supplied PNG logo
    favicon: "/favicon.ico", // Site favicon
  },
  
  // Footer text
  footerText: "© 2025 Parazelsus Pakistan. All rights reserved.",
  
  // Gate pass prefix (used in gate pass numbering system)
  gatePassPrefix: "PZGP",
};

// Load stored configuration from localStorage if available
let storedConfig = null;
try {
  if (typeof window !== 'undefined') { // Check if we're in browser environment
    const storedConfigStr = localStorage.getItem('companyConfig');
    if (storedConfigStr) {
      storedConfig = JSON.parse(storedConfigStr);
    }
  }
} catch (error) {
  console.error('Error loading company config from localStorage:', error);
}

// Merge stored config with default config (or use default if no stored config)
export const companyConfig = storedConfig || defaultCompanyConfig;

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