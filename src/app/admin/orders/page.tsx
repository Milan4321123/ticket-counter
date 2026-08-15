import { redirect } from 'next/navigation';

// This page used to list every order on the platform, buyer names and email
// addresses included. It doesn't exist any more: buyers belong to the organizer
// who sold to them, and the platform side now sees counts and money instead of
// people. Kept as a redirect so an old bookmark lands somewhere useful rather
// than on a 404.
export default function AdminOrdersPage(): never {
  redirect('/admin/sales');
}
