import { redirect } from 'next/navigation';

// /work/<demo> holds the studio's demo projects (see /work/wedding); the list
// of all projects already lives on /studio, so /work itself just goes there.
export default function WorkIndex() {
  redirect('/studio#projects');
}
