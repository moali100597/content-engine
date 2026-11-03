#!/bin/bash
# Render a long composition in parts that can be resumed, then join them: tools/render-parts.sh <CompositionId> <name> <frames> [part=300] [audio.wav]
# A finished part is never rendered again; delete out/parts/<name>/NNNNN.mp4 to redo one. Picture is rendered silent and the soundtrack is laid on the joined film.
id=$1; name=$2; total=$3; step=${4:-300}; audio=$5; dir=out/parts/$name; mkdir -p $dir
exe=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell; [ -x $exe ] && b="--browser-executable=$exe"
for ((a=0; a<total; a+=step)); do
  z=$((a+step-1)); [ $z -ge $total ] && z=$((total-1)); f=$dir/$(printf %05d $a).mp4
  [ -f $f ] && continue
  date +"%T start $a-$z" >> $dir/log.txt
  npx remotion render $id $dir/tmp.mp4 --frames=$a-$z --muted --gl=${GL:-swangle} $b --concurrency=2 --crf=17 --log=error >> $dir/render.log 2>&1 && mv $dir/tmp.mp4 $f || { echo "failed $a" >> $dir/log.txt; exit 1; }
done
ls $dir/[0-9]*.mp4 | sed "s|^|file '$PWD/|; s|$|'|" > $dir/list.txt
if [ -n "$audio" ]; then ffmpeg -y -loglevel error -f concat -safe 0 -i $dir/list.txt -i $audio -c:v copy -c:a aac -b:a 256k -shortest out/$name.mp4
else ffmpeg -y -loglevel error -f concat -safe 0 -i $dir/list.txt -c copy out/$name.mp4; fi && date +"%T joined out/$name.mp4" >> $dir/log.txt
