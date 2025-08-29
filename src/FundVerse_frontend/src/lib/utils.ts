import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatE8s(e8s: bigint | number): string {
  const icp = Number(e8s) / 100_000_000;
  return icp.toFixed(8);
}

export function formatCurrency(amount: number, currency: string = 'ICP'): string {
  if (currency === 'ICP') {
    return `${amount.toFixed(8)} ICP`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

export function formatDate(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) / 1_000_000); // Convert from nanoseconds
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function calculateProgress(current: bigint | number, goal: bigint | number): number {
  const currentNum = Number(current);
  const goalNum = Number(goal);
  if (goalNum === 0) return 0;
  return Math.min((currentNum / goalNum) * 100, 100);
}

export function getDaysLeft(endDate: bigint | number): number {
  const now = Date.now() / 1000; // Current time in seconds
  const end = Number(endDate);
  const diffInSeconds = end - now;
  return Math.ceil(diffInSeconds / (24 * 60 * 60)); // Convert to days
}

export function truncateAddress(address: string, length: number = 8): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export const handleICError = (error: any): { message: string; code?: string } => {
  if (typeof error === 'object' && error?.message) {
    return { message: error.message, code: error.code };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'An unknown error occurred' };
};
