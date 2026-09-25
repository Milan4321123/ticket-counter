// What the seller does off camera while a customer story is filmed: confirm
// that the transfer arrived, move the order on in the kitchen. The app's own
// functions (the same ones the Payment received and kitchen buttons call),
// run against the dev database.
//
//   node --experimental-transform-types --import ./tests/register.mjs tools/story-videos/seller-side.ts paid <orderId>
//   … kitchen <orderId> cooking|ready
import { finalizePaidOrder, getOrder } from '../../src/lib/orders';
import { setKitchenStatus } from '../../src/lib/kitchen';
import { getDb } from '../../src/lib/db';

const [, , what, orderId, status] = process.argv;
const order = orderId ? getOrder(orderId) : null;
if (!order) throw new Error(`no order ${orderId}`);
if (what === 'paid') {
  finalizePaidOrder(order.id, null);
  getDb().prepare(`UPDATE orders SET confirmed_via = 'reference' WHERE id = ?`).run(order.id);
  console.log('paid', order.id);
} else if (what === 'kitchen') {
  console.log('kitchen', setKitchenStatus(order.eventId, order.id, status as 'cooking' | 'ready'));
}
