'use client';

import { useState } from 'react';
import type { VideoGroup } from '@/lib/studioVideos';
import VideoGrid from './VideoGrid';

/**
 * The homepage "Video work": one kind of video at a time, so only that kind's
 * posters load (each video itself loads only when pressed).
 */
export default function VideoTabs({ groups }: { groups: VideoGroup[] }) {
  const [active, setActive] = useState(groups[0]?.id);
  const group = groups.find((g) => g.id === active) ?? groups[0];
  if (!group) return null;
  return (
    <div className="sh-vt">
      <div className="sh-vt-tabs" role="tablist" aria-label="Kinds of video">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            id={`vt-tab-${g.id}`}
            aria-selected={g.id === group.id}
            aria-controls="vt-panel"
            className="sh-vt-tab"
            onClick={() => {
              setActive(g.id);
              document.querySelectorAll<HTMLVideoElement>('.sh-vt video').forEach((el) => el.pause());
            }}
          >
            {g.label}
            <span className="sh-vt-n">{g.videos.length}</span>
          </button>
        ))}
      </div>
      <div id="vt-panel" role="tabpanel" aria-labelledby={`vt-tab-${group.id}`} className="sh-vt-panel" key={group.id}>
        <p className="muted sh-vt-text">{group.text}</p>
        <VideoGrid videos={group.videos} />
      </div>
    </div>
  );
}
