import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  // Added this check in case the error is a string itself
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return defaultMessage;
}
