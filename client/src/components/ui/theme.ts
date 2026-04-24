import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility function to merge class names
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Define theme colors for use throughout the app
export const themeColors = {
  primary: {
    light: "#7986cb",
    DEFAULT: "#3f51b5",
    dark: "#303f9f",
  },
  secondary: {
    light: "#ff4081",
    DEFAULT: "#f50057",
    dark: "#c51162",
  },
  neutral: {
    lightest: "#fafafa",
    light: "#f5f5f5",
    medium: "#e0e0e0",
    gray: "#9e9e9e",
    dark: "#424242",
  },
  success: "#4caf50",
  error: "#f44336",
  warning: "#ff9800",
  info: "#2196f3",
};

// Status badge styling
export const getStatusBadgeClass = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-success bg-opacity-10 text-success";
    case "pending":
      return "bg-warning bg-opacity-10 text-warning";
    case "rejected":
      return "bg-error bg-opacity-10 text-error";
    case "approved":
    case "hod_approved":
      return "bg-blue-100 text-blue-700";
    case "security_allowed":
      return "bg-purple-100 text-purple-700";
    case "sent_back":
      return "bg-orange-100 text-orange-700";
    case "force_closed":
      return "bg-red-900 bg-opacity-10 text-red-900";
    default:
      return "bg-neutral-gray bg-opacity-10 text-neutral-gray";
  }
};

// Human-readable status labels
export const getStatusLabel = (status: string): string => {
  switch (status.toLowerCase()) {
    case "pending": return "Pending";
    case "approved": return "Approved";
    case "hod_approved": return "HOD Approved";
    case "security_allowed": return "Security Allowed";
    case "completed": return "Completed";
    case "rejected": return "Rejected";
    case "sent_back": return "Sent Back";
    case "force_closed": return "Force Closed";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
};
