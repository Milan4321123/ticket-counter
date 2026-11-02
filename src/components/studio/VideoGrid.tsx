import StudioPlayer from '@/components/StudioPlayer';
import type { StudioVideo } from '@/lib/studioVideos';

/** Portrait (9:16) films in one grid, landscape (16:9) ones in a wider grid. */
export default function VideoGrid({ videos }: { videos: StudioVideo[] }) {
  const tall = videos.filter((x) => !x.wide);
  const wide = videos.filter((x) => x.wide);
  const item = (x: StudioVideo) => (
    <figure key={x.id} id={`v-${x.id}`} className="stv-item">
      <StudioPlayer video={x} />
      <figcaption>
        <strong>
          {x.title}
          {x.loop ? <span className="sh-silent">silent loop</span> : null}
        </strong>
        <span>{x.text}</span>
      </figcaption>
    </figure>
  );
  return (
    <>
      {tall.length > 0 && <div className="stv-grid sh-grid-tall">{tall.map(item)}</div>}
      {wide.length > 0 && <div className={`stv-grid stv-grid-wide${tall.length ? ' sh-grid-after' : ''}`}>{wide.map(item)}</div>}
    </>
  );
}
