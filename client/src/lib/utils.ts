import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to "DD MMM YYYY" (e.g., "15 Jun 2023")
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Format date and time: "DD MMM YYYY, HH:MM AM/PM"
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Generate auto-incrementing gate pass number
export function generateGatePassNumber(lastNumber: number): string {
  const nextNumber = lastNumber + 1;
  return `PZGP-${nextNumber.toString().padStart(3, "0")}`;
}

// Department options
export const departmentOptions = [
  { label: "Warehouse", value: "Warehouse" },
  { label: "HO (Head Office)", value: "HO" },
  { label: "IT", value: "IT" },
  { label: "Finance", value: "Finance" },
];

// Get today's date in ISO format for date input
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// Generate PDF file name based on gate pass
export function generatePdfFilename(gatePassNumber: string, type: string): string {
  return `${gatePassNumber}_${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

// Generate Excel file name for reports
export function generateExcelFilename(reportType: string): string {
  return `GatePass_${reportType}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

// Function to validate CNIC format (e.g., 42101-9948106-8)
export function validateCNIC(cnic: string): boolean {
  const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
  return cnicPattern.test(cnic);
}

// Function to format a CNIC as user types
export function formatCNIC(input: string): string {
  // Remove all non-digits
  const digitsOnly = input.replace(/\D/g, "");
  
  // Apply the CNIC format
  let formattedCNIC = "";
  
  if (digitsOnly.length > 0) {
    // First 5 digits
    formattedCNIC = digitsOnly.substring(0, 5);
    
    if (digitsOnly.length > 5) {
      // Add hyphen and next 7 digits
      formattedCNIC += "-" + digitsOnly.substring(5, 12);
      
      if (digitsOnly.length > 12) {
        // Add hyphen and last digit
        formattedCNIC += "-" + digitsOnly.substring(12, 13);
      }
    }
  }
  
  return formattedCNIC;
}

// Function to validate phone number format (e.g., 0306-2228391 or 03062228391)
export function validatePhoneNumber(phone: string): boolean {
  const phonePattern = /^03\d{2}-?\d{7}$/;
  return phonePattern.test(phone);
}

// Function to format a phone number as user types
export function formatPhoneNumber(input: string): string {
  // Remove all non-digits
  const digitsOnly = input.replace(/\D/g, "");
  
  // Format for Pakistani mobile numbers starting with 03
  let formattedNumber = "";
  
  if (digitsOnly.length > 0) {
    // First 4 digits (03xx)
    formattedNumber = digitsOnly.substring(0, 4);
    
    if (digitsOnly.length > 4) {
      // Add hyphen and remaining digits
      formattedNumber += "-" + digitsOnly.substring(4, 11);
    }
  }
  
  return formattedNumber;
}
