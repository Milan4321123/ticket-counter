#!/bin/zsh
# ./encode-studio.sh → out/studio/mp4/day-NN-<id>.mp4 for every ad with frames + audio,
# deletes each ad's frames once its video is made (disk space), then copies the
# videos and the posting plan to ~/Desktop/martnepali-30-days/.
cd "${0:A:h}"
mkdir -p out/studio/mp4
node -e "const S=require('./studio/scripts.js'); for (const d of require('./out/studio/order.json')) console.log(d.id + ' ' + d.file + ' ' + Math.round(S.byId[d.id].TOTAL * 30))" | while read id file want; do
  dir="out/studio/$id"
  have=$(ls "$dir/frames" 2>/dev/null | wc -l | tr -d ' ')
  [[ -f "$dir/audio.wav" && "$have" == "$want" ]] || { echo "skip $id ($have/$want frames)"; continue; }
  [[ -f "out/studio/mp4/$file" && "out/studio/mp4/$file" -nt "$dir/frames/00000.jpg" ]] && { echo "have $file"; continue; }
  ffmpeg -nostdin -hide_banner -loglevel error -y -framerate 30 -i "$dir/frames/%05d.jpg" -i "$dir/audio.wav" \
    -af "loudnorm=I=-14:TP=-1.5:LRA=9" -c:v libx264 -preset slow -crf 20 -maxrate 9M -bufsize 18M \
    -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -ar 44100 -shortest "out/studio/mp4/$file" && echo "ok $file" && rm -rf "$dir/frames"
done
mkdir -p ~/Desktop/martnepali-30-days
cp out/studio/mp4/*.mp4 out/studio/posting-plan.md ~/Desktop/martnepali-30-days/
