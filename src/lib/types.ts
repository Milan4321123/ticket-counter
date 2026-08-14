// Shared API request/response shapes. Safe for both server and client imports.

export interface CreateOrderRequest {
  buyerName: string;
  buyerEmail: string;
  items: { tierId: string; quantity: number }[];
}

export interface CreateOrderResponse {
  orderId: string; // local order id (uuid) — used for capture + the order page URL
  mode: 'paypal' | 'mock' | 'transfer';
  paypalOrderId: string | null; // set when mode === 'paypal'; return this from createOrder() in the PayPal JS SDK
  totalCents: number;
  currency: string;
}

export interface CaptureOrderResponse {
  orderId: string;
  status: 'paid';
  ticketCodes: string[];
}

export interface ApiErrorResponse {
  error: string; // human-readable, safe to show the buyer
  code?: 'VALIDATION' | 'SOLD_OUT' | 'SALES_CLOSED' | 'PAYMENT_FAILED' | 'NOT_FOUND' | 'INTERNAL';
}

export interface CheckinRequest {
  code: string;
}

export interface CheckinTicketInfo {
  code: string;
  tierId: string;
  tierName: string;
  buyerName: string;
  buyerEmail: string;
  orderId: string;
}

export interface CheckinResponse {
  result: 'ok' | 'already_checked_in' | 'not_found' | 'not_paid' | 'mock_ticket';
  checkedInAt?: string; // set for 'already_checked_in'
  ticket?: CheckinTicketInfo;
}
