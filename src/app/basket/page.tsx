import { currentCustomer } from '@/lib/customers';
import BasketPage from './BasketPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your basket', robots: { index: false, follow: false } };

/** The cross-seller basket. A signed-in customer's details are filled in. */
export default async function Basket() {
  const customer = await currentCustomer();
  return <BasketPage customer={customer ? { name: customer.name, email: customer.email } : null} />;
}
