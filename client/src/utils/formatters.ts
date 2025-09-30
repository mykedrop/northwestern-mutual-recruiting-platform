/**
 * Utility functions for formatting data in Northwestern Mutual Recruiting Platform
 * Enterprise-grade formatting for production use
 */

/**
 * Format a number with thousands separators
 * @example formatNumber(1234) => "1,234"
 */
export const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Format a percentage
 * @example formatPercentage(75) => "75%"
 */
export const formatPercentage = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return '0%';
  return `${Math.round(num)}%`;
};

/**
 * Format a decimal as percentage
 * @example formatDecimalAsPercentage(0.75) => "75%"
 */
export const formatDecimalAsPercentage = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return '0%';
  return `${Math.round(num * 100)}%`;
};

/**
 * Format currency (USD)
 * @example formatCurrency(1234.56) => "$1,234.56"
 */
export const formatCurrency = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

/**
 * Format a phone number
 * @example formatPhone("2155550001") => "(215) 555-0001"
 */
export const formatPhone = (phone: string | undefined | null): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

/**
 * Format a date in human-readable format
 * @example formatDate("2024-01-15") => "Jan 15, 2024"
 */
export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(date);
  }
};

/**
 * Format a date with time
 * @example formatDateTime("2024-01-15T10:30:00") => "Jan 15, 2024 10:30 AM"
 */
export const formatDateTime = (date: string | Date | undefined | null): string => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(date);
  }
};

/**
 * Format a relative time (e.g., "2 minutes ago")
 * @example formatRelativeTime(new Date(Date.now() - 120000)) => "2 minutes ago"
 */
export const formatRelativeTime = (date: string | Date | undefined | null): string => {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    return formatDate(d);
  } catch {
    return String(date);
  }
};

/**
 * Format a score with visual indicator
 * @example formatScore(85) => { score: "85", color: "green" }
 */
export const formatScore = (score: number | undefined | null): { score: string; color: string; label: string } => {
  if (score === undefined || score === null || isNaN(score)) {
    return { score: 'N/A', color: 'gray', label: 'Not scored' };
  }

  const rounded = Math.round(score);

  if (rounded >= 90) return { score: String(rounded), color: 'green', label: 'Excellent' };
  if (rounded >= 75) return { score: String(rounded), color: 'blue', label: 'Strong' };
  if (rounded >= 60) return { score: String(rounded), color: 'yellow', label: 'Good' };
  if (rounded >= 40) return { score: String(rounded), color: 'orange', label: 'Fair' };
  return { score: String(rounded), color: 'red', label: 'Needs improvement' };
};

/**
 * Truncate text with ellipsis
 * @example truncate("Long text here", 10) => "Long text..."
 */
export const truncate = (text: string | undefined | null, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Format a name (capitalize properly)
 * @example formatName("john doe") => "John Doe"
 */
export const formatName = (name: string | undefined | null): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Safely get initials from a name
 * @example getInitials("John", "Doe") => "JD"
 */
export const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return (first + last).toUpperCase() || '??';
};